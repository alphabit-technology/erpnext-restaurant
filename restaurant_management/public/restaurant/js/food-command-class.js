class FoodCommand {
    constructor(options) {
        Object.assign(this, options);
        this.rendered = false;
        this.item = null;
        this.render();
        RM.object(this.identifier + this.process_manage.identifier, this);
    }

    render() {
        if (this.rendered === false) {
            this.action_button = new JSHtml({
                tag: "h5",
                properties: {
                    class: `btn btn-default btn-flat btn-food-command`,
                    style: 'border-radius: 0 !important'
                },
                content: '{{text}}<i class="fa fa-chevron-right pull-right" style="font-size: 16px; padding-top: 2px;"/>',
                text: this.data.process_status_data.next_action_message,
            }).on("click", () => {
                this.execute();
            }, DOUBLE_CLICK)

            this.status_label = new JSHtml({
                tag: "h5",
                properties: {
                    class: "btn btn-flat btn-food-command status-label",
                    style: `background-color: ${this.data.process_status_data.color};`
                },
                content: `<i class="${this.data.process_status_data.icon} pull-left status-label-icon"/> ${this.data.process_status_data.status_message}`,
            });

            this.title = new JSHtml({
                tag: "h5",
                content: `${this.data.table_description} | ${this.data.short_name}`,
            });

            this.item = new JSHtml({
                tag: "article",
                properties: {
                    class: "food-command-container"
                },
                content: this.template()
            });

            $(this.process_manage.command_container()).append(
                this.item.html()
            );

            this.rendered = true;
            this.show_notes();
        }
    }

    update_title() {
        this.title.val(this.data.table_description + " | " + this.data.short_name);
    }

    refresh_html() {
        let ps = this.data.process_status_data;
        this.update_title();
        this.detail.val(this.detail_html());
        this.action_button.val(ps.next_action_message);

        this.show_notes();

        this.status_label.val(
            `<i class="${ps.icon} pull-left" style="font-size: 22px"/> ${ps.status_message}`
        ).css([
            {prop: "background-color", value: ps.color}
        ]);
    }

    execute() {
        if (RM.busy_message()) {
            return;
        }
        RM.working(this.data.next_action_message, false);

        CETI.api.call({
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

    detail_html() {
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

    template() {
        this.detail = new JSHtml({
            tag: "div",
            properties: {
                class: "row food-command-detail"
            },
            content: this.detail_html()
        });

        this.notes = new JSHtml({
            tag: "div",
            properties: {class: "row product-notes", style: "color: #313030; display: none;"},
            content: '<h6 style="width: 100%; color: var(--red)">{{text}}</h6>',
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
				<h6 style="width: 100%">${this.data.creation}</h6>
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