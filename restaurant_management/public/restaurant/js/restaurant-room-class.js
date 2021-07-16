class RestaurantRoom {
    constructor(data) {
        this.identifier = data.identifier;
        this.edit_form = null;
        this.data = data;
        this.tables = {};
        this.listener();
        this.render();
    }

    listener() {
        frappe.realtime.on(this.data.name, (data) => {
            if (data.action === "Notifications") {
                this.data.orders_count = data.orders_count;
                this.reset_html();
            } else if (data.action === ADD) {
                if (this.data.name === RM.current_room.data.name) {
                    this.append_table(data.table);
                }
            } else if (data.action === DELETE) {
                this.unselect_all_tables();
                if (RM.current_room != null && RM.current_room.data.name === this.data.name) {
                    RM.delete_current_room();
                }
                this.obj.remove();
            } else if (data.action === UPDATE) {
                this.data = data.data;
                this.reset_html();
            }
        });
    }

    append_table(table) {
        if (!Object.keys(this.tables).includes(table.identifier)) {
            let t = new RestaurantObject(this, table);
            if (RM.editing) {
                setTimeout(() => {
                    t.select();
                    this.resize_container(t);
                    this.tables[t.identifier] = t;
                }, 0);
            }
        }
    }

    resize_container(obj) {
        let dsy = this.obj_max_heigth;
        let dsx = this.obj_max_width;

        if (dsx == null || (obj.absolute_width() > dsx.absolute_width())) {
            this.obj_max_width = obj;
            dsx = obj;
        }

        if (dsy == null || (obj.absolute_height() > dsy.absolute_height())) {
            this.obj_max_heigth = obj;
            dsy = obj;
        }

        obj.room.tables_container.css([
            {prop: 'min-width', value: (dsx.absolute_width() + 35) + 'px'},
            {prop: 'min-height', value: dsy.absolute_height() + 'px'}
        ]);
    }

    render() {
        this.tables_container = new JSHtml({
            tag: "div", properties: {class: "table-container"}
        }).on("click", () => {
            RM.unselect_all_tables();
        });

        this.obj = new JSHtml({
            tag: "div",
            properties: {class: "btn-default button room"},
            content: this.template()
        }).on("click", () => {
            this.select();
        });
        RM.rooms_container.append(this.obj.html());
        RM.floor_map.append(this.tables_container.html());
    }

    template() {
        this.indicator = new JSHtml({
            tag: "span",
            properties: {class: `badge ${this.data.orders_count > 0 ? 'bg-yellow' : 'bg-none'}`},
            content: this.data.orders_count
        });

        this.description = new JSHtml({
            tag: "span",
            content: this.data.description
        })

        return `<span class="fa"/> ${this.description.html()}${this.indicator.html()}`
    }

    select() {
        this.obj.toggle_common('button.room', 'active');
        this.tables_container.toggle_common('table-container', 'active');
        RM.set_current_room(this);
        this.get_tables();
    }

    in_tables(f, condition = null) {
        Object.keys(this.tables).forEach((table) => {
            if (typeof this.tables[table] != "undefined") {
                if (condition == null || this.tables[table].data[condition.field] === condition.value) {
                    f(this.tables[table], table, this.tables);
                }
            }
        });
    }

    hide_tables() {
        this.in_tables((table) => {
            table.hide();
        });
    }

    unselect_all_tables() {
        this.in_tables((table) => {
            table.unselect(true);
        });
    }

    edit() {
        if (this.edit_form == null) {
            this.edit_form = new CETIForm({
                doctype: "Restaurant Object",
                docname: this.data.name,
                form_name: "restaurant-room",
                call_back: () => {
                    this.edit_form.hide();
                },
                title: __("Update Room"),
                field_properties: {
                    type: {read_only: true}
                }
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
        CETI.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "_delete",
            always: (r) => {
                RM.ready();
            },
            freeze: false
        });
    }

    show_tables() {
        this.in_tables((table) => {
            table.show();
        });
    }

    get_tables() {
        RM.working("Loading Objects");
        frappe.set_route(`/restaurant-manage?restaurant_room=${this.data.name}`)
        CETI.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "get_objects",
            args: {},
            always: (r) => {
                this.make_tables(r.message);
                RM.ready();
            },
            freeze: false
        });
    }

    make_tables(tables = []) {
        let _tables = Object.keys(this.tables);

        tables.forEach((table) => {
            if (_tables.includes(table.name)) {
                this.tables[table.name].reset_data(table);
            } else {
                this.tables[table.name] = new RestaurantObject(this, table);
            }
            this.tables[table.name].show();
            setTimeout(() => {
                this.resize_container(this.tables[table.name]);
            });
        });
    }

    add_object(t) {
        RM.working("Adding Table");
        CETI.api.call({
            model: "Restaurant Object",
            name: this.data.name,
            method: "add_object",
            args: {t: t},
            always: () => {
                RM.ready();
            }
        });
    }

    set_z_index() {
        this.in_tables((table) => {
            let max_z_index = RM.max_z_index;
            RM.max_z_index = (max_z_index < table.get_z_index()) ? table.get_z_index() : max_z_index;
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