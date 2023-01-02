class PayForm extends DeskForm {
    payment_methods = {};
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
        this.trigger("is_delivery", "change");
        this.trigger("customer_primary_address", "change");
    }

    get is_delivery() {
        return this.get_value("is_delivery") === 1;
    }

    async set_order_value(fieldname, value) {
        return new Promise(resolve => {
            frappeHelper.api.call({
                model: "Table Order",
                name: this.order.data.name,
                method: "set_" + fieldname,
                args: { fieldname: value },
                always: (r) => {
                    resolve(r);
                }
            });
        });
    }

    show() {
        this.wrapper.removeClass("hide").addClass("show").siblings(".pay-form.show").removeClass("show").addClass("hide");
        super.show();
    }

    async make() {
        await super.make();
        this.wrapper.addClass("pay-form");

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
        }

        this.on("charge_amount", "change", (field) => {
            this.order.data.is_delivery = this.get_value("is_delivery");
            this.order.data.delivery_branch = this.get_value("delivery_branch");
            this.order.data.charge_amount = field.get_value();
            this.order.aggregate(true);

            this.save({}, true);
        });

        this.on("related_branch", "change", (field) => {
            this.set_value("branch", field.get_value());
        });

        this.on(["delivery_branch", "address"], "change", () => {
            const set_reqd_status = (delivery_branch) => {
                if(this.is_delivery){
                    if(delivery_branch){
                        this.set_field_property(["delivery_date", "pick_time", "branch"], "reqd", 1);
                        this.set_field_property("address", "reqd", 0);
                    }else{
                        this.set_field_property(["delivery_date", "pick_time", "branch"], "reqd", 0);
                        this.set_field_property("address", "reqd", 1);
                    }
                }else{
                    this.set_field_property(["delivery_date", "pick_time", "branch", "address"], "reqd", 0);
                }
            }

            if (this.get_value("delivery_branch") === 1) {
                this.set_field_property("branch", {
                    read_only: 0,
                    reqd: 1,
                });

                set_reqd_status(this.get_value("delivery_branch") === 1);

                ["delivery_date", "pick_time"].forEach(fieldname => {
                    this.get_field(fieldname).$wrapper.show();
                });

                ["delivery_address", "charge_amount"].forEach(fieldname => {
                    this.get_field(fieldname).$wrapper.hide();
                });
            }else{
                this.set_field_property("branch", {
                    read_only: 1,
                    reqd: 0,
                });

                set_reqd_status(this.get_value("delivery_branch") === 1);

                ["delivery_date", "pick_time"].forEach(fieldname => {
                    this.get_field(fieldname).$wrapper.hide();
                });

                ["delivery_address", "charge_amount"].forEach(fieldname => {
                    this.get_field(fieldname).$wrapper.show();
                });
            }

            this.get_delivery_address();
        });
        
        const set_related = (from, to) => {
            const from_value = this.get_value(from);
            this.set_value(to, from_value);
        }

        this.hide_field("is_delivery");

        this.on("is_delivery", "change", (field) => {
            if (field.get_value() === 1) {
                this.get_field("delivery_options").wrapper[0].style.display = "block";
                this.set_field_property("dinners", "reqd", 0);
                this.get_field("dinners").$wrapper.hide();
            }else{
                this.get_field("delivery_options").wrapper[0].style.display = "none";;
                this.set_field_property(["delivery_date", "pick_time", "branch", "address"], "reqd", 0);
                this.set_field_property("dinners", "reqd", 1);
                this.get_field("dinners").$wrapper.show();
            }

            this.trigger("charge_amount", "change");
        });

        this.on("customer", "change", () => {
            this.order.data.customer = this.get_value("customer");
        });

        this.on("customer_primary_address", "change", () => {
            set_related("customer_primary_address", "address");
        });
        
        this.on("address_branch", "change", () => {
            set_related("address_branch", "branch");
        });

        this.get_field("notes").input.style.height = "80px";
        this.get_field("column").$wrapper.css("height", "37px");

        this.hide_support_elements();

        Object.entries({width: "100%", height: "60px", fontSize: "25px", fontWeight: "400", }).forEach(([key, value]) => {
            this.get_field("place_order").input.style[key] = value;
            this.get_field("payment_button").input.style[key] = value;
        });

        this.get_field("place_order").input.addEventListener("click", () => {
            this.save({
                success: () => {
                    this.order.select(true,false);
                    RM.ready("Order Placed");
                }
            });
        });
        
        this.make_inputs();
        this.make_payment_button();
        set_address_query();

        setTimeout(() => {
            this.payment_button.remove_class("btn-default").add_class("btn-primary");
            this.disable_input("payment_button", !RM.can_pay);
            this.trigger(["delivery_branch", "is_delivery"], "change");
        }, 0);
    }

    disable_input(input, value = true){
        const field = this.get_field(input);
        field && field.input && (field.input.disabled = value);
    }

    enable_input(input) {
        const field = this.get_field(input);
        field && field.input && (field.input.disabled = false);
    }

    hide_support_elements() {
        ["customer_primary_address", "address_branch", "related_branch", "amount"].forEach(fieldname => {
            this.get_field(fieldname).$wrapper.hide();
        });
    }

    get_delivery_address() {
        const type_delivery = this.get_value("delivery_branch") === 1 ? "Branch" : "Address";
        const address = this.get_value("address");

        if(type_delivery === "Address" && address.length === 0){
            this.set_value("delivery_address", "");
            this.set_value("charge_amount", 0);
            return
        };

        if(type_delivery === "Branch"){
            this.set_value("delivery_address", "");
            this.set_value("charge_amount", 0);
            return
        };
        
        frappeHelper.api.call({
            model: "Table Order",
            name: this.order.data.name,
            method: "get_delivery_address",
            args: {origin: "Address", ref: address},
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
        this.update_paid_value();

        /*RM.pos_profile.payments.forEach(mode_of_payment => {
            console.log(this.payment_methods[mode_of_payment.mode_of_payment])
        });*/
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
        this.payment_button = frappe.jshtml({
            from_html: this.get_field("payment_button").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            },
            content: `<span style="font-size: 25px; font-weight: 400">{{text}} ${this.order.total_money}</span>`,
            text: `${__("Pay")}`
        }).on("click", () => {
            if (!RM.can_pay) return;
            this.payment_button.disable().val(__("Paying"));
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
            this.payment_button.disable();
            return;
        }
        this.payment_button.enable().val(__("Pay")).remove_class("btn-warning");
    }

    #send_payment() {
        if (!RM.can_pay) return;
        const order_manage = this.order.order_manage;

        RM.working("Saving Invoice");

        this.save({
            success: (r) => {
                RM.working("Paying Invoice");
                frappeHelper.api.call({
                    model: "Table Order",
                    name: this.order.data.name,
                    method: "make_invoice",
                    args: {
                        mode_of_payment: this.payments_values
                    },
                    always: (r) => {
                        RM.ready();
                        this.reset_payment_button();

                        if (r.message && r.message.status) {
                            order_manage.clear_current_order();
                            order_manage.check_buttons_status();
                            order_manage.check_item_editor_status();

                            this.hide();
                            this.print(r.message.invoice_name);
                            order_manage.make_orders();
                        }
                    },
                    freeze: true
                });
            },
            error: (r) => {
                RM.ready();
                this.reset_payment_button();
                if(r !== false && typeof r === "string") {
                    frappe.msgprint(r);
                }
            }
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

    set_value(field, value) {
        super.set_value(field, value);
        if (field === "amount") {
            this.set_total_payment();
        }
    }

    set_total_payment() {
        if(this.payment_button) {
            this.payment_button.set_content(`<span style="font-size: 25px; font-weight: 400">{{text}} ${this.order.total_money}</span>`);
            this.payment_button.val(__("Pay"));
        }
    }
}
