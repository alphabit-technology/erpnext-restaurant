class ProductItem {
    have_search = true;
    items = {};
    currency = RM.pos_profile.currency;
    search_term = '';
    item_type = '';
    constructor(opts) {
        Object.assign(this, opts);

        this.parent_item_group = this.item_group;
        this.make_dom();
        this.init_clusterize();
        this.load_items_data();
    }

    make_dom() {                        
        this.wrapper.html(`
			<div class="layout-table" style="height:unset !important;">
				<div class="items-wrapper" style="height: 100%"></div>
			</div>
		`);

        this.items_wrapper = this.wrapper.find('.items-wrapper');
        this.items_wrapper.append(`
			<div class="panel pos-items widget-group " style="height: 100%; margin-bottom:5px;">
                <div class="widget-group-body grid-col-3">
                
                </div>
			</div>
		`);
    }

    init_clusterize() {
        this.clusterize = new Clusterize({
            scrollElem: this.wrapper.find('.panel')[0],
            contentElem: this.wrapper.find('.widget-group-body')[0],
            rows_in_block: 6
        });
    }

    async load_items_data() {
        this.items = await this.get_items();
        this.items = this.items.items;
        this.all_items = this.items;
        this.render_items();
    }

    get_items({ start = 0, page_length = 40, search_value = this.search_term, item_group = this.parent_item_group} = {}) {
        const price_list = RM.pos_profile.selling_price_list;
        const pos_profile = RM.pos_profile.name;
        const force_parent = 0;
        const item_type = this.item_tree.item_type_filter;

        return new Promise(res => {
            frappe.call({
                method: RM.url_manage + 'get_items',
                freeze: true,
                args: { start, page_length, price_list, item_group, item_type, search_value, pos_profile, force_parent }
            }).then(r => {
                res(r.message);
            });
        });
    }

    render_items(items) {
        const self = this;
        const raw_items = Object.values(items || this.items)
            //.filter(item => {console.log(item); return item.item_group === this.parent_item_group})
            .map(item => this.get_item_html(item));
        raw_items.reduce((acc, item) => acc += item, '');

        this.clusterize.update(raw_items);


        this.wrapper.find('.item-code').each(function(){
            const item_code = $(this).attr('item-code');
            const minus_btn = $(this).find('.minus-btn');
            const add_btn = $(this).find('.add-btn');
            const add_qty = $(this).find('.add-qty');
            const is_customizable = !!parseInt($(this).attr('is-customizable'));
            const add_item = $(this).find('.add-item');

            minus_btn.on('click', (e) => {
                e.stopPropagation();

                const qty = parseInt(add_qty.html());
                qty > 1 && add_qty.html(qty - 1);
            });

            add_btn.on('click', (e) => {
                e.stopPropagation();

                add_qty.html(parseInt(add_qty.html()) + 1);
            });

            add_item.on('click', (e) => {
                e.stopPropagation();
                const qty = parseInt(add_qty.html());

                if (is_customizable){
                    self.show_customization_modal(item_code, qty);
                    return;
                }

                add_qty.html(1);
                self.add_item_in_order(self.get(item_code), qty);
            });
        });

        setTimeout(() => {
            const current_order = this.item_tree.order_manage.current_order;
            this.update_items(current_order ? current_order.items : {});
        }, 100);
    }

    update_items(items = []) {
        this.wrapper.find('.item-code').each(function () {
            const item = Object.values(items).find(item => item.data.item_code === $(this).attr('item-code'));
            const item_in_cart = $(this).find('.items-in-cart');
            const item_in_cart_qty = item_in_cart.find('.qty-in-cart');

            if (item) {
                item_in_cart.show();
                item_in_cart_qty.html(item.data.qty);
            }else{
                item_in_cart.hide();
                item_in_cart_qty.html(0);
            }
        });
    }

    async show_customization_modal(item_code, qty){
        const item = this.get(item_code);

        const customization_items = () => {
            return new Promise(res => {
                frappe.db.get_list("Item Customizable", {
                    fields: ["item", "rate", "qty","included"],
                    filters: {parent: item_code}
                }).then(customization_items => {
                    const fields = customization_items.map(item => {
                        return {
                            customization_item: item.item,
                            qty: item.qty,
                            rate: item.rate,
                            included: item.included
                        }
                    });

                    res(fields);
                });
            });
        }

        const modal = new frappe.ui.Dialog({
            title: `Customize ${item.item_name}`,
            selectable: false,
            fields: [
                {
                    fieldname: 'customization',
                    fieldtype: 'Table',
                    label: 'Customization',
                    in_list_view: 1,
                    fields: [
                        {
                            fieldname: 'customization_item',
                            fieldtype: 'Link',
                            label: 'Item',
                            options: 'Item',
                            in_list_view: 1,
                            read_only: 1
                            /*get_query: () => {
                                return {
                                    filters: {
                                        is_customizable: 1
                                    }
                                }
                            }*/
                        },
                        {
                            fieldname: 'qty',
                            fieldtype: 'Float',
                            label: 'QTY',
                            in_list_view: 1,
                            read_only: 1
                        },
                        {
                            fieldname: 'rate',
                            fieldtype: 'Currency',
                            label: 'Rate',
                            in_list_view: 1,
                            read_only: 1
                        },
                        {
                            fieldname: "included",
                            fieldtype: "Check",
                            label: "Included",
                            in_list_view: 1
                        }
                    ],
                    data: await customization_items(),
                    in_place_edit: true,
                    cannot_add_rows: true,
                }
            ],
            primary_action: (values) => {
                const customization_items = values.customization.map(item => {
                    return {
                        item_code: item.customization_item,
                        qty: item.qty,
                        rate: item.rate,
                        included: item.included
                    }
                });
                item.is_customizable = 1;
                item.sub_items = JSON.stringify(customization_items);
                this.add_item_in_order(item, qty);
                modal.hide();
            }
        });
        modal.wrapper.find('.grid-footer').hide();
        modal.show();
    }

    reset_items() {
        this.wrapper.find('.pos-items').empty();
        this.init_clusterize();
        this.load_items_data();
    }

    search(opts={}) {
        Object.assign(this, opts);
        this.filter_items();
    }

    filter_items({ search_term = this.search_term, item_group = this.parent_item_group } = {}) {
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

        this.get_items({ search_value: search_term, page_length: 9999, item_group})
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
        const { item_code, item_name, item_image, description, is_customizable } = item;
        const item_title = item_name || item_code;
        //const template = _template();

        return frappe.jshtml({
            tag: "div",
            properties: { 
                class: "widget widget-shadow shortcut-widget-box",
                style: "padding: 0; margin: 0; border-radius: 20px;"
            },
            content: template()
        }).html()

        function template() {
            return `
            <div class="small-box item item-code" item-code="${item_code}" is-customizable=${is_customizable} style="border-radius:20px; color:var(--light); background-color:var(--dark);">
                <div class="inner" style="position: inherit; z-index: 100">
                    <h4 class="title">${item_title}</h4>
                    <p> ${description}</p>
                </div>
                <div class="icon">
                    ${item_image ? `<img src="${item_image}" alt="${item_title}"></img>` : 
                            `<span class="no-image placeholder-text" style="font-size: 72px;"> ${frappe.get_abbr(item_title)}</span>`}
                </div>
                <div class="small-box-footer" style="padding:3px; background-color: transparent;">
                    <div class="form-group" style="position: absolute;">
                        <div class="input-group bg-warning" style="border-radius: 5px; opacity: 0.9; color: black; border-radius:50px;">
                            <div class="input-group-prepend minus-btn" data-target="${item_name}-amount" data-value="-1">
                                <span class="input-group-text fa fa-minus" style="background-color: transparent; border: none; color:orangered;"></span>
                            </div>
                            <div class="custom-file" style="display: block; padding-top:6px; min-width:20px;">
                                <strong class="add-qty" data-ref="${item_name}-amount">1</strong>
                            </div>
                            <div class="input-group-append add-btn" data-target="${item_name}-amount" data-value="1">
                                <span class="input-group-text fa fa-plus" style="background-color: transparent; border: none; color:orangered;"></span>
                            </div>
                            <div class="input-group-append items-in-cart" style="display:none; background-color:green; border-radius:50px;">
                                <span class="input-group-text fa fa-shopping-cart" style="background-color: transparent; border: none; color:white;">
                                    <span class="qty-in-cart" style="padding-left:5px;">0</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <a class="btn btn-default bg-default add-item" data-action="add" style="float:right; border-radius:50px;">
                        <span class="sr-only">${__('Add')}</span>
                        ${__('Add')} ${price_list_rate}
                    </a>
                </div>
            </div>`;
        }
    }

    add_item_in_order(item, qty) {
        let rate = item.price_list_rate;

        if(item.is_customizable === 1) {
            const parse_sub_items = JSON.parse(item.sub_items);

            rate = parse_sub_items.filter(sub_item => sub_item.included === 1).reduce((acc, sub_item) => {
                return acc + (sub_item.rate * sub_item.qty);
            }, 0);
        }

        const base_item = {
            name: null,
            entry_name: null,

            item_code: item.item_code,
            item_name: item.item_name,
            qty: qty,
            rate: rate,
            price_list_rate: rate,
            discount_percentage: 0,
            discount_amount: 0,
            stock_uom: item.stock_uom,
            item_invoice: null,
            item_invoice_name: null,
            ordered_time: null,
            has_serial_no: 0,
            serial_no: null,
            has_batch_no: 0,
            batch_no: null,
            //sub_items: sub_items,
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
                item_to_push.qty = qty;
                item_to_push.sub_items = item.sub_items;
                item_to_push.is_customizable = item.is_customizable;
                item_to_push.rate = rate;
                item_to_push.price_list_rate = rate;

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