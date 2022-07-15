class PayForm {
    constructor(options) {
        Object.assign(this, options);
        this.modal = null;
        this.button_payment = null;
        this.num_pad = undefined;
        this.payment_methods = {};
        this.dinners = null;
        this.form = null;
        this.wrapper_form = null;

        this.initialize();
        this.init_synchronize();
    }

    init_synchronize() {
        frappe.realtime.on("pos_profile_update", () => {
            this.form.hide();
        });
    }

    reload() {
        this.form.reload();
        this.form.show();
    }

    initialize() {
        if (this.form == null) {
            this.form = new DeskForm({
                doctype: "Table Order",
                docname: this.order.data.name,
                form_name: "payment-order",
                disabled_to_save: true,
                after_load: () => {
                    this.wrapper_form = this.form.form.field_group.fields_dict;
                    this.make();
                },
                title: `${this.order.data.name} - ${__("Pay")}`
            })
        } else {
            this.form.reload();
        }
    }

    make() {
        this.make_inputs();
        this.make_pad();
        this.make_payment_button();
    }

    make_pad() {
        this.num_pad = new NumPad({
            on_enter: () => {
                this.update_paid_value();
            }
        });
        
        $(this.wrapper_form.num_pad.wrapper).empty().append(
            `<div style="width: 100% !important; height: 200px !important; padding: 0">
                ${this.num_pad.html}
            </div>`
        );
    }

    make_inputs() {
        let payment_methods = "";
        RM.pos_profile.payments.forEach((mode_of_payment) => {
            this.payment_methods[mode_of_payment.mode_of_payment] = frappe.jshtml({
                tag: "input",
                properties: {
                    type: "text",
                    class: `input-with-feedback form-control bold`
                },
            }).on(["change", "keyup"], () => {
                this.update_paid_value();
            }).on("click", (obj) => {
                this.num_pad.input = obj;
            }).float();

            if (mode_of_payment.default === 1) {
                this.payment_methods[mode_of_payment.mode_of_payment].val(this.order.data.amount);
                setTimeout(() => {
                    this.payment_methods[mode_of_payment.mode_of_payment].select();
                    this.num_pad.input = this.payment_methods[mode_of_payment.mode_of_payment];
                }, 500);
            }

            payment_methods += this.form_tag(
                mode_of_payment.mode_of_payment, this.payment_methods[mode_of_payment.mode_of_payment]
            );
        });
        $(this.wrapper_form.payment_methods.wrapper).empty().append(payment_methods);

        this.dinners = frappe.jshtml({
            tag: "input",
            properties: {
                type: "text",
                class: `input-with-feedback form-control bold`
            },
        }).on("click", (obj) => {
            this.num_pad.input = obj;
        }).val(this.form.form.doc.dinners).int();

        $(this.wrapper_form.dinners.wrapper).empty().append(
            this.form_tag("Dinners", this.dinners)
        );

        this.update_paid_value();
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
            wrapper: this.wrapper_form.payment_button.wrapper,
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
        this._send_payment();
    }

    reset_payment_button() {
        RM.ready();
        if (!RM.can_pay) {
            this.button_payment.disable();
            return;
        }
        this.button_payment.enable().val(__("Pay")).remove_class("btn-warning");
    }

    _send_payment() {
        if (!RM.can_pay) return;
        const order_manage = this.order.order_manage;

        RM.working("Generating Invoice");
        this.order.data.dinners = this.dinners.val();

        frappeHelper.api.call({
            model: "Table Order",
            name: this.order.data.name,
            method: "make_invoice",
            args: {
                mode_of_payment: this.payments_values,
                customer: this.form.form.get_value("customer"),
                dinners: this.dinners.float_val
            },
            always: (r) => {
                RM.ready();
                if (typeof r.message != "undefined" && r.message.status) {
                    order_manage.clear_current_order();
                    order_manage.check_buttons_status();
                    order_manage.check_item_editor_status();
                    this.form.hide();
                    this.print(r.message.invoice_name);
                    order_manage.make_orders();
                } else {
                    this.reset_payment_button();
                }
            },
            freeze: true
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

        if(order_manage.print_modal){
            order_manage.print_modal.set_props(props);
            order_manage.print_modal.set_title(title);
            order_manage.print_modal.reload().show();
        }else{
            order_manage.print_modal = new DeskModal(props);
        }
    }

    update_paid_value() {
        let total = 0;

        setTimeout(() => {
            Object.keys(this.payment_methods).forEach((payment_method) => {
                total += this.payment_methods[payment_method].float_val;
            });

            this.form.form.set_value("total_payment", total);
            this.form.form.set_value("change_amount", (total - this.order.amount));
        }, 0);
    }
}
