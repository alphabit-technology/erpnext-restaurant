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

        this.make_reservation_form();
        this.make_actions();

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
            $(this.get_field("add_reservation_wrapper").wrapper[0]).show();
        }, 0);
    }

    make_reservation_form() {
        this.reservation_form ??= new Reservation({
            reservation_manage: this,
            location: $(this.get_field("add_reservation_wrapper").wrapper[0])
        });
    }

    make_actions() {
        [
            { name: "edit_table", icon: "fa fa-refresh", label: "Table", type:"primary"},
            { name: "check_in", label: "Check In", type:"success", icon: "fa fa-check-square-o"},
            { name: "cancel", label: "Cancel", type: "danger", confirm: true, icon: "fa fa-times"},
            { name: "finish", label: "Finish", type: "warning", confirm: true, icon: "fa fa-check"},
        ].map(action => {
            return this.add_action(action, () => {
                this.reservation_form && this.reservation_form[action.name]();
            });
        });
    }

    set_button_status(table, doc_name) {
        if (table && table.length > 0) {
            this.actions.check_in.val(`Check In <strong style="padding-left:5px;"> ${table}</strong>`);
        } else {
            this.actions.check_in.val("Check Table");
        }

        if(!doc_name){
            this.actions.cancel.disable();
            this.actions.finish.disable();
            this.actions.edit_table.disable();
        }else{
            this.actions.cancel.enable();
            this.actions.finish.enable();

            if (table && table.length > 0 && this.reservation_form.get_value("status") === "Open"){
                this.actions.edit_table.enable();
            }else{
                this.actions.edit_table.disable();
            }
        }
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

    cancel(){
        this.set_value("status", "Cancelled");
        this.save({
            success: () => {
                this.reservation_manage.reload(null, true);
            }
        });
    }

    hide() {
        this.reservation_manage.hide();
    }

    show() {
        this.reservation_manage.show();
    }

    close() {
        this.set_value("status", "Closed");
        this.save({
            success: () => {
                this.reservation_manage.reload(null, true);
            }
        });
    }

    check_in(){
        const [current_time, reservation_time, reservation_end_time] = [
            , ...this.get_value(["reservation_time", "reservation_end_time"])
        ].map(time => moment(time).format("YYYY-MM-DD HH:mm:ss"));

        const [room, table, reservation_status] = this.get_value(["room", "table", "status"]);

        const check_in = () => {
            this.save({
                success: () => {
                    if(table && table.length){
                        RM.navigate_room = room;
                        RM.navigate_table = table;
                        frappe.set_route(`restaurant-manage?restaurant_room=${room}`);
                    }else{
                        this.edit_table();
                    }
                }
            });
        }

        if (!((current_time >= reservation_time && current_time <= reservation_end_time) || reservation_status === "Waitlisted")) {
            if (table && table.length > 0) {
                frappe.confirm(
                    'Reservation time is not in range. Do you want to continue?',
                    () => {
                        this.set_value("status", "Waitlisted");
                        check_in();
                    },
                );
                return;
            }
        }

        check_in();
    }

    edit_table(){
        RM.reservation = this;
        RM.working("Checking for available table...");
        this.reservation_manage.hide();
    }

    clear_inputs() {
        this.set_value("status", "Open");
        this.set_value("table", "");
    }

    on_reload() {
        this.trigger("table", "change");
    }

    make_events() {
        this.on("table_description", "change", (field) => {
            this.reservation_manage && this.reservation_manage.set_button_status(this.get_value("table_description"), this.doc_name);
        });

        this.on("customer", "change", (field) => {
            frappe.db.get_value("Customer", field.value, "mobile_no").then((data) => {
                if (data.message && data.message.mobile_no && data.message.mobile_no.length > 0){
                    this.set_value("contact_number", data.message.mobile_no);
                }
            });
        });

        this.on("reservation_time", "change", (field) => {
            const [start_date, end_time] = this.get_value(["reservation_time", "reservation_end_time"]);

            if (!start_date || start_date.length === 0) return;

            if (!end_time || end_time.length === 0 || moment(end_time).isBefore(start_date)) {
                this.set_value("reservation_end_time", moment(start_date).add(2, "hours").format("YYYY-MM-DD HH:mm:ss"));
            }
        });
    }

    async make(){
        await super.make();

        this.make_events();

        this.hide_field(["table", "room", "table_description"]);

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
                                    const [start, end] = [moment(), moment(booking.reservation_end_time)];
                                    const diff = end.diff(start, "days");
                                    const join = " <strong style='color:orange;'>-></strong> ";

                                    if (datesAreOnSameDay(new Date(booking.reservation_time), new Date(booking.reservation_end_time))) {
                                        value = diff < 7 ? moment(value).calendar() : moment(value).format("LLLL");
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