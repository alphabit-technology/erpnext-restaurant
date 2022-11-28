class Invoice {
    #discount_amount = 0;
    #additional_discount_percentage = 0;
    invoice_doc = {};

    constructor(data = {}) {
        Object.assign(this, data);
        //this.customer = data.customer || null;

        if (!this.customer) {
            throw new Error("Customer is required");
        }

        //this.make();
    }

    make(data = {}) {
        //evntBus.$emit('set_customer_readonly', false);
        this.expanded = [];
        this.posa_offers = [];
        //evntBus.$emit('set_pos_coupons', []);
        this.posa_coupons = [];
        this.return_doc = '';
        const doc = this.get_invoice_doc();
        if (doc.name) {
            this.update_invoice(doc);
        } else {
            if (doc.items.length) {
                this.update_invoice(doc);
            }
        }
        if (!data.name && !data.is_return) {
            this.items = [];
            this.customer = RM.pos_profile.customer;
            this.invoice_doc = '';
            this.discount_amount = 0;
            this.additional_discount_percentage = 0;
            this.invoiceType = 'Invoice';
            this.invoiceTypes = ['Invoice', 'Order'];
        } else {
            if (data.is_return) {
                //evntBus.$emit('set_customer_readonly', true);
                this.invoiceType = 'Return';
                this.invoiceTypes = ['Return'];
            }
            this.invoice_doc = data;
            this.items = data.items;
            this.update_items_details(this.items);
            this.posa_offers = data.posa_offers || [];
            this.items.forEach((item) => {
                if (!item.posa_row_id) {
                    item.posa_row_id = this.makeid(20);
                }
                if (item.batch_no) {
                    this.set_batch_qty(item, item.batch_no);
                }
            });
            //this.customer = data.customer;
            this.discount_amount = data.discount_amount;
            this.additional_discount_percentage =
                data.additional_discount_percentage;
            this.items.forEach((item) => {
                if (item.serial_no) {
                    item.serial_no_selected = [];
                    const serial_list = item.serial_no.split('\n');
                    serial_list.forEach((element) => {
                        if (element.length) {
                            item.serial_no_selected.push(element);
                        }
                    });
                    item.serial_no_selected_count = item.serial_no_selected.length;
                }
            });
        }
    }

    makeid(length) {
        let result = '';
        const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (var i = 0; i < length; i++) {
            result += characters.charAt(
                Math.floor(Math.random() * charactersLength)
            );
        }
        return result;
    }

    get_invoice_doc() {
        let doc = {};
        if (this.invoice_doc.name) {
            doc = { ...this.invoice_doc };
        }
        doc.doctype = 'Sales Invoice';
        doc.is_pos = 1;
        doc.ignore_pricing_rule = 1;
        doc.company = doc.company || RM.pos_profile.company;
        doc.pos_profile = doc.pos_profile || RM.pos_profile.name;
        doc.campaign = doc.campaign || RM.pos_profile.campaign;
        doc.currency = doc.currency || RM.pos_profile.currency;
        doc.naming_series = doc.naming_series || RM.pos_profile.naming_series;
        doc.customer = this.customer;
        doc.items = this.get_invoice_items();
        doc.total = this.subtotal;
        doc.discount_amount = flt(this.discount_amount);
        doc.additional_discount_percentage = flt(
            this.additional_discount_percentage
        );
        doc.posa_pos_opening_shift = this.pos_opening_shift.name;
        doc.payments = this.get_payments();
        doc.taxes = [];
        doc.is_return = this.invoice_doc.is_return;
        doc.return_against = this.invoice_doc.return_against;
        doc.posa_offers = this.posa_offers;
        doc.posa_coupons = this.posa_coupons;

        return doc;
    }

    get_invoice_items() {
        const items_list = [];
        this.items.forEach((item) => {
            const new_item = {
                item_code: item.item_code,
                posa_row_id: item.posa_row_id,
                posa_offers: item.posa_offers,
                posa_offer_applied: item.posa_offer_applied,
                posa_is_offer: item.posa_is_offer,
                posa_is_replace: item.posa_is_replace,
                is_free_item: item.is_free_item,
                qty: item.qty,
                rate: item.rate,
                uom: item.uom,
                amount: item.qty * item.rate,
                conversion_factor: item.conversion_factor,
                serial_no: item.serial_no,
                discount_percentage: item.discount_percentage,
                discount_amount: item.discount_amount,
                batch_no: item.batch_no,
                posa_notes: item.posa_notes,
                posa_delivery_date: item.posa_delivery_date,
                price_list_rate: item.price_list_rate,
            };
            items_list.push(new_item);
        });

        return items_list;
    }

    get_payments() {
        const payments = [];
        this.pos_profile.payments.forEach((payment) => {
            payments.push({
                amount: 0,
                mode_of_payment: payment.mode_of_payment,
                default: payment.default,
                account: '',
            });
        });
        return payments;
    }

    update_invoice(doc) {
        frappe.call({
            method: 'posawesome.posawesome.api.posapp.update_invoice',
            args: {
                data: doc,
            },
            async: false,
            callback: (r) => {
                if (r.message) {
                    this.invoice_doc = r.message;
                }
            },
        });
        //return this.invoice_doc;
    }

    get discount_amount() {
        return flt(this.#discount_amount);
    }

    get additional_discount_percentage() {
        return flt(this.#additional_discount_percentage);
    }

    update_items_details(items = this.items) {
        if (!items.length > 0) {
            return;
        }
        //const vm = this;
        if (!RM.pos_profile) return;
        frappe.call({
            method: 'posawesome.posawesome.api.posapp.get_items_details',
            async: false,
            args: {
                pos_profile: RM.pos_profile,
                items_data: items,
            },
            callback: (r) => {
                if (r.message) {
                    items.forEach((item) => {
                        const updated_item = r.message.find(
                            (element) => element.posa_row_id == item.posa_row_id
                        );
                        item.actual_qty = updated_item.actual_qty;
                        item.serial_no_data = updated_item.serial_no_data;
                        item.batch_no_data = updated_item.batch_no_data;
                        item.item_uoms = updated_item.item_uoms;
                        item.has_batch_no = updated_item.has_batch_no;
                        item.has_serial_no = updated_item.has_serial_no;
                    });
                }
            },
        });
    }

    update_item_detail(item) {
        const vm = this;
        frappe.call({
            method: 'posawesome.posawesome.api.posapp.get_item_detail',
            args: {
                warehouse: this.pos_profile.warehouse,
                doc: this.get_invoice_doc(),
                price_list: this.pos_profile.price_list,
                item: {
                    item_code: item.item_code,
                    customer: this.customer,
                    doctype: 'Sales Invoice',
                    name: 'New Sales Invoice 1',
                    company: this.pos_profile.company,
                    conversion_rate: 1,
                    qty: item.qty,
                    price_list_rate: item.price_list_rate,
                    child_docname: 'New Sales Invoice Item 1',
                    cost_center: this.pos_profile.cost_center,
                    currency: this.pos_profile.currency,
                    // plc_conversion_rate: 1,
                    pos_profile: this.pos_profile.name,
                    price_list: this.pos_profile.selling_price_list,
                    uom: item.uom,
                    tax_category: '',
                    transaction_type: 'selling',
                    update_stock: this.pos_profile.update_stock,
                    has_batch_no: item.has_batch_no,
                    serial_no: item.serial_no,
                    batch_no: item.batch_no,
                    is_stock_item: item.is_stock_item,
                },
            },
            callback: function (r) {
                if (r.message) {
                    const data = r.message;
                    if (
                        item.has_batch_no &&
                        vm.pos_profile.posa_auto_set_batch &&
                        !item.batch_no &&
                        data.batch_no
                    ) {
                        item.batch_no = data.batch_no;
                        vm.set_batch_qty(item, item.batch_no, false);
                    }
                    if (data.has_pricing_rule) {
                    } else if (
                        vm.pos_profile.posa_apply_customer_discount &&
                        vm.customer_info.posa_discount > 0 &&
                        vm.customer_info.posa_discount <= 100
                    ) {
                        if (
                            item.posa_is_offer == 0 &&
                            !item.posa_is_replace &&
                            item.posa_offer_applied == 0
                        ) {
                            if (item.max_discount > 0) {
                                item.discount_percentage =
                                    item.max_discount < vm.customer_info.posa_discount
                                        ? item.max_discount
                                        : vm.customer_info.posa_discount;
                            } else {
                                item.discount_percentage = vm.customer_info.posa_discount;
                            }
                        }
                    }
                    if (!item.btach_price) {
                        if (
                            !item.is_free_item &&
                            !item.posa_is_offer &&
                            !item.posa_is_replace
                        ) {
                            item.price_list_rate = data.price_list_rate;
                        }
                    }
                    item.last_purchase_rate = data.last_purchase_rate;
                    item.projected_qty = data.projected_qty;
                    item.reserved_qty = data.reserved_qty;
                    item.conversion_factor = data.conversion_factor;
                    item.stock_qty = data.stock_qty;
                    item.actual_qty = data.actual_qty;
                    item.stock_uom = data.stock_uom;
                    (item.has_serial_no = data.has_serial_no),
                        (item.has_batch_no = data.has_batch_no),
                        vm.calc_item_price(item);
                }
            },
        });
    }
}