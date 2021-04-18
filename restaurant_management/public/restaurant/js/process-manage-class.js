ProcessManage = class ProcessManage {
	constructor(options) {
		Object.assign(this, options, {
			items: {},
			items_ready: [],
			modal: undefined,
			status: "close",
			jobs: 0,
			busy: false,
			url_base: "restaurant_management.restaurant_management.doctype.restaurant_object.restaurant_object."
		});
		this.command_container_name = this.table.data.name + "-command_container"

		this.initialize();
	}

	reload(){
		this.get_commands_food()
	}

	initialize(){
		console.log(this.table.data);
		if(typeof this.modal == "undefined"){
			this.modal = new CETIModal({
				"full_page": true,
				"customize": true,
				"adjust_height": 25,
				"title": `<strong>${this.table.room.data.name}</strong> (${this.table.data.description})`,
				"call_back": () => {
					this.make();
				}
			});
		}else{
			this.modal.show();
		}
	}

	init(){
		this.modal.show();
	}

	is_open(){
		return this.modal.modal.display
	}

	close(){
		this.modal.hide();
		this.status = "close";
	}

	make(){
		this.make_dom();
		this.get_commands_food();
	}

	make_dom(){
		this.modal.container().append(this.template());
		this.modal.title_container().empty().append(
			new JSHtml({
				tag: "button",
				properties: {
					class: "btn btn-default btn-flat",
					style: "background-color: rgba(119,136,153,0.64); color: white"
				},
				content: "<span class='fa fa-reply'/> {{text}}",
				text: (this.table.room.data.description + " (" + this.table.data.description + ")")
			}).on("click", () => {
				this.modal.hide()
			}).html()
		)
	}

	template(){
		return `
		<div class=" process-manage">
			<div id="${this.command_container_name}"></div>
		</div>`
	}

	get_commands_food() {
		CETI.api.call({
			model: "Restaurant Object",
			name: this.table.data.name,
			method: "commands_food",
			args: {},
			always: (r) => {
				this.make_food_commands(r.message);
			},
		})
	}

	make_food_commands(items=[]){
		let _items = Object.keys(this.items);

		items.forEach((item) => {
			if (_items.includes(item.identifier)){
				this.items[item.identifier].data = item;
			} else {
				this.add_item(item);
			}

			this.items[item.identifier].process_manage = this;
		})
	}

	check_item(item){
		if(Object.keys(this.items).includes(item.identifier)){
			let _item = this.items[item.identifier];
			if (this.include_status(item.status)) {
				_item.data = item;
				_item.update_status_html();
			}else{
				_item.remove();
			}
		}else{
			if(this.include_status(item.status) && this.include_item_group(item.item_group)){
				this.add_item(item);
			}
		}
	}

	add_item(item){
		this.items[item.identifier] = new FoodCommand({
			identifier: item.identifier,
			process_manage: this,
			data: item
		})
	}

	include_status(status){
		return this.table.data.status_managed.includes(status)
	}

	include_item_group(item_group){
		return this.table.data.items_group.includes(item_group)
	}

	/*check_commands(data){
		let get_commands = false;

		let items = Object.keys(this.items);

		data.forEach((command) => {
			if(!get_commands){
				if(items.includes(command.identifier)){
					if(this.items[command.identifier].data.status !== command.status){
						this.items[command.identifier].update_data();
					}
				}else{
					this.get_commands_food();
					get_commands = true;
				}
			}
		})

		this.check_if_not_exist(data);
	}*/

	/*check_if_not_exist(data){
		let data_dict = {"None": {}};
		let items = Object.keys(this.items);

		data.forEach((command) => {
			if(!items.includes(command.identifier)){
				this.items[command.identifier].remove();
			}
			data_dict[command.identifier] = command;
		})

		if(items.length === 0) return;

		items.forEach((item) => {
			if(!Object.keys(data_dict).includes(item)) {
				this.items[item].remove();
			}
		})
	}*/

	container(){return $(`#orders-${this.table.data.name}`)}

	command_container(){return document.getElementById(this.command_container_name)}

	ready(){
		this.jobs --;
		if(this.jobs === 0){
			RM.ready();
		}
	}
}