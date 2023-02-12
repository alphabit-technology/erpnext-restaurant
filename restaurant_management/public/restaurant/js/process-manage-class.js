ProcessManage = class ProcessManage {
    status = "close";
    modal = null;
    items = {};
    new_items_keys = [];
    orders = {};

    constructor(options) {
        Object.assign(this, options);

        this.command_container_name = this.table.data.name + "-command_container";
        this.initialize();
    }

    reload(clean = false) {
        this.get_commands_food(clean);
    }

    remove() {
        this.close();
        this.modal.remove();
    }

    initialize() {
        this.title = this.table.room.data.description + " (" + this.table.data.description + ")";
        if (this.modal == null) {
            this.modal = RMHelper.default_full_modal(this.title, () => this.make());
        } else {
            this.show();
        }
    }

    show() {
        this.modal.show();
    }

    is_open() {
        return this.modal.modal.display;
    }

    close() {
        this.modal.hide();
        this.status = "close";
    }

    make() {
        this.make_dom();
        this.get_commands_food();
    }

    make_dom() {
        this.modal.container.css({ "padding": "10px" })
        this.modal.container.empty().append(this.template());
        this.modal.title_container.empty().append(
            RMHelper.return_main_button(this.title, () => this.modal.hide()).html()
        );
    }

    template() {
        return `
        <div class="widget-group">
            <div class="widget-group-body grid-col-3" id="${this.command_container_name}">
            
            </div>
        </div>`;
    }

    get_commands_food(clean = false) {
        RM.working("Load commands food");
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "commands_food",
            args: {},
            always: (r) => {
                RM.ready();

                setTimeout(() => {
                    if (clean) {
                        this.items = {};
                        this.new_items_keys = [];
                        this.orders = {};

                        $(this.command_container()).empty();
                    }
                    this.make_food_commands(r.message);
                }, 100);
            },
        });
    }

    table_info(data) {
        return `${data.room_description} (${data.table_description})`;
    }

    render_group_container(orders = {}) {
        const order_template = (order) => {
            const data = order.data || order;

            const notes = data.notes ? `
            <p class="control-value like-disabled-input for-description" data-name="notes">
                ${data.notes || ""}
            </p>` : "";

            return $(`
            <div div class="widget links-widget-box hide" data-group="${data.name}" >
                <div class="widget-head">
                    <div>
                        <div class="widget-title ellipsis">
                            <svg class="icon icon-sm" style="">
                                <use class="" href="#icon-file"></use>
                            </svg> 
                            <span>
                                ${data.short_name}
                                <svg class="icon icon-sm" style="">
                                    <use class="" href="#icon-right"></use>
                                </svg>
                                <small>${this.table_info(data)}</small>
                            </span>
                        </div>
                        <div class="widget-subtitle"></div>
                    </div>
                    <div class="widget-control">
                        <button class="btn btn-sm btn-default" data-name="print-order">
                            <svg class="icon icon-sm" style="">
                                <use class="" href="#icon-printer"></use>
                            </svg>
                        </button>
                        <span class="ellipsis">
                            <strong data-name="ordered_time" data-value="${data.ordered_time}" style="font-size: 18px;"></strong>
                        </span>
                    </div>
                </div>

                <div class="widget-body" style="height: 100%; padding-top: 10px;">
                    <table class="table table-sm" style="margin-top:0;">
                        <thead>
                            <tr style="display: ${data.is_delivery ? "" : "none"}" data-name="customer-info">
                                <th colspan="2" style="border-top: 0px;">
                                    <span class="ellipsis">
                                        <div style="width: 100%; height: 30px;">
                                            <svg class="icon icon-md" style="">
                                                <use class="" href="#icon-support"></use>
                                            </svg>
                                            <span data-name="customer" style="position:relative; top:5px">${data.customer}</span>
                                            <div style="float:right;">
                                                <a class="btn btn-sm btn-link" data-name="show-address" data-target="delivery_address">
                                                    Show Address
                                                </a>
                                            </div>
                                        </div>
                                    </span>
                                    <p class="control-value like-disabled-input for-description" data-name="delivery_address" style="display:none;">
                                        ${data.delivery_address || ""}
                                    </p>
                                </th>
                            </tr>
                            <tr>
                                <th>Item</th>
                                <th style="width: 40px">QTY</th>
                            </tr>
                        </thead>
                        <tbody class="item-wrapper">

                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="2">
                                    ${notes}
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div class="widget-footer">
                    <div class="widget-control">
                        <div class="btn-group" style="width:100%">
                            ${order.status_label.html()}
                            ${order.action_button.html()}
                        </div>
                    </div>
                </div>
            </div>`);
        };

        const order_is_render = (order) => {
            const data = order.data || order;
            return !!this.orders[data.name];
        };

        const add_order = (order) => {
            const data = order.data || order;
            this.orders ??= {};
            this.orders[data.name] = order;

            order.action_button ??= frappe.jshtml({
                tag: "h5",
                properties: {
                    class: `btn btn-default btn-flat btn-food-command`,
                    style: 'border-radius: 0 !important'
                },
                content: '{{text}}<i class="fa fa-chevron-right pull-right" style="font-size: 16px; padding-top: 2px;"></i>',
                text: data.process_status_data.next_action_message,
            }).on("click", () => {
                this.execute(data);
            }, !RM.restrictions.to_change_status_order ? DOUBLE_CLICK : null);

            order.status_label ??= frappe.jshtml({
                tag: "h5",
                properties: {
                    class: "btn btn-flat btn-food-command status-label",
                    style: `background-color: ${data.process_status_data.color};`
                },
                content: `<i class="${data.process_status_data.icon} pull-left status-label-icon" style="font-size: 22px"></i> ${data.process_status_data.status_message}`,
            });

            $(this.command_container()).append(order_template(order));

            this.get_field(data, "show-address").on("click", (e) => {
                const target = $(e.target).data("target");
                this.get_field(data, target).toggle();
            });

            this.get_field(data, "print-order").on("click", () => {
                this.print_order(data);
            });
        };

        const update_order = (data) => {
            this.orders[data.name].data = data;
            const { action_button, status_label } = this.orders[data.name];
            const psd = data.process_status_data;

            action_button.val(psd.next_action_message);

            status_label.val(
                `<i class="${psd.icon} pull-left status-label-icon" style="font-size: 22px"></i> ${psd.status_message}`
            ).css([
                { prop: "background-color", value: psd.color }
            ]);

            Object.keys(data).forEach(key => {
                if (key !== "ordered_time") this.get_field(data, key).html(data[key]);
            });

            const customer_info = this.get_field(data, "customer-info");
            data.is_delivery === 1 ? customer_info.show() : customer_info.hide();

        };

        const delete_order = (data) => {
            $(`[data-group="${data.name}"]`).remove();
            delete this.orders[data.name];
        };

        Object.values(orders).forEach(order => {
            const data = order.data || order;
            const available = this.check_available_item(data, data);

            if (order_is_render(order)) {
                available ? update_order(data) : delete_order(data);
            } else if (available) {
                add_order(order);
            }
        });
    }

    print_order(data) {
        const title = data.name + " (" + __("Account") + ")";

        const props = {
            model: (this.group_items_by_order ? "Table Order" : "Order Entry Item"),
            model_name: data.entry_name || data.name,
            from_server: true,
            args: {
                format: (this.group_items_by_order ? "Order Account" : "Order Account Item"),
                _lang: RM.lang,
                no_letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 1,
                letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 'No%20Letterhead'
            },
            set_buttons: true,
            is_pdf: true,
            customize: true,
            title: title
        }

        if (this.print_modal) {
            this.print_modal.set_props(props);
            this.print_modal.set_title(title);
            this.print_modal.reload().show();
        } else {
            this.print_modal = new DeskModal(props);
        }
    }

    get_field(group, field) {
        return $(`[data-name="${field}"]`, `[data-group="${group.name}"]`);
    }

    execute(data) {
        if (RM.busy_message()) {
            return;
        }
        RM.working(data.next_action_message, false);

        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "set_status_command",
            args: {
                identifier: data.name
            },
            always: () => {
                RM.ready(false, "success");
            },
        });
    }

    make_food_commands(items = {}) {
        this.render_group_container(items);

        Object.values(items).forEach(item => {
            const order = item.data || item;
            const items = item.items || [];

            items.forEach((item) => {
                if (Object.keys(this.items).includes(item.identifier)) {
                    this.items[item.identifier].data = item;
                    this.items[item.identifier].render();
                } else {
                    this.add_item(item, order);
                }

                this.items[item.identifier].process_manage = this;
            });
        });

        setTimeout(() => {
            this.debug_items();
        }, 100);

        this.time_elapsed();
    }

    time_elapsed() {
        Object.values(this.orders).forEach(order => {
            const data = order.data || order;
            const input = this.get_field(data, "ordered_time");

            input.html(RMHelper.prettyDate(data.ordered_time, true, time_elapsed => this.show_alert_time_elapsed(input, time_elapsed)));
        });

        setTimeout(() => this.time_elapsed(), 3000);
    }

    show_alert_time_elapsed(input, time_elapsed) {
        const five_minuts = 60 * 5;
        const fifteen_minuts = 60 * 15;

        if (time_elapsed <= five_minuts) {
            input.css('color', 'green');
        } else if (time_elapsed > five_minuts && time_elapsed <= fifteen_minuts) {
            input.css('color', 'orange');
        } else if (time_elapsed > fifteen_minuts) {
            input.css('color', 'red');
            input.addClass('alert-time');
        }
    }

    in_items(f) {
        Object.keys(this.items).forEach(k => {
            f(this.items[k]);
        });
    }

    check_items(items) {
        if (Array.isArray(items.items)) {
            if (this.group_items_by_order) {
                this.render_group_container({ items: items.data || items });
            }

            items.items.forEach(item => {
                if (!this.group_items_by_order) {
                    this.render_group_container({ items: item });
                }

                this.check_item(item, items.data);
            });
        } else {
            Object.values(items.items).forEach(item => {
                this.check_items(item);
            });
        }
    }

    check_available_item(item, order) {
        /*console.log({
            status: this.include_status(this.group_items_by_order ? order.status : item.status),
            item_group: this.include_item_group(item.item_group),
            branch: this.item_available_in_branch(item),
            table: this.item_available_in_table(item)
        })*/
        return [
            this.include_status(this.group_items_by_order ? order.status : item.status),
            this.include_item_group(item.item_group),
            this.item_available_in_branch(item),
            this.item_available_in_table(item)
        ].every(v => v);
    }

    check_item(item, order) {
        const current_item = this.items[item.identifier];
        const data = order.data || order;
        const available = this.check_available_item(item, data);

        if (current_item) {
            if (available) {
                current_item.data = item;
                current_item.render();
            } else {
                current_item.remove();
            }
        } else if (available) {
            this.new_items_keys.push(item.identifier);
            this.add_item(item, order);
        }
    }

    get restricted_tables() {
        return this.table.data.restricted_tables.map(x => x.origin) || [];
    }

    get restricted_rooms() {
        return this.table.data.restricted_rooms.map(x => x.origin) || [];
    }

    get restricted_branches() {
        return this.table.data.restricted_branches.map(x => x.branch) || [];
    }

    item_available_in_table(item) {
        const data = this.table.data;

        if (data.restricted_to_parent_room === 1 && item.room !== data.room) return false;
        if (data.restricted_to_rooms === 1 && !this.restricted_rooms.includes(item.room)) return false;
        if (data.restricted_to_tables === 1 && !this.restricted_tables.includes(item.table)) return false;

        return true;
    }

    item_available_in_branch(item) {
        if (this.table.data.restricted_to_branches === 1 && !this.restricted_branches.includes(item.branch)) return false;
        return true;
    }

    debug_items() {
        Object.values(this.items).forEach(item => {
            if (!this.check_available_item(item.data, item.order.data || item.order)) {
                item.remove();
            }
        });
    }

    remove_item(item) {
        if (this.items[item]) {
            this.items[item].remove();
        }
    }

    add_item(item, order) {
        const order_name = this.group_items_by_order ? item.order_name : item.identifier;
        const container = $(this.command_container()).find(`[data-group="${order_name}"] .item-wrapper`);

        this.items[item.identifier] = new FoodCommand({
            identifier: item.identifier,
            process_manage: this,
            data: item,
            container: container,
            order: order
        });
    }

    include_status(status) {
        return this.table.data.status_managed.includes(status);
    }

    include_item_group(item_group) {
        return this.table.data.items_group.includes("All Item Groups") || this.table.data.items_group.includes(item_group);
    }

    container() {
        return $(`#orders-${this.table.data.name}`);
    }

    command_container() {
        return document.getElementById(this.command_container_name);
    }

    get group_items_by_order() {
        return this.table.data.group_items_by_order === 1;
    }
}