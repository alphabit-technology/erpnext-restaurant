TableOrder = class TableOrder{
	constructor(options) {
		Object.assign(this, options, {
			items: [],
			pending_items: [],
			queue_items: [],
			adding: false,
			edit_form: false,
			divide_account_modal: false,
			pay_form: false,
			current_item: undefined
		});
		this.button = null;
		this.seconds_count = 0;
		this.send = false;
		this.make();

		setTimeout(() => {
			window[this.data.name] = this;
			this.listener();
		}, 0)
	}

	listener(){
		frappe.realtime.on(this.data.name, (data) => {
			if(data.action === "Update"){
				this.reset_data(data);
			}else if (data.action === "Delete"){
				this.order_manage.delete_order(this.data.name);
			}else if(data.action === "Transfer"){
				if(data.table !== this.order_manage.table_name){
					this.order_manage.delete_order(this.data.name);
				}
			}
		})
		frappe.realtime.on("pos_profile_update", () => {
        	setTimeout(() => {
				this.order_manage.set_buttons_status();
			}, 0)
		})
	}

	reset_data(data){
		this.data = data.data;

		if(this.order_manage.current_order.data.name === data.data.name){
			this.render();
			this.make_items(data.items, this.current_item);
		}else{
			this.show_items_count();
		}
	}

	remove(){
		this.button.remove();

		let orders = Object.keys(this.order_manage.orders);

		orders.forEach((order) => {
			if(this.order_manage.orders[order].data.name === this.data.name){
				delete this.order_manage.orders[order];
			}
		})
	}

	make(){
		setTimeout(() => {
			if(this.button != null) this.button.remove();

			this.button = new JSHtml({
				tag: "button",
				properties: {
					class: "btn btn-app btn-lg btn-order",
					style: "width: 100%; border-radius: 0; margin-bottom: 2px"
				},
				content: `<span class='badge'>{{text}}</span>${this.data.short_name}`,
				text: this.data.items_count
			}).on("click", () => {
				if(RM.busy_message()){
					return;
				}
				this.order_manage.current_order = this;
				this.select();
			})
			this.make_html();
		}, 0)
	}

	select(via_socket = false, items = null){
		setTimeout(() => {
			this.order_manage.current_order_identifier = this.data.name;
			this.button.add_class('selected').JQ().siblings(`.btn-order.selected`).removeClass('selected');

			let load = () => {
				if(items == null){
					this.get_items()
				}else{
					this.make_items(items);
				}
			}

			if(via_socket){
				if(RM.client != null && RM.client === RM.request_client){
					load();
				}
			}else{
				load()
			}
		}, 100)
	}

	make_html(){
		$(this.order_manage.order_container()).append(`${this.button.html()}`)
	}

	queue_item(queue_item, item_updated=null){
		if(RM.busy_message()) return;

		let item = item_updated != null ? item_updated : this.push_queue_item(queue_item);

		this.seconds_count ++;

		if(flt(item.data.qty) <= 0.0){
			this.order_manage.flag_change = false;
			this.delete_item(item.data.identifier);
			this.delete_current_item();
			this.send_queue_items(this.seconds_count, "delete");
		}else{
			this.make_items(this.items_data(), item);

			setTimeout(() => {
				if(this.send === false){
					this.test_to_send(this.seconds_count);
				}else{
					this.send = true;
				}
			}, 0)
		}
	}

	test_to_send(counter){
		let saving = typeof window.saving == "undefined" ? false : window.saving;
		setTimeout(() => {
			if(this.seconds_count === counter && !saving && !RM.busy_message()){
				this.send_queue_items(counter);
				this.send = false;
				return;
			}
			this.test_to_send(counter);
		}, 500)
	}

	send_queue_items(counter, action="update"){
		RM.working("Calculating", action === "delete", true);

		this.order_manage.components.Total.val("Calculating");
		this.order_manage.components.Tax.val("Calculating");

		window.saving = true;
		CETI.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "set_queue_items",
			args: {all_items: this.items_data()},
			always: () => {
				window.saving = false;
				RM.ready();
			},
		})
	}

	has_queue_items(){
		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];
			if(item.data.status === 'Pending') {
				return true;
			}
		})
		return false;
	}

	push_queue_item(queue_item){
		let item = null, exist = false;
		Object.keys(this.items).forEach((index) => {
			item = this.items[index];
			if(queue_item.item_code === item.data.item_code){
				if(item.data.status === this.data.attending_status || 
					item.data.status === "Pending" || item.data.status === ""
				){
					item.data.status = "Pending";
					item.data.qty = (item.data.qty + queue_item.qty);
					item.data.amount = (item.data.qty * item.data.rate);
					item.data.status_color = "red";
					item.data.status_icon = "fa fa-cart-arrow-down";

					exist  = true;
				}
			}
		})

		if(exist) return item;

		this.items[queue_item.identifier] = new OrderItem(
			Object.assign({
				identifier: queue_item.identifier,
				order: this,
				data: queue_item
			})
		)

		return this.items[queue_item.identifier];
	}

	render(){
		this.show_items_count();
		this.totalice();
	}

	totalice(){
		let tax = RM.format_currency(this.data.tax);
		let amount = RM.format_currency(this.data.amount);

		this.order_manage.components.Tax.val(`${__("Tax")}: ${tax}`);
		this.order_manage.components.Total.val(`${__("Total")}: ${amount}`);
	}

	make_items(items=[], current=null){
		this.items = {};

		items.forEach((item, index) => {
			if (typeof this.items[item.identifier] == "undefined"){
				this.items[item.identifier] = new OrderItem(
					Object.assign({
						identifier: item.identifier,
						order: this,
						data: item
					})
				)
			} else {
				this.get_item(item.identifier).data = item;
			}

			this.get_item(item.identifier).order = this;

			if(index === 0) this.current_item = this.get_item(item.identifier);
		})

		if(current != null) this.current_item = this.get_item(current.data.identifier);

		setTimeout(() => {
			this.render_items()
			this.order_manage.set_buttons_status();
			if(this.items_count() === 0){
				this.order_manage.set_editor_status()
			}
		}, 0)
	}

	get_item(identifier){
		return this.items[identifier]
	}

	check_item(item){
		if(Object.keys(this.items).includes(item.identifier)){
			let _item = this.items[item.identifier];

			_item.data.status = item.status;
			_item.data.status_color = item.process_status_data.color;
			_item.data.status_icon = item.process_status_data.icon;

			this.make_items(this.items_data(), this.current_item);
		}
	}

	items_count(){
		return Object.keys(this.items).length;
	}

	items_data(){
		let items = [];
		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];
			items.push(item.data);
		})
		return items;
	}

	render_items() {
		$(this.order_manage.order_entry_container()).empty().append(
			this.items_count() > 0 ? "" : this.empty_cart()
		);

		Object.keys(this.items).forEach((item) => {
			this.items[item].render();
		})

		setTimeout(() => {
			if( typeof this.current_item != "undefined") {
				this.current_item.select();
			}
		}, 10)
	}

	get_items(){
		RM.working(__("Loading items in") + ": " + this.data.name);
		CETI.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "get_items",
			always: (r) => {
				RM.ready();
				if(typeof r.message != "undefined") {
					this.data = r.message.data;
					this.render();
					this.make_items(r.message.items);
				}
			},
		})
	}

	delete(){
		if(RM.busy_message()) {
			return;
		}

		RM.working("Deleting Order");
		CETI.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "_delete",
			always: () => {
				RM.ready();
			},
		})
	}

	show_items_count(){
		this.button.val(this.data.items_count);
	}

	divide(){
		if(this.divide_account_modal === false){
			this.divide_account_modal = new CETIModal({
				"model": "Table Order",
				"model_name": this.data.name,
				"action": "divide_template",
				"full_page": true,
				"from_server": true,
				"customize": true,
				"adjust_height": 25,
				"title": `<strong>${this.data.name}</strong> ${__("Divide Account")}`,
				"call_back": () => {
					this.make_divide_account();
				}
			});
		}else{
			this.divide_account_modal.show();
			this.divide_account_modal.reload(() => {
				this.make_divide_account();
			})
		}
	}

	transfer(){
		RM.working("Transferring Order");
		RM.transfer_order = this;
		this.order_manage.close();
	}

	make_divide_account(){
		new JSHtml({
			tag: "button",
			wrapper: this.divide_account_modal.title_container(),
			properties: {
				class: "btn btn-default btn-flat",
				style: "background-color: rgba(119,136,153,0.64); color: white"
			},
			content: "<span class='fa fa-reply'/> {{text}}",
			text: ` ${this.data.name} (${__("Divide Account")})`
		}).on("click", () => {this.divide_account_modal.hide()}, "")

		new JSHtml({
			tag: "button",
			wrapper: this.divide_account_modal.buttons_container(),
			properties: {class: "btn btn-default btn-flat"},
			content: "<span class='fa fa-check'/> {{text}}",
			text: __("Divide")
		}).on("click", () => {this._divide()}, "double_click")

		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];

			item.in_current_order = item.data.qty;
			item.in_new_order = 0;

			let item_base_name = `${this.data.name}-${item.data.entry_name}`;

			let adds = document.getElementsByClassName(`${item_base_name}-add-item`);

			Object.keys(adds).forEach((key) => {
				let add = adds[key];
				add.addEventListener("click", () => {
					event.stopPropagation();

					if (item.in_current_order > 0) {
						item.in_current_order--;
						item.in_new_order++;

						this.set_values_in_divide_modal(
							item_base_name,
							{
								"from_qty": item.in_current_order,
								"to_qty": item.in_new_order,
								"rate": item.data.rate,
							}
						)
					}
				})
			})

			let all_minus = document.getElementsByClassName(`${item_base_name}-minus-item`);

			Object.keys(all_minus).forEach((key) => {
				let minus = all_minus[key];
				minus.addEventListener("click", () => {
					event.stopPropagation();
					if (item.in_new_order > 0) {
						item.in_current_order++;
						item.in_new_order--;

						this.set_values_in_divide_modal(
							item_base_name,
							{
								"from_qty": item.in_current_order,
								"to_qty": item.in_new_order,
								"rate": item.data.rate,
							}
						)
					}
				});
			})
		})

		this.set_totalize_in_divide_modal();
	}

	set_values_in_divide_modal(base_name, data={}){
		$(`.${base_name}-from-qty`).empty().append(data.from_qty);
		$(`.${base_name}-to-qty`).empty().append(data.to_qty);

		$(`.${base_name}-from-total`).empty().append(
			RM.format_currency(parseFloat(data.from_qty) * parseFloat(data.rate))
		);
		$(`.${base_name}-to-total`).empty().append(
			RM.format_currency(parseFloat(data.to_qty) * parseFloat(data.rate))
		);

		this.set_totalize_in_divide_modal();
	}

	set_totalize_in_divide_modal(){
		let total_left = 0, total_right = 0;
		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];

			total_left += (item.in_current_order * item.data.rate);
			total_right += (item.in_new_order * item.data.rate);

			$(`.${this.data.identifier}-grand-total-left`).empty().append(
				RM.format_currency(total_left)
			);

			$(`.${this.data.identifier}-grand-total-right`).empty().append(
				RM.format_currency(total_right)
			);
		})
	}

	_divide(){
		let update_data = {};

		if(RM.busy_message()){
			return;
		}

		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];

			if(item.in_new_order > 0){
				update_data[item.data.identifier] = {
					'name': item.data.entry_name,
					'qty': item.in_new_order,
					'identifier': "entry_" + RM.uuid()
				};
			}
		})

		if(Object.keys(update_data).length) {
			RM.working("Dividing Account");
			RM.client = RM.uuid();
			CETI.api.call({
				model: "Table Order",
				name: this.data.name,
				method: "divide",
				args:{"items": update_data, client: RM.client},
				always: (r) => {
					RM.ready();
					if(typeof r.message != "undefined"){
						this.divide_account_modal.hide();
					}
				},
			})
		}else{
			frappe.msgprint(__('You have not selected products'))
		}
	}

	order(){
		if(RM.busy_message()){
			return;
		}

		if(this.data.products_not_ordered <= 0){
			return;
		}

		RM.working("Send order to Prepare");

		CETI.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "send",
			always: (r) => {
				this.order_manage.components.Order.remove_class("btn-warning");
				RM.ready(false, "success");
				this.data = r.message.data;
				this.render();
				this.make_items(r.message.items);
			},
		})
	}

	amount(){
		return isNaN(parseFloat(this.data.amount)) ? 0 : parseFloat(this.data.amount);
	}

	total_money(){
		return RM.format_currency(this.amount());
	}

	pay(){
		if(!RM.can_pay()) return;
		if(RM.pos_profile == null){
			frappe.msgprint(RM.not_has_pos_profile_message());
		}else if(RM.pos_profile.payments.length === 0){
			frappe.msgprint(__("There are no configured payment methods"));
		}else{
			if (this.pay_form === false) {
				this.pay_form = new PayForm({
					order: this
				})
			}else{
				this.pay_form.reload();
			}
		}
	}

	print_account(){
		window.open(`printview?doctype=Table%20Order&name=${this.data.name}&trigger_print=1&no_letterhead=0`, '_blank');
	}

	empty_cart(){
		return `
		<div class="col-md-12" style="color: rgba(119,136,153,0.45)">
			<div class="col-md-12" style="font-size: 5em; text-align: center !important;">
				<span class="fa fa-shopping-cart"/><br>
			</div>
			<div class="col-md-12" style="font-size: 25px; text-align: center">
				<em>${__('No added items')}</em>
			</div>
		</div>`
	}

	edit() {
		if(RM.busy_message()){
			return;
		}

		if (this.edit_form === false) {
			this.edit_form = new CETIForm({
				doctype: "Table Order",
				docname: this.data.name,
				form_name: "restaurant-order",
				call_back: () => {
					this.edit_form.hide();
					RM.sound_submit();
					this.data.customer = this.edit_form.form.get_value("customer");

					console.log(this.edit_form.form.get_value("customer"));
				},
				title: __("Update Order"),
			});
		} else {
			this.edit_form.reload();
			this.edit_form.show();
		}
	}

	delete_current_item(){
		this.current_item = undefined;
		this.order_manage.empty_inputs();
		this.order_manage.set_buttons_status();
	}

	delete_item(item){
		for(let i in this.items){
			if(this.items.hasOwnProperty(i)) {
				if(this.items[i].data.identifier === item){
					delete this.items[i];
					break;
				}
			}
		}
	}
}