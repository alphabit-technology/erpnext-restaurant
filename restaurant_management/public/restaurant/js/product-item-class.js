class ProductItem {
    constructor({ wrapper, order_manage }) {
        this.wrapper = wrapper;
        this.order_manage = order_manage;
        this.items = {};
        this.currency = RM.pos_profile.currency;

        frappe.db.get_value("Item Group", { lft: 1, is_group: 1 }, "name", async (r) => {
            this.parent_item_group = r.name;
            this.make_dom();
            this.make_fields();
            this.init_clusterize();
            await this.load_items_data();
        });
    }

    make_dom() {
        this.wrapper.html(`
			<table class="layout-table">
				<tbody>
				<tr>
					<td style="max-height: 60px;">
						<div class="fields row">
							<div class="search-field col-md-7">
							</div>
							<div class="item-group-field col-md-5">
							</div>
						</div>
					</td>
				</tr>
				<tr>
					<td class="items-wrapper" style="height: 100%"></td>
				</tr>
				</tbody>
			</table>
		`);

        this.items_wrapper = this.wrapper.find('.items-wrapper');
        this.items_wrapper.append(`
			<div class="panel pos-items"  style="height: 100%;  overflow-y: auto; margin-bottom: 0" >
			</div>
		`);
    }

    make_fields() {
        const self = this;
        this.search_field = frappe.ui.form.make_control({
            df: {
                fieldtype: 'Data',
                label: __('Search Item (Ctrl + i)'),
                placeholder: __('Search by item code, serial number, batch no or barcode'),
            },
            parent: this.wrapper.find('.search-field'),
            render_input: true,
        });

        frappe.ui.keys.on('ctrl+i', () => {
            this.search_field.set_focus();
        });

        this.search_field.$input.on('input', (e) => {
            clearTimeout(this.last_search);
            this.last_search = setTimeout(() => {
                const search_term = e.target.value;
                const item_group = this.item_group_field ? this.item_group_field.get_value() : '';
                
                this.filter_items({ search_term: search_term, item_group: item_group });
            }, 300);
        });

        this.item_group_field = frappe.ui.form.make_control({
            df: {
                fieldtype: 'Link',
                label: 'Item Group',
                options: 'Item Group',
                default: self.parent_item_group,
                onchange: () => {
                    const item_group = this.item_group_field.get_value();
                    if (item_group) {
                        this.filter_items({ item_group: item_group });
                    }
                },
                get_query: () => {
                    return {
                        query: 'erpnext.selling.page.point_of_sale.point_of_sale.item_group_query',
                        filters: {
                            pos_profile: RM.pos_profile.name
                        }
                    };
                }
            },
            parent: this.wrapper.find('.item-group-field'),
            render_input: true
        });
    }

    init_clusterize() {
        this.clusterize = new Clusterize({
            scrollElem: this.wrapper.find('.panel')[0],
            contentElem: this.wrapper.find('.pos-items')[0],
            rows_in_block: 6
        });
    }

    async load_items_data() {
        this.items = await this.get_items();
        this.items = this.items.items;
        this.all_items = this.items;
        this.render_items();
    }

    get_items({ start = 0, page_length = 40, search_value = '', item_group = this.parent_item_group } = {}) {
        const price_list = RM.pos_profile.selling_price_list;
        const pos_profile = RM.pos_profile.name;

        return new Promise(res => {
            frappe.call({
                method: "erpnext.selling.page.point_of_sale.point_of_sale.get_items",
                freeze: true,
                args: { start, page_length, price_list, item_group, search_value, pos_profile }
            }).then(r => {
                res(r.message);
            });
        });
    }

    render_items(items) {
        const raw_items = Object.values(items || this.items).map(item => this.get_item_html(item));
        raw_items.reduce((acc, item) => acc += item, '');

        this.clusterize.update(raw_items);
    }

    reset_items() {
        this.wrapper.find('.pos-items').empty();
        this.init_clusterize();
        this.load_items_data();
    }

    filter_items({ search_term = '', item_group = this.parent_item_group } = {}) {
        const result_arr = [];
        if (search_term) {
            search_term = search_term.toLowerCase();

            // memoize
            this.search_index = this.search_index || {};
            if (this.search_index[search_term]) {
                this.search_index[search_term].forEach(item => {
                    if (`${item.item_code}`.toLowerCase().includes(search_term)) {
                        result_arr.push(item)
                    } else if (`${item.item_name}`.toLowerCase().includes(search_term)) {
                        result_arr.push(item);
                    }
                })
                const items = result_arr;
                this.items = items;
                this.render_items(items);
                this.set_item_in_the_cart(items);

                return;
            }
        } else if (item_group === this.parent_item_group) {
            this.items = this.all_items;
            
            return this.render_items(this.all_items);
        }

        this.get_items({ search_value: search_term, page_length: 9999, item_group })
            .then(({ items, serial_no, batch_no, barcode }) => {
                items.forEach(item => {
                    if (`${item.item_code}`.toLowerCase().includes(search_term)) {
                        result_arr.push(item)
                    } else if (`${item.item_name}`.toLowerCase().includes(search_term)) {
                        result_arr.push(item);
                    }
                });

                if (result_arr.length > 0) {
                    items = result_arr;
                }

                if (search_term && !barcode) {
                    this.search_index[search_term] = items;
                }

                this.items = items;
                this.render_items(items);
                this.set_item_in_the_cart(items, serial_no, batch_no, barcode);
            });
    }

    set_item_in_the_cart(items, serial_no, batch_no, barcode) {
        if (serial_no) {
            this.events.update_cart(items[0].item_code, 'serial_no', serial_no);
            this.reset_search_field();
            return;
        }

        if (batch_no) {
            this.events.update_cart(items[0].item_code, 'batch_no', batch_no);
            this.reset_search_field();
            return;
        }

        if (items.length === 1 && (serial_no || batch_no || barcode)) {
            this.events.update_cart(items[0].item_code, 'qty', '+1');
            this.reset_search_field();
        }
    }

    reset_search_field() {
        this.search_field.set_value('');
        this.search_field.$input.trigger("input");
    }

    get(item_code) {
        return this.items.filter(item => item.item_code === item_code)[0];
    }

    get_all() {
        return this.items;
    }

    get_item_html(item) {
        const price_list_rate = format_currency(item.price_list_rate, this.currency);
        const { item_code, item_name, item_image } = item;
        const item_title = item_name || item_code;

        return frappe.jshtml({
            tag: "article",
            properties: { class: "pos-item-wrapper product non-selectable" },
            content: template()
        }).on("click", () => {
            this.add_item_in_order(item);
        }).html();

        function template() {
            return `
            <div class="product-img"> ${item_image ?
                `<img src="${item_image}" alt="${item_title}">` : 
                `<span class="placeholder-text" style="font-size: 72px; color: #d1d8dd;"> ${frappe.get_abbr(item_title)}</span>`}
				<span class="price-tag">
                    ${price_list_rate}
                </span>
			</div>
			<div class="product-name">
				${item_title}
			</div>`
        }
    }

    add_item_in_order(item) {
        const base_item = {
            name: null,
            entry_name: null,

            item_code: item.item_code,
            item_name: item.item_name,
            qty: 1,
            rate: item.price_list_rate,
            price_list_rate: item.price_list_rate,
            discount_percentage: 0,
            discount_amount: 0,
            stock_uom: item.stock_uom,
            item_invoice: null,
            item_invoice_name: null,
            ordered_time: null,
            has_serial_no: 0,
            serial_no: null,
            has_batch_no: 0,
            batch_no: null
        };

        const current_order = this.order_manage.current_order;
        const pos_profile = RM.pos_profile;

        if (current_order != null) {
            if (!RM.check_permissions("order", current_order, "write")) {
                RM.notification("red", __("You cannot modify an order from another User"));
                return;
            }

            base_item.company = RM.company;
            base_item.customer = current_order.data.customer;
            base_item.doctype = "Sales Invoice";
            base_item.currency = pos_profile.currency;
            base_item.pos_profile = pos_profile.name;

            this.get_items_detail(base_item).then(item_data => {
                const item_to_push = Object.assign({}, base_item, item_data);

                item_to_push.identifier = RM.uuid("entry");
                item_to_push.status = "Pending";
                item_to_push.notes = null;
                item_to_push.process_status_data = {
                    next_action_message: 'Sent',
                    color: 'red',
                    icon: 'fa fa-cart-arrow-down',
                    status_message: 'Add',
                }
                item_to_push.qty = 1;

                current_order.push_item(item_to_push);
            });
        }
    }

    get_items_detail(item) {
        return new Promise(res => {
            if (RM.store.items[item.item_code]) {
                res(RM.store.items[item.item_code]);
            } else {
                frappe.call({
                    method: 'erpnext.stock.get_item_details.get_item_details',
                    freeze: true,
                    args: { args: item }
                }).then(r => {
                    RM.store.items[r.message.item_code] = r.message;
                    res(r.message);
                });
            }
        });
    }
}

/*let item = {
    "item_code": "cafe",
    "barcode": null,
    "customer": "Ethan Acosta",
    "currency": "HNL",
    "update_stock": 1,
    "conversion_rate": 1,
    "price_list": "Standard Selling",
    "price_list_currency": "HNL",
    "plc_conversion_rate": 1,
    "company": "Development",
    "is_pos": 1,
    "transaction_date": "2020-05-26",
    "ignore_pricing_rule": 0,
    "doctype": "Sales Invoice",
    "name": "New Sales Invoice 1",
    "qty": 1,
    "stock_uom": "Nos",
    "pos_profile": "POS Restaurant",
    "cost_center": "Main - DEV",
    "tax_category": "",
    "child_docname": "New Sales Invoice Item 2"
}*/