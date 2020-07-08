class RestaurantRoom{
	constructor(data) {
		this.identifier = data.identifier;
		this.edit_form = null;
		this.data = data;
		this.tables = {};
		this.this = null
		this.indicator = null;
		this.listener();
	}

	listener(){
		frappe.realtime.on(this.data.name, (data) => {
			if(data.action === "Notifications"){
				this.update_notifications(data.orders_count);
			}else if (data.action === "Add"){
				if(this.data.name === RM.current_room.data.name){
					this.append_table(data.table);
				}
			}
		})
	}

	append_table(table){
		if(!Object.keys(this.tables).includes(table.identifier)){
			this.tables[table.identifier] = new RestaurantObject(this, table);
			if (RM.editing) {
				setTimeout(() => {
					this.tables[table.identifier].select();
				}, 0)
			}
		}
	}

	render(){
		this.this = new JSHtml({
			tag: "div",
			properties: {class: "btn-default button room"},
			content: this.template()
		}).on("click", () => {
			event.stopPropagation();
			this.select();
		})
		RM.rooms_container.append(this.this.html());
	}

	template(){
		this.indicator = new JSHtml({
			tag: "span",
			properties: {class: `badge ${this.data.orders_count > 0 ? 'bg-yellow' : 'bg-none'}`},
			content: this.data.orders_count
		})

		return `
		<div class="edit-bar-room" style="z-index: 550">
			${new JSHtml({
				tag: "button",
				properties: {class: "btn btn-success btn-room pull-left"},
				content: '<span class="fa fa-pencil"/>'
			}).on("click", () => {
				event.stopPropagation();
				this.edit();
			}).html()}
			${new JSHtml({
				tag: "button",
				properties: {class: "btn btn-warning btn-room pull-right"},
				content: '<span class="fa fa-trash"/>'
			}).on("click", () => {
				event.stopPropagation();
				this.delete();
			}).html()}
		</div>
		<span class="fa"/> ${this.data.description}
		${this.indicator.html()}`
	}

	select(){
		this.this.add_class('active').JQ().siblings('.button.room.active').removeClass('active');

		if(typeof RM.current_room != "undefined"){
			if(RM.current_room.data.name !== this.data.name){
				RM.current_room.hide_tables();
			}
		}

		RM.current_room = this;
		this.get_tables()
	}

	in_tables(f, condition=null){
		Object.keys(this.tables).forEach((table) => {
			if(typeof this.tables[table] != "undefined"){
				if(condition == null || this.tables[table].data[condition.field] === condition.value){
					f(this.tables[table], table, this.tables);
				}
			}
		})
	}

	hide_tables(){
		this.in_tables((table) => {
			table.hide();
		})
	}

	unselect_all_tables(){
		this.in_tables((table) => {
			table.unselect();
		})
	}

	edit(){
		if(this.edit_form == null) {
			this.edit_form = new CETIForm({
				doctype: "Restaurant Object",
				docname: this.data.name,
				form_name: "restaurant-room",
				call_back: () => {
					RM.make_rooms();
					this.edit_form.hide();
				},
				title: __("Update Room"),
				field_properties: {
					type: {read_only: true}
				}
			});
		}else{
			this.edit_form.reload();
			this.edit_form.show();
		}
	}

	delete(){
		if(RM.busy_message()){
			return;
		}
		frappe.confirm(__("Delete this Room?"), () => {
			RM.working("Deleting Room");
			CETI.api.call({
				model: "Restaurant Object",
				name: this.data.name,
				method: "_delete",
				always: (r) => {
					RM.ready();
                	if(typeof r.message != "undefined" && r.message) {
                		RM.delete_current_room();
                		RM.sound_delete();
                		RM.make_rooms();
					}
				},
				freeze: false
			})
        });
	}

	get_tables(){
		RM.working("Loading Rooms");
		window.location.href = "/desk#restaurant-manage?restaurant_room=" + this.data.name;
		CETI.api.call({
			model: "Restaurant Object",
			name: this.data.name,
			method: "get_objects",
			args:{},
			always: (r) => {
				this.make_tables(r.message);
				RM.ready();
			},
			freeze: false
		})
	}

	make_tables(tables=[]){
		let _tables = Object.keys(this.tables);

		tables.forEach((table) => {
			if (_tables.includes(table.name)){
				this.tables[table.name].reset_data(table);
			} else {
				this.tables[table.name] = new RestaurantObject(this, table);
			}
		})
	}

	add_object(t){
		RM.working("Adding Table");
		CETI.api.call({
			model: "Restaurant Object",
			name: this.data.name,
			method: "add_object",
			args: {t: t},
			always: () => {
				RM.ready()
			}
		})
	}

	set_z_index(){
		this.in_tables((table) => {
			let max_z_index = RM.max_z_index;
			RM.max_z_index = (max_z_index < table.get_z_index()) ? table.get_z_index() : max_z_index;
		})
	}

	update_notifications(data){
		this.data.orders_count = data;
		this.indicator.val(data);

		if(flt(data) > 0){
			this.indicator.remove_class("bg-none").add_class("bg-yellow");
		}else{
			this.indicator.remove_class("bg-yellow").add_class("bg-none");
		}
	}
}