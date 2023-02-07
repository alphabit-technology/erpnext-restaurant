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

        Object.entries({fontSize: "18px"}).forEach(([key, value]) => {
            this.get_field("save").input.style[key] = value;
            this.get_field("attend").input.style[key] = value;
            this.get_field("cancel").input.style[key] = value;
        });

        this.make_reservation_form();
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
            set_reservation_form_doc_name(field.get_value());
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

        setTimeout(() => {
            ["save", "attend", "cancel"].forEach((field_name) => {
                this.super_container_field(field_name).style.padding = "5px";
            });

            this.attend.remove_class("btn-default btn-xs").add_class("btn-primary btn-lg btn-block");
            this.save.remove_class("btn-default btn-xs").add_class("btn-warning btn-lg btn-block");
            this.cancel.remove_class("btn-default btn-xs").add_class("btn-danger btn-lg btn-block");
            
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

    on_reload() {
        this.trigger("table_description", "change");
    }

    make_events() {
        this.on("table_description", "change", (field) => {
            this.set_button_status();
        });

        this.on("customer", "change", (field) => {
            frappe.db.get_value("Customer", field.value, "mobile_no").then((data) => {
                if (data.message && data.message.mobile_no && data.message.mobile_no.length > 0){
                    this.set_value("contact_number", data.message.mobile_no);
                }
            });
        });
    }

    async make(){
        await super.make();

        this.make_events();

        //this.hide_field(["table", "room", "table_description"]);

        setTimeout(() => {
            this.show();
            
            this.reservation_manage.trigger("i_have_reservation", "change");
        }, 0);
    }

    static render(table, wrapper) {
        const id = RM.uuid();
        const fields = [
            {
                fieldname: "customer", label: "Customer"
            },
            {
                fieldname: "reservation_time", label: "From"
            },
        ];

        wrapper.empty().append(`
            <div id="${id}" style="padding:5px">
                <div style="border:var(--default_line); border-radius: 5px;">
                    <div id="headingOne">
                        <h5 class="mb-0">
                            <button style="margin-bottom:-15px" class="btn btn-link" data-toggle="collapse" data-target="#${id}-container" aria-expanded="true" aria-controls="collapseOne">
                                <h4>${__("Reservations")}</h4>
                            </button>
                        </h5>
                    </div>

                    <div id="${id}-container" class="collapse" aria-labelledby="headingOne" data-parent="#${id}">
                        <table class="table table-condensed no-border" style="margin:0;">
                            <tbody class="rows"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `);

        const datesAreOnSameDay = (first, second) =>
            first.getFullYear() === second.getFullYear() &&
            first.getMonth() === second.getMonth() &&
            first.getDate() === second.getDate();

        frappe.db.get_list("Restaurant Booking", {
            fields: ["*"],
            filters: {
                table: table,
                reservation_time: [">=", moment().startOf('day').format("YYYY-MM-DD HH:mm:ss")],
            },
            order_by: "reservation_time"
        }).then(bookings => {
            if(bookings.length === 0){
                wrapper.find('.rows').append(`
                    <tr>
                        <td colspan="2" style="text-align:center;">
                            <h4>${__("No reservations for this table")}</h4>
                        </td>
                    </tr>
                `);
            }else{
                wrapper.find('.rows').append(
                    bookings.map(booking => {
                        const row = $(`<tr></tr>`);

                        row.append(
                            fields.map(field => {
                                let value = booking[field.fieldname];

                                if (field.fieldname == "customer") {
                                    value = "<strong><span class='fa fa-user'></span></strong> " + (booking.customer || booking.customer_name);
                                }

                                if (field.fieldname == "reservation_time") {
                                    const end = moment(booking.reservation_end_time);
                                    const start = moment();
                                    const diff = end.diff(start, "days");
                                    const join = " <strong style='color:orange;'>-></strong> ";

                                    if (datesAreOnSameDay(new Date(booking.reservation_time), new Date(booking.reservation_end_time))) {
                                        if (diff < 7) {
                                            value = moment(value).calendar();
                                        } else {
                                            value = moment(value).format("LLLL");
                                        }
                                        value += join + moment(booking.reservation_end_time).format("h:mm a");
                                    } else {
                                        value = moment(value).calendar() + join + moment(booking.reservation_end_time).calendar();
                                    }

                                    value = "<strong><span class='fa fa-calendar'></span></strong> " + value;
                                }

                                return $(`<td>${value}</td>`);
                            })
                        );
                        return row;
                    })
                );
            }
        });
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