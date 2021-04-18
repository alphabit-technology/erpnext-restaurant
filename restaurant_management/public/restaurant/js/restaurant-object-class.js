RestaurantObject = class RestaurantObject{
	constructor(room, data) {
		Object.assign(this, {
			identifier: data.identifier,
			data: data,
			drag: false,
			edit_form: null,
			room: room
		});
		this.this = null;

		this.indicator = null;
		this.edit_button = null;
		this.description = null;
		this.delete_button = null;
		this.no_of_seats = null;

		this.render();
		this.listener();
    }

    listener(){
		frappe.realtime.on(this.data.name, (data) => {
			console.log(data);
			if(data.action === "Notifications"){
				this.update_notifications(data);
			}
			if(this.room.data.name === RM.current_room.data.name){
				if(data.action === "Update"){
					this.reset_data(data.data);
					if(this.edit_form != null){
						this.edit_form.background_reload();
					}
					if(RM.editing){
						setTimeout(() => {
							this.select();
						}, 0)
					}
				}else if (data.action === "Delete"){
					this.remove();
				}else if(data.action === "Transfer Order"){
					RM.transfer_order = undefined;
					RM.request_client = data.client;

					let order_manage = `order_manage_${this.data.name}`;

					if (typeof window[order_manage] == "undefined"){
						if(RM.client === data.client){
							setTimeout(() => {
								window[order_manage] = new OrderManage({
									identifier: order_manage,
									table: this,
									current_order_identifier: data.order.name
								})
							}, 100)
						}
					}else{
						window[order_manage].make_orders(data.orders, data.order.name, true);
						if(RM.client === data.client) {
							//window[order_manage].make_orders(data.orders, data.order.name, true);
							window[order_manage].init();
						}else{
							//window[order_manage].make_orders(data.orders, data.order.name, true);
						}
					}
				}
			}
		})
	}

	update_notifications(data){
		let order_manage = `order_manage_${this.data.name}`;
		RM.request_client = data.client;

		if (typeof window[order_manage] != "undefined"){
			if(this.data.orders_count < data.orders_count){
				window[order_manage].get_orders(data.order, true);
			}
		}

		this.data.orders_count = data.orders_count;
		this.set_orders_count();
	}

	remove(){
		this.this.remove();

		let tables = Object.keys(this.room.tables);

		tables.forEach((table) => {
			if(this.room.tables[table].data.identifier === this.data.identifier){
				delete this.room.tables[table];
				RM.sound_delete();
			}
		})
	}

	save_config() {
		setTimeout(() => {
			if (window.saving) return false;
			window.saving = true;
			CETI.api.call({
				model: "Restaurant Object",
				name: this.data.name,
				method: "save_position",
				args:{"style": this.css_style().cssText},
				always: () => {
					window.saving = false
				},
			})
		}, 10)
	}

	css_style(){
		return this.this == null ? null : this.this.self.style;
	}

	unselect(){
		if(this.drag === false){
			if(this.css_style() != null) {
				this.css_style().zIndex = 40;
				this.this.remove_class("selected").JQ().draggable({disabled: true});
			}
		}
		setTimeout(() => {
			this.drag = false;
		}, 100)
	}

	refresh(){
		this.this.self.setAttribute('style', this.data.css_style);
		this.show();
	}

	hide(){this.this.hide()}
	show(){
		if(this.room.data.identifier === RM.current_room.data.identifier){
			this.this.show();
		}
	}

	render(){
		this.this = new JSHtml({
			tag: "div",
			properties: {
				class: "d-table",
				style: this.data.css_style
			},
			content: this.template()
		}).on("click", () => {
			event.stopPropagation();
			this.select();
		})

		RM.tables_container.append(this.this.html());

		setTimeout(() => {
			this.no_of_seats.hide();
			if(this.data.type === "Table"){
				this.no_of_seats.show();
			}
		}, 0)
	}

	absolute_css(prop) {
		let element = this.this;
    	var top = 0, left = 0;
		do {
			top += element.offsetTop  || 0;
			left += element.offsetLeft || 0;
			element = element.offsetParent;
		} while(element);

		return {
			top: top,
			left: left
		}[prop];
	};

	template(){
		const block_class = !RM.can_open_order_manage(this) && this.data.type === "Table" ? " block" : "";
		const hide_class = this.data.orders_count <= 0 ? " hide" : "";

		this.indicator = new JSHtml({
			tag: "span",
			properties: {class: `order-count ${hide_class} ${block_class}`},
			content: '<span class="fa fa-cutlery" style="font-size: 12px"/> {{text}}',
			text: this.data.orders_count
		})

		this.edit_button = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-sm"},
			content: '<span class="fa fa-trash"/>'
		}).on("click", () => {
			event.stopPropagation();
			this.delete();
		});

		this.delete_button = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-sm"},
			content: '<span class="fa fa-pencil"/>'
		}).on("click", () => {
			event.stopPropagation();
			this.edit();
		});

		this.description = new JSHtml({
			tag: "span",
			properties: {class: "d-label"},
			content: "{{text}}",
			text: this.data.description
		});

		this.no_of_seats = new JSHtml({
			tag: "span",
			properties: {class: "d-table-seats"},
			content: `<span class="fa fa-user" style="font-size: 14px"/> {{text}}`,
			text: this.data.no_of_seats
		});

		return `
		${this.indicator.html()}
		${this.description.html()}
		<div class="d-toll-box" style="display: none">
			<div class="option-button">
				${this.edit_button.html()}
				${this.delete_button.html()}
			</div>
		</div>
		${this.no_of_seats.html()}`
	}

	select(){
		//event.stopPropagation();
		if (RM.editing === false) {
			this.open_modal();
			return false;
		}

		if(this.is_selected()){
			this.unselect();
		}else{
			this.set_z_index();
			RM.unselect_all_tables();
			this.this.add_class("selected").JQ().draggable({
				containment: RM.table_container_name,
				disabled: false,
				scroll: true,
				start: (event, ui) => {
					this.drag = true;
				},
				stop: (event, ui) => {
					this.save_config();
				}
			}).resizable({
				handles: "se, sw, nw, ne",
				minWidth: this.data.min_size,
				minHeight: this.data.min_size,
				start: (event, ui) => {
					this.drag = true;
				},
				stop: (event, ui) => {
					this.save_config();
				}
			});

			setTimeout(() => {
				this.this.JQ().find(".ui-resizable-ne").addClass("top right");
				this.this.JQ().find(".ui-resizable-nw").addClass("top left");
				this.this.JQ().find(".ui-resizable-sw").addClass("bottom left");
				this.this.JQ().find(".ui-resizable-se").addClass("bottom right");
			}, 0)
		}
	}

	set_z_index(){
		this.room.set_z_index();
		setTimeout(() => {
			this.css_style().zIndex = (parseInt(RM.max_z_index) + 1);
		}, 10)
	}

	open_modal(){
		if(this.data.type === "Table"){
			if(!RM.can_open_order_manage(this)){
				RM.notification("red", __("The table is assigned to another user, you can not open"));
				return;
			}
			let open = () => {
				let order_manage = `order_manage_${this.data.name}`;
				setTimeout(() => {
					if (typeof window[order_manage] == "undefined"){
						window[order_manage] = new OrderManage({
							table: this,
							identifier: order_manage,
						})
					}else{
						window[order_manage].init();
					}

					RM.current_order_manage = window[order_manage];
				}, 0)
			}

			if(typeof RM.transfer_order != "undefined"
				&& RM.transfer_order.order_manage.table_name !== this.data.name
			){
				RM.client = RM.uuid();

				CETI.api.call({
					model: "Table Order",
					name: RM.transfer_order.data.name,
					method: "transfer",
					args:{table: this.data.name, client: RM.client},
					always: (r) => {
						if(r.message){
							RM.transfer_order.order_manage.clear_current_order();
							RM.transfer_order = undefined;
						}
						RM.ready();
					},
					freeze: true
				})
			}else {
				RM.transfer_order = undefined;
				RM.ready();
				open();
			}
		}else if(this.data.type === "Production Center"){
			if(typeof RM.transfer_order != "undefined"){
				frappe.confirm(
					`${__("You are transferring an account, choose a table")}<br><br>
					<strong>${__("Do you want to cancel the transfer?")}</strong>`,
					() => {
						RM.transfer_order = undefined;
						RM.ready();
						this.open_modal();
					}
				)
				return;
			}

			const process_manage = `process_manage_${this.data.name}`;
			setTimeout(() => {
				if (typeof window[process_manage] == "undefined"){
					console.log('init new process manage');
					window[process_manage] = new ProcessManage({
						name: this.data.name,
						table: this
					})
				}else{
					console.log('init existent process manage');
					window[process_manage].init();
					window[process_manage].reload();
				}

				RM.current_process_manage = window[process_manage];
			}, 0)
		}
	}

	is_selected(){return this.this.JQ().hasClass("selected")}

	get_z_index(){return parseInt(this.css_style().zIndex)}

	delete(){
		frappe.confirm(__("Delete this Table?"), () => {
			RM.working("Deleting Object");
			CETI.api.call({
				model: "Restaurant Object",
				name: this.data.name,
				method: "_delete",
				always: () => {
                	RM.ready();
                },
                freeze: true
			})
        });
	}

	edit(){
		if(this.edit_form == null) {
			this.edit_form = new CETIForm({
				doctype: "Restaurant Object",
				docname: this.data.name,
				form_name: this.data.type === "Table"  ? "restaurant-table" : "restaurant-production-center",
				call_back: ()=> {
					this.edit_form.hide();
				},
				title: __(`Update ${this.data.type}`),
				//close_only_button: true,
				field_properties: {
					type: {read_only: true},
					room: {read_only: true}
				}
			});
		}else{
			this.edit_form.show();
		}
	}

	reset_data(data){
		this.data = data;
		this.this.self.setAttribute("style", data.css_style);
		this.description.val(this.data.description);
		this.no_of_seats.val(this.data.no_of_seats);
	}

	set_orders_count(){
		this.indicator.val(this.data.orders_count);

		if(this.data.orders_count > 0) {
			this.indicator.remove_class("hide");

			if(this.data.type === "Table") {
				if (!RM.can_open_order_manage(this)) {
					this.indicator.add_class("block");// css("background-color", RM.restrictions.color_table);
				} else {
					this.indicator.remove_class("block");
				}
			}
		}else {
			this.indicator.add_class("hide");
		}
	}
}