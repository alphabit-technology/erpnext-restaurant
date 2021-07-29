OrderManage = class OrderManage {
    #objects = {};
    #components = {};
    #items = {};
    #orders = {};
    #numpad = null;

    constructor(options) {
        Object.assign(this, options);
        this.modal = null;
        this.print_modal = null;
        this.current_order = null;
        this.transferring_order = false;
        this.table_name = this.table.data.name;
        this.order_container_name = `order-container-${this.table_name}`;
        this.order_entry_container_name = `container-order-entry-${this.table_name}`;
        this.editor_container_name = `edit-container-${this.table_name}`;
        this.pad_container_name = `pad-container-${this.table_name}`;
        this.item_container_name = `items-container-${this.table_name}`;
        this.not_selected_order = null;
        this.init_synchronize();
        this.initialize();
    }

    get objects(){ return this.#objects}
    get components(){ return this.#components}
    get items(){ return this.#items}
    get orders(){ return this.#orders}
    get numpad(){ return this.#numpad}

    init_synchronize() {
        frappe.realtime.on("pos_profile_update", () => {
            setTimeout(() => {
                this.check_buttons_status();
            }, 0)
        });
    }

    get_container() {
        return document.getElementById(this.identifier);
    }

    order_container() {
        return document.getElementById(this.order_container_name);
    }

    order_entry_container() {
        return document.getElementById(this.order_entry_container_name);
    }

    reload() {
        if (!this.is_enabled_to_open()) return;
        this.modal.load_data();
    }

    initialize() {
        if (!this.is_enabled_to_open()) return;
        this.title = this.table.room.data.description + " (" + this.table.data.description + ")";
        this.modal = RMHelper.default_full_modal(
            this.title,
            () => {
                this.make();
            }
        );
    }

    is_enabled_to_open() {
        if (!RM.can_open_order_manage(this.table)) {
            this.close();
            return false;
        }
        return true;
    }

    show() {
        if (!this.is_enabled_to_open()) return;
        this.modal.show();
        if (this.transferring_order) {
            if (this.current_order != null) {
                //**To move windows over the current, on transferring order**//
                this.current_order.edit_form = null;
                this.current_order.divide_account_modal = null;
                this.current_order.pay_form = null;
            }
            this.transferring_order = false;
        }
    }

    close() {
        this.modal.hide()
    }

    make() {
        this.make_dom();
        this.get_orders();
        this.make_items();
        this.make_edit_input();
        this.make_pad();
        if (this.transferring_order && this.current_order != null) {
            this.current_order.edit_form = null;
            this.current_order.divide_account_modal = null;
            this.current_order.pay_form = null;
            this.transferring_order = null;
        }
    }

    is_open() {
        return this.modal.modal.display
    }

    make_dom() {
        this.empty_carts = frappe.jshtml({
            tag: 'div',
            content: RMHelper.no_data('No added items'),
            properties: {
                class: 'empty-carts',
                /*style: 'display: none'*/
            }
        });

        this.not_selected_order = frappe.jshtml({
            tag: 'div',
            properties: {class: "no-order-message"},
            content: RMHelper.no_data('Select or create an Order')
        });

        this.modal.container.append(this.template());

        this.#components.new = RMHelper.default_button("New", 'add', () => this.add_order(), DOUBLE_CLICK);
        this.#components.edit = RMHelper.default_button("Edit", 'edit', () => this.update_current_order());
        this.#components.delete = RMHelper.default_button("Delete", 'trash', () => this.delete_current_order(), DOUBLE_CLICK);

        this.modal.title_container.empty().append(
            RMHelper.return_main_button(this.title, () => this.modal.hide()).html()
        )

        this.modal.buttons_container.prepend(`
			${this.components.delete.html()}
			${this.components.edit.html()}
			${this.components.new.html()}
		`);
    }

    template() {
        return `
		<div class="order-manage" id="${this.identifier}">
			<table class="layout-table">
				<tr class="content-row">
					<td>
						<div class="order-container" id="${this.order_container_name}"></div>
					</td>
					<td class="erp-items" style="width: 100%">
						<div class="content-container">
							<div class="product-list" id = "${this.item_container_name}" style="height: 100%">
							<div class="col-md-12">
							
							</div>
						</div>
					</td>
					<td class="container-order-items">
						<div class="panel-order-items">
							<ul class="products-list" id="${this.order_entry_container_name}">
								
							</ul>
							${this.empty_carts.html()}
							${this.not_selected_order.html()}
						</div>
						<table class="table no-border table-condensed panel-order-edit" id ="${this.editor_container_name}">
						
						</table>
						<table class="table no-border order-manage-control-buttons pad-container" id="${this.pad_container_name}">
						
						</table>
					</td>
				</tr>
			</table>
		</div>`
    }

    in_objects(f) {
        Object.keys(this.objects).forEach((key) => {
            f(this.objects[key])
        });
    }

    empty_inputs() {
        this.in_objects((object) => {
            if (object.tag === "input") {
                object.val("", false);
            }
        });
    }

    make_edit_input() {
        const default_class = `input input-edit-values input-with-feedback center`;

        let objs = [
            {
                name: "Minus",
                tag: 'button',
                properties: {name: 'minus', class: `btn btn-default edit-button ${default_class}`},
                content: '<span class="fa fa-minus">',
                on: {
                    'click': () => {
                        if (this.num_pad.input && !this.num_pad.input.is_disabled) {
                            this.num_pad.input.minus();
                        }
                    }
                }
            },
            {
                name: "Qty",
                tag: 'input', label: 'Qty',
                properties: {name: 'qty', type: 'text', class: default_class},
                on: {
                    'click': (obj) => {
                        this.num_pad.input = obj;
                    }
                }
            },
            {
                name: "Discount",
                tag: 'input', label: 'Discount',
                properties: {name: 'discount', type: 'text', class: default_class},
                on: {
                    'click': (obj) => {
                        this.num_pad.input = obj;
                    }
                }
            },
            {
                name: "Rate",
                tag: 'input', label: 'Rate',
                properties: {name: 'rate', type: 'text', class: default_class},
                on: {
                    'click': (obj) => {
                        this.num_pad.input = obj;
                    }
                }
            },
            {
                name: "Plus",
                tag: 'button',
                properties: {name: 'plus', class: `btn btn-default edit-button ${default_class}`},
                content: '<span class="fa fa-plus">',
                on: {
                    'click': () => {
                        if (this.num_pad.input && !this.num_pad.input.is_disabled) {
                            this.num_pad.input.plus();
                        }
                    }
                }
            },
            {
                name: "Trash",
                tag: 'button',
                properties: {name: 'trash', class: `btn btn-default edit-button ${default_class}`},
                content: '<span class="fa fa-trash">',
                on: {
                    'click': () => {
                        let current_item =  this.current_order ? this.current_order.current_item : null;

                        if (current_item != null){
                            if(current_item.is_enabled_to_delete){
                                current_item.delete();
                            }else{
                                frappe.msgprint(__("You do not have permissions to delete Items"));
                            }
                        }
                    }
                }
            }
        ];

        let container = "#" + this.editor_container_name;
        let base_html = "<thead><tr>";

        objs.forEach((_obj) => {
            base_html += `
			<th class="center pad-head" style="font-size: 12px; padding: 4px">
				${typeof _obj.label != "undefined" ? _obj.label : ""}
			</th>`
        });
        base_html += "</thead><tbody><tr class='edit-values'>";

        objs.forEach((element, index) => {
            base_html += `<td class='${this.table_name}-${index}'>`;

            this.#objects[element.name] = frappe.jshtml({
                tag: element.tag,
                properties: element.properties,
                content: (typeof element.content != "undefined" ? element.content : "")
            }).on(
                Object.keys(element.on)[0], element.on[Object.keys(element.on)[0]], (element.name === "Trash" ? DOUBLE_CLICK : "")
            ).disable();

            base_html += this.objects[element.name].html();
        });
        $(container).empty().append(base_html + "</tr></tbody>");

        this.#objects.Qty.float();
        this.#objects.Discount.float();
        this.#objects.Rate.float();
    }

    update_detail(input) {
        if (RM.busy) return;

        let set_data = (item, qty, discount, rate) => {
            if (input.val() !== "") {
                item.data.qty = qty;
                item.data.discount_percentage = discount;
                item.data.rate = rate;
                item.data.status = "Pending";
                item.update();
                if (qty > 0) {
                    item.select();
                }
            }
        }

        if (this.current_order != null && this.current_order.current_item != null) {
            let current_item = this.current_order.current_item;
            if (!current_item.is_enabled_to_edit) {
                return;
            }

            let qty = parseFloat(this.objects.Qty.val());
            let discount = parseFloat(this.objects.Discount.val());
            let rate = parseFloat(this.objects.Rate.val());
            let base_rate = parseFloat(current_item.data.price_list_rate);

            if (input.properties.name === "qty") {
                if (input.val() === 0 && current_item.is_enabled_to_delete) {
                    frappe.msgprint(__("You do not have permissions to delete Items"));
                    current_item.select();
                    return;
                }
                set_data(current_item, qty, discount, rate);
            }
            if (input.properties.name === "discount") {
                rate = (base_rate * (1 - discount / 100));
                set_data(current_item, qty, discount, rate);
            }
            if (input.properties.name === "rate") {
                let _discount = (((base_rate - rate) / base_rate) * 100);
                discount = _discount >= 0 ? _discount : 0
                set_data(current_item, qty, discount, rate);
            }
        }
    }

    make_pad() {
        const default_class = `pad-col ${this.table_name}`;
        this.orders_count_badge = frappe.jshtml({
            tag: 'span',
            properties: {class: 'badge', style: 'font-size: 12px'},
            content: "{{text}}",
            text: 0
        });

        let num_pads_components = [
            [
                [
                    {
                        name: "Pad",
                        props: {class: "", rowspan: 4, style: "width: 65% !important; padding: 0"},
                        action: "none"
                    },
                    {
                        name: "Order",
                        props: {class: "lg pad-btn btn-success btn-order"},
                        content: `<span class="fa fa-cutlery pull-right"/>`,
                        action: "order"
                    }
                ]
            ],
            [
                [
                    {
                        name: "Account",
                        props: {class: "lg pad-btn"}, content: '<span class="fa fa-file-o pull-right"/>',
                        action: "print_account"
                    }
                ]
            ],
            [
                [
                    {
                        name: "Divide",
                        props: {class: "lg pad-btn"}, content: '<span class="fa fa-files-o pull-right"/>',
                        action: "divide"
                    }
                ]
            ],
            [
                [
                    {
                        name: "Transfer",
                        props: {class: "lg pad-btn"},
                        content: '<span class="fa fa-share pull-right"/>',
                        action: "transfer"
                    }
                ]
            ],
            [
                [
                    {
                        name: "Tax",
                        props: {class: "pad-label lg", style: "padding-top: 3px;"}, action: "none"
                    },
                    {
                        name: "Pay",
                        props: {class: "md pay-btn text-lg btn-primary", rowspan: 2}, action: "pay"
                    },
                ],
                {
                    style: "height: 10px;"
                }
            ],
            [
                [
                    {
                        name: "Total",
                        props: {class: "pad-label label-lg lg"}, action: "none"
                    }
                ],
                {
                    style: "height: 15px;"
                }
            ]
        ];

        let base_html = "<tbody>";
        num_pads_components.forEach((row) => {
            let props = typeof row[1] != "undefined" ? row[1] : {};
            base_html += `<tr style='${typeof props["style"] != "undefined" ? props["style"] : ""}'>`;

            row[0].forEach((col) => {
                col.props.class += ` ${default_class}-${col.name}`;
                this.#components[col.name] = frappe.jshtml({
                    tag: "td",
                    properties: col.props,
                    content: "{{text}}" + (typeof col.content == "undefined" ? "" : col.content),
                    text: __(col.name) + (["Tax", "Total"].includes(col.name) ? ": " + RM.format_currency(0) : "")
                }).on("click", () => {
                    if (col.action !== "none") {
                        if (this.current_order == null) {
                            this.no_order_message();
                            return;
                        }
                        if (this.current_order.has_queue_items()) {
                            frappe.msgprint(__('Adding Items, please white'));
                            return;
                        }
                        setTimeout(`RM.object('${this.identifier}').current_order.${col.action}()`, 0);
                    }
                }, (["order", "transfer"].includes(col.action) ? DOUBLE_CLICK : ""));

                base_html += this.components[col.name].html();
            });

            base_html += "</tr>";
        });
        $("#" + this.pad_container_name).empty().append(base_html + "</tbody>");

        setTimeout(() => {
            this.num_pad = new NumPad({
                wrapper: this.components.Pad.obj,
                on_enter: () => {
                    if (this.num_pad.input && !this.num_pad.input.is_disabled) {
                        this.update_detail(this.num_pad.input);
                    }
                }
            });
            setTimeout(() => {
                this.check_buttons_status();
            }, 0);
        }, 0);
    }

    is_same_order(order = null) {
        return this.current_order && order && this.current_order.data.name === order.data.name;
    }

    no_order_message() {
        frappe.msgprint("Not order Selected");
    }

    in_components(f) {
        Object.keys(this.components).forEach(k => {
            if (typeof this.#components[k] != "undefined") {
                f(this.components[k], k);
            }
        });
    }

    reset_order_button(){
        this.#components.Order.set_content(
            `<span class="fa fa-cutlery pull-right"/>${__('Order')}{{text}}`
        ).reset_confirm();
    }

    disable_components() {
       this.reset_order_button();
        this.in_components((component, k) => {
            if (!["Pad", "Tax", "Total"].includes(k)) {
                component.disable();
                if (["delete", "edit", "new", "new_order"].includes(k)) {
                    component.hide();
                }
            }
        });
    }

    check_buttons_status() {
        if (this.current_order == null) {
            this.disable_components();
            this.#components.new.enable().show();
            if (typeof this.components.new_order != "undefined")
                this.#components.new_order.enable().show();
            return;
        } else {
            if (RM.check_permissions("order", null, "create")) {
                this.#components.new.enable().show();
                if (typeof this.components.new_order != "undefined")
                    this.#components.new_order.enable().show();
            } else {
                this.#components.new.disable().hide();
                if (typeof this.components.new_order != "undefined")
                    this.#components.new_order.disable().hide();
            }
        }

        if (this.current_order.data.status !== "Invoiced") {
            if (this.current_order.items_count() === 0) {
                if (RM.check_permissions("order", this.current_order, "delete")) {
                    this.#components.delete.enable().show();
                } else {
                    this.#components.delete.disable().hide();
                }
            } else {
                this.#components.delete.disable().hide();
                this.#components.Pay.prop("disabled", !RM.can_pay);
            }

            if (RM.check_permissions("order", this.current_order, "write")) {
                if (this.current_order.has_queue_items()) {
                    this.#components.Order.enable().add_class("btn-danger").val(__("Add"));
                } else {
                    let orders_count = this.current_order.data.products_not_ordered;

                    if (orders_count > 0) {
                        this.orders_count_badge.val(""+orders_count+"");
                        this.#components.Order.set_content(
                            `<span class="fa fa-cutlery pull-right"/>${__('Order')}${this.orders_count_badge.html()}{{text}}`
                        ).enable();
                    } else {
                        this.#components.Order.set_content(
                            `<span class="fa fa-cutlery pull-right"/>${__('Order')}{{text}}`
                        ).disable();
                    }
                }

                this.#components.Divide.prop("disabled", this.current_order.items_count() === 0);
                this.#components.edit.enable().show();
                this.#components.Transfer.enable();
            } else {
                this.#components.edit.disable().hide();
                this.#components.Transfer.disable();
                this.#components.Order.disable();
                this.#components.Divide.disable();
            }
        } else {
            this.disable_components();
        }

        this.#components.Account.prop(
            "disabled",
            !RM.check_permissions("order", this.current_order, "print") || this.current_order.items_count() === 0
        );
    }

    check_item_editor_status(item = null) {
        /**item OrderItem class**/
        let objects = this.#objects;
        if (item == null) {
            this.empty_inputs();
            this.in_objects((input) => {
                input.disable();
            });
            return;
        }
        let pos_profile = RM.pos_profile
        let data = item.data;
        let item_is_enabled_to_edit = item.is_enabled_to_edit;

        objects.Qty.prop(
            "disabled", !item_is_enabled_to_edit
        ).val(data.qty, false);
        objects.Discount.prop(
            "disabled", !item_is_enabled_to_edit || !pos_profile.allow_discount_change
        ).val(data.discount_percentage, false);
        objects.Rate.prop(
            "disabled", !item_is_enabled_to_edit || !pos_profile.allow_rate_change
        ).val(data.rate, false);
        objects.Minus.prop("disabled", !item_is_enabled_to_edit);
        objects.Plus.prop("disabled", !item_is_enabled_to_edit);
        objects.Trash.prop("disabled", !item.is_enabled_to_delete);
    }

    make_items() {
        this.#items = new ProductItem({
            wrapper: $(`#${this.item_container_name}`),
            order_manage: this,
        });
    }

    add_order() {
        RM.working("Adding Order");
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "add_order",
            args: {client: RM.client},
            always: (r) => {
                RM.ready();
                if (typeof r.message != "undefined") {
                    RM.sound_submit();
                }
            },
        });
    }

    get_orders(current = null) {
        RM.working(__("Loading Orders in") + ": " + this.title);
        if (current == null) current = this.current_order_identifier;
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "orders_list",
            args: {},
            always: (r) => {
                RM.ready();
                this.make_orders(r.message, current);
            },
        });
    }

    in_orders(f) {
        let index = 0;
        Object.keys(this.orders).forEach((k) => {
            f(this.orders[k], k, index);
            index++;
        });
    }

    check_permissions_status() {
        this.is_enabled_to_open();
        this.in_orders(order => {
            order.button.content = order.content;
            order.button.css(
                "color", RM.check_permissions('order', order, "write") ? "unset" : RM.restrictions.color
            ).val(order.data.items_count);
            if (this.is_same_order(order)) {
                this.check_buttons_status();
                this.check_item_editor_status(order.current_item);
            }
        });
    }

    check_data(data) {
        let order = this.get_order(data.data.order.data.name);
        if (order != null) {
            if ([UPDATE, QUEUE, SPLIT].includes(data.action)) {
                order.reset_data(data.data, data.action);
            } else if ([DELETE, INVOICED, TRANSFER].includes(data.action)) {
                this.delete_order(order.data.name);
            }
        } else if ([ADD, TRANSFER].includes(data.action)) {
            let new_order = this.append_order(data.data.order);
            if (RM.client === RM.request_client) {
                setTimeout(() => {
                    new_order.select();
                }, 0);
            }
        }
    }

    get_order(name) {
        let order = this.orders[name];
        return typeof order == "undefined" ? null : order;
    }

    make_orders(orders = [], current = null) {
        let _orders = Object.keys(this.orders);

        orders.forEach((order) => {
            if (_orders.includes(order.name)) {
                this.orders[order.name].data = order;
            } else {
                this.append_order(order, current);
            }
        });

        let new_order = frappe.jshtml({
            tag: "button",
            properties: {
                class: "btn btn-app btn-lg btn-order",
                style: 'background-color: var(--fill_color)'
            },
            content: `<span class="fa fa-plus"/>`
        }).on("click", () => {
            this.add_order();
        }, DOUBLE_CLICK);

        if (typeof this.components.new_order == "undefined") {
            $(this.order_container()).prepend(new_order.html())
        }

        this.#components.new_order = new_order;
    }

    append_order(order, current = null) {
        let test_order = new TableOrder({
            order_manage: this,
            data: Object.assign({}, order.data)
        });

        this.#orders[test_order.data.name] = test_order;

        if (current != null && current === test_order.data.name) {
            setTimeout(() => {
                test_order.select();
            }, 0);
        }

        return test_order;
    }

    delete_current_order() {
        if (this.current_order != null) {
            this.current_order.delete();
        }
    }

    update_current_order() {
        if (this.current_order != null) {
            this.current_order.edit();
        }
    }

    clear_current_order() {
        this.#components.Tax.val(`${__("Tax")}: ${RM.format_currency(0)}`);
        this.#components.Total.val(`${__("Total")}: ${RM.format_currency(0)}`);
        this.check_item_editor_status();
        if (this.current_order != null) {
            this.delete_order(this.current_order.data.name);
        }
    }

    delete_order(order_name) {
        let order = this.get_order(order_name);
        if (order != null) {
            order.delete_items();
            if (this.is_same_order(order)){
                this.current_order = null;
                this.clear_current_order();
            }
            delete this.orders[order_name];
            order.button.remove();
            order.container.remove();
            this.check_buttons_status();
            this.order_status_message();
        }
    }

    order_status_message(from) {
        let container = $("#" + this.identifier);
        if (this.current_order == null) {
            container.removeClass("has-order");
            container.removeClass("has-items");
        } else {
            container.addClass("has-order");
            if (this.current_order.items_count() === 0) {
                container.removeClass("has-items");
            } else {
                container.addClass("has-items");
            }
        }
    }
}