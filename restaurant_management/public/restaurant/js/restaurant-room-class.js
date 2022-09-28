class RestaurantRoom extends ObjectManage {
    constructor(data) {
        super(data);

        this.identifier = data.identifier;
        this.edit_form = null;
        this.data = data;
        this.init_synchronize();
        this.render();
    }

    init_synchronize() {
        frappe.realtime.on(this.data.name, (data) => {
            if (data.action === "Notifications") {
                this.data.orders_count = data.orders_count;
                this.reset_html();
            } else if (data.action === ADD) {
                if (this.data.name === RM.current_room.data.name) {
                    this.append_table(data.table, true);
                }
            } else if (data.action === DELETE) {
                this.unselect_all_tables();
                if (
                    RM.current_room != null &&
                    RM.current_room.data.name === this.data.name
                ) {
                    RM.delete_current_room();
                }
                this.obj.remove();
            } else if (data.action === UPDATE) {
                this.data = data.data;
                this.reset_html();
            }
        });
    }

    remove() {
        this.obj.remove();
        this.tables_container.remove();
    }

    make_objects(tables = []) {
        tables.forEach((table, index) => {
            table.index = index;

            this.append_table(table);
        });
    }

    append_table(table, adding = false) {
        super.append_child({
            child: table,
            exist: t => {
                t.reset_data(table);
                if (!adding) t.show();
            },
            not_exist: () => {
                return new RestaurantObject(this, table);
            },
            always: t => {
                if (RM.editing && adding && t) {
                    setTimeout(() => {
                        t.select();
                        this.resize_container(t);
                    }, 0);
                }
            }
        });
    }

    resize_container(obj) {
        let dsy = this.obj_max_heigth;
        let dsx = this.obj_max_width;

        if (dsx == null || obj.absolute_width > dsx.absolute_width) {
            this.obj_max_width = obj;
            dsx = obj;
        }

        if (dsy == null || obj.absolute_height > dsy.absolute_height) {
            this.obj_max_heigth = obj;
            dsy = obj;
        }

        obj.room.tables_container.css([{
            prop: "min-width",
            value: dsx.absolute_width + 35 + "px",
        },
        {
            prop: "min-height",
            value: dsy.absolute_height + "px",
        }
        ]);
    }

    render() {
        this.tables_container = frappe.jshtml({
            tag: "div",
            properties: {
                class: "table-container",
            }
        }).on("click", () => {
            RM.unselect_all_tables();
        });

        this.obj = frappe.jshtml({
            tag: "div",
            properties: {
                class: "btn-default button room",
            },
            content: this.template,
        }).on("click", () => {
            this.select();
        });
        RM.rooms_container.append(this.obj.html());
        RM.floor_map.append(this.tables_container.html());
    }

    get template() {
        this.indicator = frappe.jshtml({
            tag: "span",
            properties: {
                class: `badge ${this.data.orders_count > 0 ? "bg-yellow" : "bg-none"}`,
            },
            content: this.data.orders_count,
        });

        this.description = frappe.jshtml({
            tag: "span",
            content: this.data.description,
        });

        return `<span class="fa"></span> ${this.description.html()}${this.indicator.html()}`;
    }

    select() {
        this.obj.toggle_common("button.room", "active");
        this.tables_container.toggle_common("table-container", "active");
        RM.set_current_room(this);
        this.get_tables();
    }

    in_tables(f, condition = null) {
        super.in_childs((t, key) => {
            if (condition == null || condition.value === t.data[condition.field]) {
                f(t, key);
            }
        });
    }

    hide_tables() {
        this.in_tables(t => {
            t.hide();
        });
    }

    unselect_all_tables() {
        this.in_tables(t => {
            t.unselect(true);
        });
    }

    edit() {
        if (this.edit_form == null) {
            this.edit_form = new DeskForm({
                doc_name: this.data.name,
                form_name: "Restaurant Room",
                call_back: () => {
                    this.edit_form.hide();
                },
                title: __("Update Room"),
                field_properties: {
                    type: {
                        read_only: true,
                    },
                    room: {
                        hidden: true,
                    }
                },
            });
        } else {
            this.edit_form.reload();
            this.edit_form.show();
        }
    }

    delete() {
        if (RM.busy_message()) {
            return;
        }
        RM.working("Deleting Room");
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "_delete",
            always: (r) => {
                RM.ready();
            },
            freeze: false,
        });
    }

    show_tables() {
        this.in_tables(t => {
            t.show();
        });
    }

    get_tables() {
        RM.working("Loading Objects");
        frappe.set_route(`/restaurant-manage?restaurant_room=${this.data.name}`);
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "get_objects",
            args: {},
            always: (r) => {
                this.make_objects(r.message);
                RM.ready();
            },
            freeze: false,
        });
    }

    add_object(t) {
        RM.working("Adding Table");
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "add_object",
            args: {
                t: t,
            },
            always: () => {
                RM.ready();
            },
        });
    }

    reset_html() {
        this.indicator.val(this.data.orders_count);
        this.description.val(this.data.description);

        if (flt(this.data.orders_count) > 0) {
            this.indicator.remove_class("bg-none").add_class("bg-yellow");
        } else {
            this.indicator.remove_class("bg-yellow").add_class("bg-none");
        }
    }

    update_notifications(data) {
        this.data.orders_count = data;
        this.indicator.val(data);

        if (flt(data) > 0) {
            this.indicator.remove_class("bg-none").add_class("bg-yellow");
        } else {
            this.indicator.remove_class("bg-yellow").add_class("bg-none");
        }
    }
}