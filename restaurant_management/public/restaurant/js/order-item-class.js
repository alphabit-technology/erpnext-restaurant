class OrderItem{
	constructor(options) {
		Object.assign(this, options, {
			rendered: false,
			edit_form: false
		});
		this.row=null;
		this.icon=null;
		this.notes=null
		this.edit_note_button="";
		this.attending_status = this.order.data.attending_status;
		this.listeners();
    }

    listeners(){
        frappe.realtime.on("pos_profile_update", () => {
        	setTimeout(() => {
				this.active_editor();
			}, 0)
		})
    }

    update_to_edit(){
		return (this.data.status === this.attending_status || this.data.status === "Pending") &&
			RM.check_permissions("order", this.order, "write")
			//this.order.data.owner === frappe.session.user;
	}

	update(qty, discount, rate){
		if(this.order.data.owner !== frappe.session.user) return;
		if(RM.busy_message() || !this.update_to_edit()){
			return;
		}

		this.data.status = "Pending";
		this.data.qty = flt(qty);
		this.data.discount_percentage = flt(discount);
		this.data.rate = flt(rate);

		this.row.content = this.template();
		this.row.val("");

		if(this.order.order_manage.objects.Qty.val() !== ""){
			this.order.queue_item(this.data);
		}
	}

	delete(){
		if(RM.busy_message()) return;

		if(this.data.status !== this.attending_status) return;

		this.data.qty = 0;
		this.row.content = this.template();
		this.row.val("");

		this.order.queue_item(this.data);
	}

	render(){
		let container = $("#"+this.order.order_manage.order_entry_container_name);

		this.row = new JSHtml({
			tag: "li",
			properties: {class: "media event"},
			content: this.template()
		}).on("click", () => {
			RM.pull_alert("left");
			this.order.current_item = this;
			this.select();
		})

		container.append(this.row.html());
	}

	select(){
		this.order.order_manage.flag_change = true;
		this.active_editor();
		this.row.add_class('selected').JQ().siblings('.media.event.selected').removeClass('selected');
	}

	active_editor(){
		if(typeof this.order == "undefined") return;
		this.order.order_manage.set_editor_status(this);
	}

	edit_notes(){
		if(this.edit_form === false) {
			this.edit_form = new CETIForm({
				doctype: "Order Entry Item",
				docname: this.data.name,
				form_name: "order-item-note",
				disabled_to_save: true,
				after_load: () => {
					this.edit_form.form.set_value("notes", this.data.notes);

					this.edit_form.modal.set_primary_action(__("Save"), () => {
						let notes = this.edit_form.form.get_value("notes");
						this.edit_form.hide();

						if(notes !== this.data.notes){
							this.data.notes = notes;
							this.notes.val(notes);
							this.order.send_queue_items(0);
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

	update_notifications(data){
		this.data.status_icon = data.status_icon;
		this.data.status_color = data.status_color;
		this.icon.content = `<i class="fa ${this.data.status_icon}" style="color: ${this.data.status_color}"/>`;
		this.icon.val("");
	}

	template(){
		this.icon = new JSHtml({
			tag: "a",
			properties: {class: "pull-left border-aero profile_thumb"},
			content: `<i class="${this.data.status_icon}" style="color: ${this.data.status_color}"/>`
		})

		this.edit_note_button = new JSHtml({
			tag: "a",
			properties: {
				class: "edit-note pull-right",
				style: "display: none"
			},
			content: `<i class="fa fa-pencil"/> ${__("Notes")}`
		});

		this.notes = new JSHtml({
			tag: "small",
			properties: {class: "notes"},
			content: (typeof this.data.notes == "object" ? "" : this.data.notes)
		})

		let edit_note_button = (this.data.status === this.attending_status && this.order.data.owner === frappe.session.user) ?
			this.edit_note_button.on("click", () => {
				this.edit_notes();
			}).html() : "";

		return `
		${this.icon.html()}
		<div class="media-body">
			<a class="title" href="javascript:void(0)">${this.data.item_name}
				<a class="pull-right">${RM.format_currency(this.data.amount)}</a>
			</a>
			<p>${this.detail()}</p>
			<p>
				${this.notes.html()}
				${edit_note_button}
			</p>
		</div>`
	}

	detail(){
		let discount_data = '';
		if(this.data.discount_percentage){
			discount_data = `
			<small style="color:green">
				<strong>${this.data.discount_percentage}%<span class="fa fa-tags"/></strong>
			</small>`
		}
		let discount = isNaN(parseFloat(this.data.discount_percentage)) ? 0 : parseFloat(this.data.discount_percentage);

		return `${this.data.qty} x @${RM.format_currency(parseFloat(this.data.rate) * (1-discount/100))} ${discount_data}`
	}
}