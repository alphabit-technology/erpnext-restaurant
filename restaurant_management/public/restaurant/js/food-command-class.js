class FoodCommand {
    constructor(options) {
        Object.assign(this, options);
        this.rendered = false;
        this.item = null;
        this.render();
        RM.object(this.identifier + this.process_manage.identifier, this);
    }

    render() {
        if (!this.rendered) {
            this.action_button = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: `btn btn-default btn-flat btn-food-command`,
                    style: 'border-radius: 0 !important'
                },
                content: '{{text}}<i class="fa fa-chevron-right pull-right" style="font-size: 16px; padding-top: 2px;"/>',
                text: this.data.process_status_data.next_action_message,
            }).on("click", () => {
                this.execute();
            }, !RM.restrictions.to_change_status_order ? DOUBLE_CLICK : null)

            this.status_label = frappe.jshtml({
                tag: "h5",
                properties: {
                    class: "btn btn-flat btn-food-command status-label",
                    style: `background-color: ${this.data.process_status_data.color};`
                },
                content: `<i class="${this.data.process_status_data.icon} pull-left status-label-icon"/> ${this.data.process_status_data.status_message}`,
            });

            this._time_elapsed = frappe.jshtml({
                tag: "strong",
                properties: {
                    style: "font-size: 25px; left: 100%; position: sticky;"
                },
                content: ''
            });

            this.description = frappe.jshtml({
                tag: "span",
                content: `${this.data.table_description} | ${this.data.short_name}`,
            });

            this.title = frappe.jshtml({
                tag: "h5",
                content: `${this.description.html()} ${this._time_elapsed.html()}`,
            });

            this.item = frappe.jshtml({
                tag: "article",
                properties: {
                    class: "food-command-container"
                },
                content: this.template
            });

            $(this.process_manage.command_container()).append(
                this.item.html()
            );

            this.rendered = true;
            this.show_notes();

            this.time_elapsed;
        }
    }

    update_title() {
        this.description.val(this.data.table_description + " | " + this.data.short_name);
    }

    refresh_html() {
        let psd = this.data.process_status_data;
        this.update_title();
        this.detail.val(this.html_detail);
        this.action_button.val(psd.next_action_message);

        this.show_notes();

        this.status_label.val(
            `<i class="${psd.icon} pull-left" style="font-size: 22px"/> ${psd.status_message}`
        ).css([
            {prop: "background-color", value: psd.color}
        ]);
    }

    execute() {
        if (RM.busy_message()) {
            return;
        }
        RM.working(this.data.next_action_message, false);

        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.process_manage.table.data.name,
            method: "set_status_command",
            args: {
                identifier: this.data.identifier
            },
            always: () => {
                RM.ready(false, "success");
            },
        });
    }

    remove() {
        this.item.remove();

        let items = Object.keys(this.process_manage.items);

        items.forEach((item) => {
            if (this.process_manage.items[item].data.identifier === this.data.identifier) {
                delete this.process_manage.items[item];
            }
        });
    }

    get html_detail() {
        return `
		<div class="row food-command-detail">
			<div style="width: 30%; display: inline-block">
				<h5 style="width: 100%; font-size: 50px">${this.data.qty}</h5>
			</div>
			<div style="width: 30%; display: inline-block">
				<h5 style="width: 100%">Rate</h5>
				<h6 style="width: 100%">${RM.format_currency(this.data.rate)}</h6>
			</div>
			<div style="width: 30%; display: inline-block">
				<h5 style="width: 100%">Total</h5>
				<h6 style="width: 100%">${RM.format_currency(this.data.amount)}</h6>
			</div>
		</div>
		`
    }

    get time_elapsed(){
        this._time_elapsed.val(RMHelper.prettyDate(this.data.ordered_time, true, time_elapsed => this.show_alert_time_elapsed(time_elapsed)));
    }

    show_alert_time_elapsed(time_elapsed){
        let five_minuts = 60 * 5;
        let fifteen_minuts = 60 * 15;

        if (time_elapsed <= five_minuts) {
            this._time_elapsed.css('color', 'green');
        } else if (time_elapsed > five_minuts && time_elapsed <= fifteen_minuts) {
            this._time_elapsed.css('color', 'orange');
        } else if (time_elapsed > fifteen_minuts) {
            this._time_elapsed.css('color', 'red');
            this._time_elapsed.add_class('alert-time');
        }
    }


    get template() {
        this.detail = frappe.jshtml({
            tag: "div",
            properties: {
                class: "row food-command-detail"
            },
            content: this.html_detail
        });

        this.notes = frappe.jshtml({
            tag: "div",
            properties: {class: "row product-notes", style: "display: none;"},
            content: '<h6 style="width: 100%;">{{text}}</h6>',
            text: ""
        });

        return `			
		<div class="food-command">
			<div class="food-command-title">
				${this.title.html()}
			</div>
			${this.detail.html()}
			<div class="row" style="height: auto">
				<h3 style="width: 100%">${this.data.item_name}</h3>
			</div>
			<div class="row" style="height: auto">
			</div>
			${this.notes.html()}
			<div class="food-command-footer">
				<div style="display: table-cell">
					${this.status_label.html()}
				</div>
				<div style="display: table-cell">
					${this.action_button.html()}
				</div>
			</div>
		</div>`
    }

    show_notes() {
        setTimeout(() => {
            if (this.notes.obj != null) {
                if (typeof this.data.notes == "object" || this.data.notes === "" || this.data.notes === "") {
                    this.notes.val(__("No annotations")).hide();
                } else {
                    this.notes.val(this.data.notes).show();
                }
            }
        }, 0);
    }
}