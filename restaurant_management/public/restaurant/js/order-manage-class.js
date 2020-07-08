OrderManage = class OrderManage {
	constructor(options) {
		Object.assign(this, options, {
			items: {},
			modal: null,
			orders: {},
			current_order: undefined,
			order_attempts: 0,
			delete_attempts: 0,
			transfer_order: false
		});
		this.components = {};
		this.objects = {};
		this.num_pad = undefined;
		this.transferring_order = false;
		this.table_name = this.table.data.name;
		this.order_container_name = `order-container-${this.table_name}`;
		this.order_entry_container_name = `container-order-entry-${this.table_name}`;
		this.editor_container_name = `edit-container-${this.table_name}`;
		this.pad_container_name = `pad-container-${this.table_name}`;
		this.item_container_name = `items-container-${this.table_name}`;

		this.creating = false;
		this.initialize();
	}

	order_container(){return document.getElementById(this.order_container_name)}
	order_entry_container(){return document.getElementById(this.order_entry_container_name)}

	reload(){
		this.modal.load_data();
	}

	initialize(){
	    this.title = this.table.room.data.description + " (" + this.table.data.description + ")";
		this.modal = new CETIModal({
			"full_page": true,
			"customize": true,
			"title": this.title,
			"call_back": () => {
				this.make();
			}
		});
	}

	make(){
		this.make_dom();
		this.get_orders();
		this.make_items();
		this.make_edit_input();
		this.make_pad();
		if(this.transferring_order && typeof this.current_order != "undefined"){
			this.current_order.edit_form = false;
			this.current_order.divide_account_modal = false;
			this.current_order.pay_form = false;
			this.transferring_order = false;
		}
	}

	is_open(){
		return this.modal.modal.display
	}

	make_dom(){
		this.modal.container().append(this.template());

		this.components.new = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-flat"},
			content: "<span class='fa fa-plus'/> {{text}}",
			text: __("New")
		}).on("click", () => {this.add_order()}, "double_click")

		this.components.edit = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-flat"},
			content: "<span class='fa fa-pencil'/> {{text}}",
			text: __("Edit")
		}).on("click", () => {this.update_current_order()})

		this.components.delete = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-flat"},
			content: "<span class='fa fa-trash'/> {{text}}",
			text: __("Delete")
		}).on("click", () => {this.delete_current_order()}, "double_click")

		this.modal.title_container().empty().append(
			new JSHtml({
				tag: "button",
				properties: {
					class: "btn btn-default btn-flat",
					style: "background-color: rgba(119,136,153,0.64); color: white"
				},
				content: "<span class='fa fa-reply'/> {{text}}",
				text: this.title
			}).on("click", () => {
				this.modal.hide()
			}).html()
		)

		this.modal.buttons_container().prepend(`
			${this.components.delete.html()}
			${this.components.edit.html()}
			${this.components.new.html()}
		`)
	}

	template(){
		return `
		<div class="order-manage">
			<table class="layout-table">
				<tr class="content-row">
					<td>
						<div class="order-container" id="${this.order_container_name}"></div>
					</td>
					<td class="erp-items" style="width: 100%">
						<div class="content-container">
							<div class="product-list" id = "${this.item_container_name}" style="height: 100%">
							<div class="col-md-12" style="color: rgba(119,136,153,0.45)">
							
							</div>
						</div>
					</td>
					<td class="container-order-items">
						<div class="panel-order-items">
							<ul class="products-list" id="${this.order_entry_container_name}">
								${this.not_selected_order()}
							</ul>
						</div>
						<table class="table-condensed panel-order-edit" id ="${this.editor_container_name}">
						
						</table>
						<table class="order-manage-control-buttons pad-container" id="${this.pad_container_name}">
						
						</table>
					</td>
				</tr>
			</table>
		</div>`
	}

	not_selected_order(){
		return `
		<div class="col-md-12" style="color: rgba(119,136,153,0.45)">
			<div class="col-md-12" style="font-size: 5em; text-align: center !important;">
				<span class="fa fa-shopping-cart"/><br>
			</div>
			<div class="col-md-12" style="font-size: 25px; text-align: center">
				<em>${__('Select or create an Order')}</em>
			</div>
		</div>`
	}

	in_objects(f){
		Object.keys(this.objects).forEach((key) => {
			f(this.objects[key])
		})
	}

	empty_inputs(){
		this.in_objects((object) => {
			if(object.tag === "input"){
				object.val("", false);
			}
		})
	}

	make_edit_input(){
		const default_class = `input input-edit-values input-with-feedback center`;

		let objs = [
			{
				name: "Minus",
				tag: 'button',
				properties: {name: 'minus', class: `btn btn-default edit-button ${default_class}`},
				content: '<span class="fa fa-minus">',
				on: {'click': () => {
					if(typeof this.num_pad.input != "undefined"){
						event.stopPropagation();
						if(!this.num_pad.input.is_disabled()){
							this.num_pad.input.minus();
						}
					}
				}}
			},
			{
				name: "Qty",
				tag: 'input', label: 'Qty',
				properties: {name: 'qty', type: 'text', class: default_class},
				on: {'click': (obj, input) => {
					event.stopPropagation();
					this.num_pad.input = obj
				}}
			},
			{
				name: "Discount",
				tag: 'input', label: 'Discount',
				properties: {name: 'discount', type: 'text', class: default_class},
				on: {'click': (obj, input) => {
					event.stopPropagation();
					this.num_pad.input = obj
				}}
			},
			{
				name: "Rate",
				tag: 'input', label: 'Rate',
				properties: {name: 'rate', type: 'text', class: default_class},
				on: {'click': (obj, input) => {
					event.stopPropagation();
					this.num_pad.input = obj
				}}
			},
			{
				name: "Plus",
				tag: 'button',
				properties: {name: 'plus', class: `btn btn-default edit-button ${default_class}`},
				content: '<span class="fa fa-plus">',
				on: {'click': (obj, element, event) => {
					if(typeof this.num_pad.input != "undefined"){
						event.stopPropagation();
						if(!this.num_pad.input.is_disabled()){
							this.num_pad.input.plus();
						}
					}
				}}
			},
			{
				name: "Trash",
				tag: 'button',
				properties: {name: 'trash', class: `btn btn-default edit-button ${default_class}`},
				content: '<span class="fa fa-trash">',
				on: {
					'click': () => {
						event.stopPropagation();
						if(RM.check_permissions("pos", null, "delete")){
							this.current_order.current_item.delete();
						}else{
							frappe.msgprint(__("You do not have permissions to delete Items"));
						}
					}
				}
			}
		]

		let container = "#" + this.editor_container_name;
		let base_html = "<thead><tr>";

		objs.forEach((_obj) => {
			base_html += `
			<th class="center pad-head" style="color: #5A738E; font-size: 12px; padding: 4px">
				${typeof _obj.label != "undefined" ? _obj.label : ""}
			</th>`
		});
		base_html += "</thead><tbody><tr class='edit-values'>"

		objs.forEach((element, index) => {
			base_html += `<td class='${this.table_name}-${index}'>`;

			this.objects[element.name] = new JSHtml({
				tag: element.tag,
				properties: element.properties,
				content: (typeof element.content != "undefined" ? element.content : "")
			}).on(
				Object.keys(element.on)[0], element.on[Object.keys(element.on)[0]], (element.name === "Trash" ? "double_click" : "")
			).disable();

			base_html += this.objects[element.name].html();
		})
		$(container).empty().append(base_html + "</tr></tbody>");

		this.objects.Qty.on("change", (obj) => {
			this.update_detail("qty");
		}).float();

		this.objects.Discount.on("change", (obj) => {
			this.update_detail("discount");
		}).float();

		this.objects.Rate.on("change", (obj) => {
			this.update_detail("rate");
		}).float();
	}

	update_detail(input) {
		if (RM.busy) return;

		let set_data = (item, qty, discount, rate) => {
			item.data.qty = qty;
			item.data.discount_percentage = discount;
			item.data.rate = rate;
			item.data.status = "Pending";

			if(item.row != null){
				item.row.val(item.template());
			}
		}

		if (typeof this.current_order.current_item != "undefined"){
			let current_item = this.current_order.current_item;
			if(!current_item.update_to_edit()){
				return;
			}

			let qty = flt(this.objects.Qty.val());
			let discount = flt(this.objects.Discount.val());
			let rate = flt(this.objects.Rate.val());
			let base_rate = flt(current_item.data.price_list_rate);

			if(input === "qty"){
				if(this.objects.Qty.val() === 0 && RM.check_permissions("pos", null, "delete")){
					frappe.msgprint(__("You do not have permissions to delete Items"));
					current_item.select();
					return;
				}

				set_data(current_item, qty, discount, rate);
				if(this.objects.Qty.val() !== ""){
					this.current_order.queue_item(null, current_item);
				}
			}
			if(input === "discount"){
				rate = (base_rate * (1-discount/100));
				set_data(current_item, qty, discount, rate);
				if(this.objects.Discount.val() !== ""){
					this.current_order.queue_item(null, current_item);
				}
			}
			if(input === "rate"){
				let _discount = (((base_rate-rate)/base_rate) * 100);
				discount = _discount >= 0 ? _discount : 0
				set_data(current_item, qty, discount, rate);
				if(this.objects.Rate.val() !== ""){
					this.current_order.queue_item(null, current_item);
				}
			}

		}
	}

	make_pad(){
		const default_class = `pad-col btn-default ${this.table_name}`;

		let num_pads = [
			[
				{
					name: "Pad",
					props: {class: "", rowspan: 4, style: "width: 65% !important; padding: 0"},
					action: "none"
				},
				{
					name: "Order",
					props: {class: "lg pad-btn"}, content: '<span class="fa fa-cutlery pull-right"/>',
					action: "order"
				}
			],
			[
				{
					name: "Account",
					props: {class: "lg pad-btn"}, content: '<span class="fa fa-file-o pull-right"/>',
					action: "print_account"
				}
			],
			[
				{
					name: "Divide",
					props: {class: "lg pad-btn"}, content: '<span class="fa fa-files-o pull-right"/>',
					action: "divide"
				}
			],
			[
				{
					name: "Transfer",
					props: {class: "lg pad-btn"},
					content: '<span class="fa fa-share pull-right"/>',
					action: "transfer"
				}
			],
			[
				{
					name: "Tax",
					props: {class: "lg pad-label"}, action: "none"
				},
				{
					name: "Pay",
					props: {class: "md text-lg btn-primary", rowspan: 2}, action: "pay"
				}
			],
			[
				{
					name: "Total",
					props: {class: "pad-label label-lg lg"}, action: "none"
				},
			]
		]

		let base_html = "<tbody>";
		num_pads.forEach((row) => {
			base_html += "<tr class='pad-row'>";

			row.forEach((col) => {
				col.props.class += ` ${default_class}-${col.name}`;

				this.components[col.name] = new JSHtml({
					tag: "td",
					properties: col.props,
					content: "{{text}}" + (typeof col.content == "undefined" ? "" : col.content),
					text: __(col.name)
				}).on("click", (obj, input) => {
					if(col.action !== "none"){
						if (typeof this.current_order == "undefined") {
							this.no_order_message();
							return;
						}
						if(this.current_order.has_queue_items()) {
							frappe.msgprint(__('Adding Items, please white'));
							return;
						}
						setTimeout(`window['${this.identifier}'].current_order.${col.action}()`,0)
					}
				}, ((col.action === "order" || col.action === "transfer") ? "double_click" : ""))

				base_html += this.components[col.name].html();
			})

			base_html += "</tr>";
		})
		$("#" + this.pad_container_name).empty().append(base_html + "</tbody>");

		setTimeout(() => {
			this.num_pad = new NumPad({
				wrapper: this.components.Pad.self,
			})
			setTimeout(()=>{
				this.set_buttons_status();
			})
		}, 0)


	}

	no_order_message(){
		frappe.msgprint("Not order Selected");
	}

	disable_components(){
		this.components.Order.disable().remove_class("btn-success");
		this.components.Account.disable();
		this.components.Divide.disable();
		this.components.Transfer.disable();
		this.components.Pay.disable();

		this.components.delete.disable().hide();
		this.components.edit.disable().hide();
		this.components.new.disable().hide();
	}

	set_buttons_status(){
		this.disable_components();
		if(RM.check_permissions("order", null, "create")){
			this.components.new.enable().show();
		}

		if(typeof this.current_order == "undefined") return;

		if(this.current_order.data.status !== "Invoiced") {
			if (this.current_order.items_count() === 0) {
				if (RM.check_permissions("order", this.current_order, "delete")) {
					this.components.delete.enable().show();
				}
				/*if(RM.permissions.order.delete && RM.pos_profile.allow_delete) {
					this.components.delete.enable().show();
				}*/
			} else {
				if (RM.can_pay()) {
					this.components.Pay.enable();
				}
				/*if(RM.permissions.pay){
					this.components.Pay.enable();
				}*/
			}

			//if(RM.check_permissions("Order", this.current_order, "update")){
			if(RM.check_permissions("order", this.current_order, "write")) {
				if (this.current_order.has_queue_items()) {
					this.components.Order.enable().add_class("btn-danger").val(__("Add"));
				} else {
					if (this.current_order.data.products_not_ordered > 0) {
						this.components.Order.enable().remove_class("btn-danger").add_class("btn-success").val(__("Order"));
					}
				}

				if (this.current_order.items_count() > 0) {
					this.components.Account.enable();
					this.components.Divide.enable();
				}

				this.components.edit.enable().show();
				this.components.Transfer.enable();
			}
			//}
		}
	}

	set_editor_status(item=null){/**item OrderItem class**/
		let objects = this.objects;
		if (item == null){
			this.empty_inputs();
			this.in_objects((input)=>{
				input.disable();
			})
			return;
		}
		let pos_profile = RM.pos_profile
		let data = item.data;

		objects.Qty.val(data.qty, false).prop(
			"disabled", !item.update_to_edit()
		);
		objects.Discount.val(data.discount_percentage, false).prop(
			"disabled", !item.update_to_edit() || !pos_profile.allow_user_to_edit_discount
		);
		objects.Rate.val(data.rate, false).prop(
			"disabled", !item.update_to_edit() || !pos_profile.allow_user_to_edit_rate
		);
		objects.Minus.prop("disabled", !item.update_to_edit());
		objects.Plus.prop("disabled", !item.update_to_edit());
		objects.Trash.prop("disabled", !item.update_to_edit());
	}

	make_items() {
		this.items = new ProductItem({
			wrapper: $(`#${this.item_container_name}`),
			order_manage: this,
		});
	}

	add_item(item){
		if(typeof this.current_order != "undefined"){
			this.current_order.add_item(item)
		}
	}

	queue_item(item, action="Update"){
		if(typeof this.current_order != "undefined"){
			this.current_order.queue_item(item, action)
		}
	}

	init(){
		this.modal.show();
		if(this.transferring_order){
			if(typeof this.current_order != "undefined"){
				//**To move windows over the current, on transferring order**//
				this.current_order.edit_form = false;
				this.current_order.divide_account_modal = false;
				this.current_order.pay_form = false;
			}
			this.transferring_order = false;
		}
	}

	close(){this.modal.hide()}

	add_order(){
		RM.working("Adding Order");
		RM.client = RM.uuid();
		CETI.api.call({
			model: "Restaurant Object",
			name: this.table.data.name,
			method: "add_order",
			args: {client: RM.client},
			always: (r) => {
				RM.ready();
            	if(typeof r.message != "undefined"){
            		RM.sound_submit();
            		this.make_orders(r.message.orders, r.message.order.name);
				}
			},
		})
	}

	set_new_order(data){
		this.orders = data.orders;
	}

	get_orders(current=null, via_socket=false) {
		RM.working(__("Loading Orders in") + ": " + this.title);
		if(current == null) current=this.current_order_identifier;
		CETI.api.call({
			model: "Restaurant Object",
			name: this.table.data.name,
			method: "orders_list",
			args: {},
			always: (r) => {
				RM.ready();
				this.make_orders(r.message, current, via_socket);
			},
		})
	}

	make_orders(orders=[], current=null, via_socket=false){
		let _orders = Object.keys(this.orders);

		orders.forEach((order) => {
			if (_orders.includes(order.data.name)){
				this.orders[order.data.name].data = order.data;
			} else {
				this.append_order(order, current, via_socket);
			}
		})
	}

	append_order(order, current=null, via_socket=false){
		if(typeof window[order.data.name] != "undefined"){
			window[order.data.name].order_manage = this;
			window[order.data.name].data = order.data;

			this.orders[order.data.name] = window[order.data.name];
			this.orders[order.data.name].make();
		}else{
			this.orders[order.data.name] = new TableOrder({
				order_manage: this,
				data: order.data
			})
		}

		setTimeout(() => {
			if(via_socket){
				if(current != null){
					if(RM.client != null && RM.client === RM.request_client) {
						this.current_order = this.orders[current];
					}
				}
			}else{
				this.current_order = this.orders[current];
			}

			if(typeof this.current_order != "undefined"){
				this.current_order.select(via_socket);
			}
		}, 0)
	}

	delete_current_order(){
		if(typeof this.current_order != "undefined"){
			this.current_order.delete();
		}
	}

	update_current_order(){
		if(typeof this.current_order != "undefined"){
			this.current_order.edit();
		}
	}

	clear_current_order(){
		if(typeof this.current_order != "undefined"){
			this.components.Tax.val(`${__("Tax")}: ${RM.format_currency(0)}`);
			this.components.Total.val(`${__("Total")}: ${RM.format_currency(0)}`);
			this.delete_order(this.current_order.data.name);
		}
	}

	delete_order(order_name){
		let order = this.orders[order_name];
		if(typeof order != "undefined"){
			if(typeof this.current_order != "undefined"){
				if(order_name === this.current_order.data.name){
					$(`#${this.order_entry_container_name}`).empty().append(this.not_selected_order());
					this.current_order = undefined;
				}
			}

			order.remove();
			this.set_buttons_status();
		}

	}
}

function props_by_json(props, props_add = {}){
	let _html = "";
	for(let prop in props) {
		if(!props.hasOwnProperty(prop)) continue;
		_html += `${prop}='${props[prop]}'`;
	}
	return _html;
}