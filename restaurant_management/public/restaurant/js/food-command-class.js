class FoodCommand {
    constructor(options) {
        Object.assign(this, options);
        this.rendered = false;
        this.item = null;
        this.make();
        this.render();
        RM.object(this.identifier + this.process_manage.identifier, this);
    }

    make() {
        this.container.append(`<tr data-item="${this.data.identifier}"></tr>`);
    }

    get wrapper() {
        return this.container.find(`[data-item="${this.data.identifier}"]`);
    }

    render() {
        const order_name = this.process_manage.group_items_by_order ? this.data.order_name : this.data.identifier;
        const notes = this.data.notes ? `
            <p style="color:orange">
                <svg class="icon icon-sm" style="">
                    <use class="" href="#icon-file"></use>
                </svg>
                </span> <strong>${this.data.notes}</strong>
            </p>` : '';
        this.wrapper.empty().html(`
            <td>${this.data.item_name} ${notes}</td>
            <td><span class="badge bg-danger" style="font-size:16px;">${this.data.qty}</span></td>
        `);

        $(this.process_manage.command_container()).find(`[data-group="${order_name}"]`).removeClass("hide");
    }

    update_title() {
        this.description.val(this.process_manage.table_info(data) + " | " + this.data.short_name);
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
        delete this.process_manage.items[this.data.identifier];
        this.wrapper.remove();
    }
}