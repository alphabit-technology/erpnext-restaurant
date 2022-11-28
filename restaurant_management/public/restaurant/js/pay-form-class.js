class PayForm extends DeskForm {
    button_payment = null;
    payment_methods = {};
    dinners = null;
    form_name = "Payment Order";
    has_primary_action = false;
    
    constructor(options) {
        super(options);

        this.doc_name = this.order.data.name;
        this.title = this.order.data.name;
        this.primary_action = () => {
            this.send_payment();
        };

        this.primary_action_label = __("Pay");

        super.initialize();
    }

    on_reload() {
        this.trigger("customer_primary_address", "change");
    }

    async make() {
        await super.make();

        this.init_synchronize();

        const set_address_query = () => {
            this.set_field_property("address", "get_query", () => {
                return {
                    filters: {
                        'link_doctype': 'Customer',
                        'link_name': this.get_value("customer"),
                    }
                }
            });

            /*this.set_field_property('branch', "get_query", () => {
                return {
                    query: RM.url_manage + "get_customer_branches",
                    filters: {
                        'link_name': this.get_value("customer")
                    }
                }
            });*/
        }

        this.make_inputs();
        this.make_payment_button();
        set_address_query();

        this.on("charge_amount", "change", () => {
            this.order.data.delivery_charges_amount = this.get_value("charge_amount") || 0;
            this.order.aggregate();
            this.button_payment.set_content(`<span style="font-size: 25px; font-weight: 400">{{text}} ${this.order.total_money}</span>`);
            this.button_payment.val(__("Pay"));
        });

        this.on(["address", "delivery_branch", "branch"], "change", () => {
            if(this.get_value("delivery_branch") === 1){
                this.get_field("branch").$wrapper.show();
                this.get_field("address").$wrapper.hide();
            }else{
                this.get_field("branch").$wrapper.hide();
                this.get_field("address").$wrapper.show();
            }

            this.get_delivery_address();
        });

        this.on("customer_primary_address", "change", () => {
            if(this.get_value("address").length === 0){
                this.set_value("address", this.get_value("customer_primary_address"));
            }

            this.set_value("address", "");
            this.set_value("branch", "");
        });

        this.on("address_branch", "change", () => {
            if(this.get_value("branch").length === 0){
                this.set_value("branch", this.get_value("address_branch"));
            }
        });


        this.get_field("notes").input.style.height = "80px";
        this.get_field("customer_primary_address").$wrapper.hide();
        this.get_field("address_branch").$wrapper.hide();

        this.trigger("customer_primary_address", "change");
    }

    get_delivery_address() {
        const origin = this.get_value("delivery_branch") === 1 ? "Branch" : "Address";
        const address = this.get_value("address");
        const branch = this.get_value("branch");

        if(origin === "Address" && address.length === 0){
            this.set_value("delivery_address", "");
            this.set_value("charge_amount", 0);
            return
        };

        if(origin === "Branch" && branch.length === 0){
            this.set_value("delivery_address", "");
            this.set_value("charge_amount", 0);
            return
        };
        
        frappeHelper.api.call({
            model: "Table Order",
            name: this.order.data.name,
            method: "get_delivery_address",
            args: {origin:origin, ref:origin === "Address" ? address : branch},
            always: (r) => {
                if (r.message) {
                    this.set_value("delivery_address", r.message.address);
                    this.set_value("charge_amount", r.message.charges);
                }
            }
        });
    }

    init_synchronize() {
        frappe.realtime.on("pos_profile_update", () => {
            this.hide();
        });
    }

    async reload(){
        await super.reload(null, true);

        this.set_dinners_input();
        this.update_paid_value();
    }

    make_inputs() {
        let payment_methods = "";
        RM.pos_profile.payments.forEach(mode_of_payment => {
            this.payment_methods[mode_of_payment.mode_of_payment] = frappe.jshtml({
                tag: "input",
                properties: {
                    type: "text",
                    class: `input-with-feedback form-control bold`
                },
            }).on(["change", "keyup"], () => {
                this.update_paid_value();
            }).on("click", (obj) => {
                this.order.order_manage.num_pad.input = obj;
            }).float();

            if (mode_of_payment.default === 1) {
                this.payment_methods[mode_of_payment.mode_of_payment].val(this.order.data.amount);

                setTimeout(() => {
                    this.payment_methods[mode_of_payment.mode_of_payment].select();
                    this.order.order_manage.num_pad.input = this.payment_methods[mode_of_payment.mode_of_payment];
                }, 200);
            }

            payment_methods += this.form_tag (
                mode_of_payment.mode_of_payment, this.payment_methods[mode_of_payment.mode_of_payment]
            );
        });

        this.get_field("payment_methods").$wrapper.empty().append(payment_methods);

        this.set_dinners_input();
        
        this.update_paid_value();

        /*RM.pos_profile.payments.forEach(mode_of_payment => {
            console.log(this.payment_methods[mode_of_payment.mode_of_payment])
        });*/
    }

    set_dinners_input(){
        this.dinners = frappe.jshtml({
            tag: "input",
            properties: {
                type: "text",
                class: `input-with-feedback form-control bold`
            },
        }).on("click", (obj) => {
            this.order.order_manage.num_pad.input = obj;
        }).val(this.doc.dinners).int();

        this.get_field("dinners").$wrapper.empty().append(
            this.form_tag("Dinners", this.dinners)
        );

    }

    form_tag(label, input) {
        return `
        <div class="form-group">
            <div class="clearfix">
                <label class="control-label" style="padding-right: 0;">${__(label)}</label>
            </div>
            <div class="control-input-wrapper">
                ${input.html()}
            </div>
         </div>`
    }

    make_payment_button() {
        this.button_payment = frappe.jshtml({
            tag: "button",
            wrapper: this.get_field("payment_button").$wrapper,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            },
            content: `<span style="font-size: 25px; font-weight: 400">{{text}} ${this.order.total_money}</span>`,
            text: `${__("Pay")}`
        }).on("click", () => {
            if (!RM.can_pay) return;
            this.button_payment.disable().val(__("Paying"));
            this.send_payment();
        }, !RM.restrictions.to_pay ? DOUBLE_CLICK : null).prop("disabled", !RM.can_pay);
    }

    get payments_values() {
        const payment_values = {};
        RM.pos_profile.payments.forEach((mode_of_payment) => {
            let value = this.payment_methods[mode_of_payment.mode_of_payment].float_val;
            if (value > 0) {
                payment_values[mode_of_payment.mode_of_payment] = value;
            }
        });

        return payment_values;
    }

    send_payment() {
        RM.working("Saving Invoice");
        this.#send_payment();
    }

    reset_payment_button() {
        RM.ready();
        if (!RM.can_pay) {
            this.button_payment.disable();
            return;
        }
        this.button_payment.enable().val(__("Pay")).remove_class("btn-warning");
    }

    #send_payment() {
        if (!RM.can_pay) return;
        const order_manage = this.order.order_manage;

        RM.working("Saving Invoice");
        this.order.data.dinners = this.dinners.val();

        this.save(() => {
            RM.ready();
            RM.working("Paying Invoice");
            frappeHelper.api.call({
                model: "Table Order",
                name: this.order.data.name,
                method: "make_invoice",
                args: {
                    mode_of_payment: this.payments_values,
                    customer: this.get_value("customer"),
                    dinners: this.dinners.float_val
                },
                always: (r) => {
                    RM.ready();
                    
                    if (r.message && r.message.status) {
                        order_manage.clear_current_order();
                        order_manage.check_buttons_status();
                        order_manage.check_item_editor_status();
                        
                        this.hide();
                        this.print(r.message.invoice_name);
                        order_manage.make_orders();
                    } else {
                        this.reset_payment_button();
                    }
                },
                freeze: true
            });
        });
    }

    print(invoice_name) {
        if (!RM.can_pay) return;

        const title = invoice_name + " (" + __("Print") + ")";
        const order_manage = this.order.order_manage;

        const props = {
            model: "POS Invoice",
            model_name: invoice_name,
            args: {
                format: RM.pos_profile.print_format,
                _lang: RM.lang,
                no_letterhead: RM.pos_profile.letter_head || 1,
                letterhead: RM.pos_profile.letter_head || 'No%20Letterhead'
            },
            from_server: true,
            set_buttons: true,
            is_pdf: true,
            customize: true,
            title: title
        };

        if (order_manage.print_modal) {
            order_manage.print_modal.set_props(props);
            order_manage.print_modal.set_title(title);
            order_manage.print_modal.reload().show();
        } else {
            order_manage.print_modal = new DeskModal(props);
        }
    }

    update_paid_value() {
        let total = 0;

        setTimeout(() => {
            Object.keys(this.payment_methods).forEach((payment_method) => {
                total += this.payment_methods[payment_method].float_val;
            });

            this.set_value("total_payment", total);
            this.set_value("change_amount", (total - this.order.amount));
        }, 0);
    }
}
