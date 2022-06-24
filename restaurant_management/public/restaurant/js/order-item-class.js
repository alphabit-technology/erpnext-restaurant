class OrderItem {
    constructor(options) {
        Object.assign(this, options);
        this.edit_form = null;
        this.attending_status = this.order.data.attending_status;
        this.status_enabled_for_edit = [this.attending_status, "Pending", null, undefined, ""];
        this.status_enabled_for_delete = [this.attending_status, "Pending", "Sent", null, undefined, ""];
        this.render();
        this.init_synchronize();
    }

    init_synchronize() {
        frappe.realtime.on("pos_profile_update", () => {
            setTimeout(() => {
                this.active_editor();
            }, 0);
        });
    }

    hide() {
        this.row.hide();
    }

    get is_enabled_to_edit() {
        return (this.status_enabled_for_edit.includes(this.data.status)) &&
            RM.check_permissions("order", this.order, "write");
    }

    get is_enabled_to_delete() {
        return (
                this.status_enabled_for_delete.includes(this.data.status)) &&
            (
                RM.check_permissions("order", this.order, "write")// &&
                //RM.check_permissions("pos", null, "delete")
            );
    }

    reset_html() {
        let ps = this.data.process_status_data;
        this.amount.val(RM.format_currency(this.data.amount));
        this.detail.val(this.html_detail);
        this.notes.val(this.data.notes);
        this.icon.val(`<i class="${ps.icon}" style="color: ${ps.color}"/>`);
    }

    delete() {
        if (RM.busy_message() || !this.is_enabled_to_delete) return;
        this.data.qty = 0;
        this.update(true);
    }

    remove() {
        this.row.remove();
    }

    render() {
        this.row = frappe.jshtml({
            tag: "li",
            properties: {class: "media event"},
            content: this.template
        }).on("click", () => {
            RM.pull_alert("left");
            this.select();
        });

        this.order.container.append(this.row.html());
    }

    select(scroller=false) {
        this.order.current_item = this;
        this.order.order_manage.check_item_editor_status(this);
        this.row.toggle_common('media.event', 'selected');
        if(scroller) this.order.scroller();
    }

    active_editor() {
        if (typeof this.order == "undefined") return;
        this.order.order_manage.check_item_editor_status(this);
    }

    edit_notes() {
        if (this.edit_form == null) {
            this.edit_form = new DeskForm({
                doctype: "Order Entry Item",
                docname: this.data.name,
                form_name: "order-item-note",
                disabled_to_save: true,
                after_load: () => {
                    this.edit_form.form.set_value("notes", this.data.notes);
                    this.edit_form.modal.set_primary_action(__("Save"), () => {
                        let notes = this.edit_form.form.get_value("notes");
                        this.edit_form.hide();

                        if (notes !== this.data.notes) {
                            this.data.notes = notes;
                            this.notes.val(notes);
                            window.saving = true;
                            frappeHelper.api.call({
                                model: "Table Order",
                                name: this.order.data.name,
                                method: "set_item_note",
                                args: {item: this.data.identifier, notes: notes},
                                always: () => {
                                    window.saving = false;
                                },
                            });
                        }
                    });
                },
                title: `${this.data.item_name} - ${__("Edit note")}`,
            });
        } else {
            this.edit_form.show();
            this.edit_form.reload();
        }
    }

    update(server = true) {
        if(this.data.qty === 0 && !this.is_enabled_to_delete){
            frappe.msgprint(__("You do not have permissions to delete Items"));
            return;
        }

        if (this.data.qty === 0) {
            //this.order.delete_item(this.data.identifier);
        } else {
            this.calculate();
            this.reset_html();
        }
        this.order.aggregate(true);
        if (!server) return;



        RM.working("Update Item", false);
        window.saving = true;
        frappeHelper.api.call({
            model: "Table Order",
            name: this.order.data.name,
            method: this.data.qty > 0 ? "push_item" : "delete_item",
            args: {item: this.data.qty > 0 ? this.data : this.data.identifier},
            always: () => {
                window.saving = false;
                RM.ready();
            },
        });
    }

    calculate() {
        let tax_percentage = RMHelper.JSONparse(this.data.item_tax_rate);
        let base_amount = parseFloat(this.data.qty) * parseFloat(this.data.rate);
        let tax_amount = 0;
        if (tax_percentage != null) {
            tax_percentage = Object.keys(tax_percentage).map((key) => tax_percentage[key]);
            tax_percentage.forEach((tax) => {
                tax_amount += base_amount * (tax / 100);
            });
        }
        this.data.tax_amount = tax_amount;
        this.data.amount = (base_amount + tax_amount);
    }

    get template() {
        let psd = this.data.process_status_data;
        this.icon = frappe.jshtml({
            tag: "a",
            properties: {class: "pull-left border-aero profile_thumb"},
            content: `<i class="${psd.icon}" style="color: ${psd.color}"/>`
        });

        this.edit_note_button = frappe.jshtml({
            tag: "a",
            properties: {
                class: "edit-note pull-right",
                style: "display: none"
            },
            content: `<i class="fa fa-pencil"/> ${__("Notes")}`
        });

        this.notes = frappe.jshtml({
            tag: "small",
            properties: {class: "notes"},
            content: (typeof this.data.notes == "object" ? "" : this.data.notes)
        });

        this.detail = frappe.jshtml({
            tag: "p",
            content: this.html_detail
        });

        this.amount = frappe.jshtml({
            tag: 'a',
            properties: {class: 'pull-right'},
            content: RM.format_currency(this.data.amount)
        });

        let edit_note_button = (
            RM.check_permissions('order', this.order, 'write')
        ) ? this.edit_note_button.on("click", () => {
            this.edit_notes();
        }).html() : "";

        return `
		${this.icon.html()}
		<div class="media-body">
			<a class="title" href="javascript:void(0)">${this.data.item_name}
				${this.amount.html()}
			</a>
			${this.detail.html()}
			<p>
				${this.notes.html()}
				${edit_note_button}
			</p>
		</div>`
    }

    get html_detail() {
        let discount_data = '';
        if (this.data.discount_percentage) {
            discount_data = `
			<small style="color:green">
				<strong>${this.data.discount_percentage}%<span class="fa fa-tags"/></strong>
			</small>`
        }
        let discount = isNaN(parseFloat(this.data.discount_percentage)) ? 0 : parseFloat(this.data.discount_percentage);

        return `${this.data.qty} x @${RM.format_currency(parseFloat(this.data.rate) * (1 - discount / 100))} ${discount_data}`
    }
}