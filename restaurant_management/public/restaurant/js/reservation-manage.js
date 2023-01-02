class CheckIn extends DeskForm{
    form_name = "Check In Search";
    title = "Check In";
    has_primary_action = false;
    doc_name = null;
    
    constructor(props){
        super(props);

        super.initialize();
    }

    async make(){
        await super.make();

        Object.entries({ width: "100%", height: "50px", fontSize: "18px", fontWeight: "400", }).forEach(([key, value]) => {
            this.get_field("save").input.style[key] = value;
            this.get_field("attend").input.style[key] = value;
            this.get_field("cancel").input.style[key] = value;
        });

        this.make_buttons();

        const set_reservation_form_doc_name = (doc_name) => {
            if (this.reservation_form) {
                this.reservation_form.doc_name = doc_name;
                this.reservation_form.reload(null, true);
            }
        }

        this.on("i_have_reservation", "change", (field) => {
            if (field.get_value() === 1) {
                this.get_field("reservation").$wrapper.show();
                this.trigger("reservation", "change");
            } else {
                set_reservation_form_doc_name(null);

                this.get_field("reservation").$wrapper.hide();
            }
        });

        this.on("reservation", "change", (field) => {
            const reservation = field.get_value();

            set_reservation_form_doc_name(reservation);
        });

        this.set_field_property("reservation", "get_query", () => {
            return {
                filters: {
                    company: ["=", RM.pos_profile.company],
                    status: ['in', ['Open', 'Waitlisted']],
                    reservation_time: [">=", moment().startOf('day').format("YYYY-MM-DD HH:mm:ss")],
                }
            }
        });

        this.make_reservation_form();

        setTimeout(() => {
            this.attend.remove_class("btn-default").add_class("btn-primary");
            this.save.remove_class("btn-default").add_class("btn-warning");
            this.cancel.remove_class("btn-default").add_class("btn-danger");
            
            $(this.get_field("add_reservation_wrapper").wrapper[0]).show();
        }, 0);
    }

    make_reservation_form() {
        if(!this.reservation_form) {
            this.reservation_form = new Reservation({
                reservation_manage: this,
                location: $(this.get_field("add_reservation_wrapper").wrapper[0])
            });
        }
    }

    make_buttons() {
        this.attend = frappe.jshtml({
            from_html: this.get_field("attend").input,
            properties: {
                type: "button",
                class: `btn btn-warning btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            }
        }).on("click", () => {
            if (this.reservation_form) {
                this.reservation_form.save({
                    success: (data) => {
                        this.reservation_form && this.reservation_form.execute();
                    }
                });
            }
        });

        this.save = frappe.jshtml({
            from_html: this.get_field("save").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            }
        }).on("click", () => {
            this.reservation_form.execute(true);
        });

        this.cancel = frappe.jshtml({
            from_html: this.get_field("cancel").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            },
            content: "{{text}}",
            text: "Cancel"
        }).on("click", () => {
            if (this.reservation_form) {
                this.reservation_form.set_value("status", "Cancelled");
                this.reservation_form.save({
                    success: (data) => {
                        this.reservation_form.execute(true);
                    }
                });
            }
        }, DOUBLE_CLICK_DELAY);
    }

}

class Reservation extends DeskForm {
    form_name = "Check In";
    title = "Reservation";
    has_primary_action = false;
    doc_name = null;
    
    constructor(props){
        super(props);

        super.initialize();
    }

    set_button_status() {
        const table = this.get_value("table_description");
        if (table && table.length > 0) {
            this.reservation_manage.get_field("attend").input.innerHTML = "Check In " + table;
            this.reservation_manage.save.enable();
        } else {
            this.reservation_manage.save.disable();
            this.reservation_manage.get_field("attend").input.innerHTML = "Check Table";
        }

        if(this.doc_name){
            this.reservation_manage.cancel.enable();
        }else{
            this.reservation_manage.cancel.disable();
        }
    }

    execute(change_table=false){
        const table = this.get_value("table");
        const room = this.get_value("room");

        if(table.length > 0 && change_table === false){
            RM.navigate_room = room;
            RM.navigate_table = table;
            frappe.set_route(`restaurant-manage?restaurant_room=${room}`);
        }else{
            RM.reservation = this;
            RM.working("Checking for available table...");
            this.reservation_manage.hide();
        }
    }

    clear_inputs() {
        this.set_value("status", "Open");
        this.set_value("table", "");
    }

    async make(){
        await super.make();

        this.on("table_description", "change", (field) => {
            this.set_button_status();
        });

        this.hide_field(["table", "room", "table_description"]);

        setTimeout(() => {
            this.show();
            
            this.reservation_manage.trigger("i_have_reservation", "change");
        }, 0);
    }
}

class WaitingMessage{
    constructor(props){
        Object.assign(this, props);
        this.make();
    }

    make(){
        this.dialog = new frappe.ui.Dialog({
            title: this.title,
            static: this.static || false,
            fields: [
                {
                    fieldtype: "HTML",
                    fieldname: "message",
                    options: `<div class="text-center">
                        ${this.icon || ""}
                        <span class="sr-only">${this.message}</span>
                    </div>`
                }
            ]
        });

        this.dialog.show();
    }
}

const spinner = (props) => {
    return new WaitingMessage({
        title: props.title,
        message: props.message,
        icon: `<i class="fa fa-spinner fa-spin fa-3x fa-fw hide"></i>`,
        static: props.static || false
    });
}