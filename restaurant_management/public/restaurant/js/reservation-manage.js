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

        Object.entries({ width: "100%", height: "50px", fontSize: "20px", fontWeight: "400", }).forEach(([key, value]) => {
            this.get_field("new_reservation").input.style[key] = value;
            this.get_field("attend").input.style[key] = value;
        });

        this.make_buttons();

        this.on("i_have_reservation", "change", (field) => {
            if (field.get_value() === 1) {
                this.get_field("reservation").$wrapper.show();
                this.trigger("reservation", "change");
                //this.get_field("add_reservation_wrapper").wrapper[0].style.display = "none";
            } else {
                if(this.reservation_form){
                    this.reservation_form.doc_name = null;
                    this.reservation_form.reload(null, true);
                }

                this.get_field("reservation").$wrapper.hide();
                //this.get_field("add_reservation_wrapper").wrapper[0].style.display = "block";
            }
        });

        const set_reservation_form_doc_name = (doc_name) => {
            if(this.reservation_form){
                this.reservation_form.doc_name = doc_name;
                this.reservation_form.reload(null, true);
            }
        }

        this.on("reservation", "change", (field) => {
            const reservation = field.get_value();
            if(reservation.length > 0){
                //this.attend.enable();
            }else{
                //this.attend.disable();
            }
            set_reservation_form_doc_name(reservation);
            //this.attend[field.get_value().length > 0 ? "enable" : "disable"]();
        });

        this.get_field("new_reservation").input.addEventListener("click", (event) => {
            event.preventDefault();
            if (this.reservation_form) {
                this.reservation_form.save();
            }
        });

        this.get_field("attend").input.addEventListener("click", (event) => {
            event.preventDefault();
            if (this.reservation_form) {
                this.reservation_form.save({
                    success: (data) => {
                        this.reservation_form && this.reservation_form.execute();
                    }
                });
            }
        });
        
        this.make_reservation_form();

        setTimeout(() => {
            //this.clear_inputs();
            this.attend.remove_class("btn-default").add_class("btn-primary");
            this.new_reservation.remove_class("btn-default").add_class("btn-warning");
            
            $(this.get_field("add_reservation_wrapper").wrapper[0]).show();
            //this.trigger("i_have_reservation", "change");
        }, 0);
    }

    make_reservation_form() {
        this.reservation_form = new Reservation({
            reservation_manage: this,
            location: $(this.get_field("add_reservation_wrapper").wrapper[0])
        });
    }

    make_buttons() {
        this.attend = frappe.jshtml({
            from_html: this.get_field("attend").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            }
        }).on("click", () => {
            
        });

        //this.attend.disable();

        this.new_reservation = frappe.jshtml({
            from_html: this.get_field("new_reservation").input,
            properties: {
                type: "button",
                class: `btn btn-warning btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            }
        }).on("click", () => {

        });
    }

}

class Reservation extends DeskForm{
    form_name = "Check In";
    title = "Reservation";
    has_primary_action = false;
    doc_name = null;
    
    constructor(props){
        super(props);

        super.initialize();
    }

    execute(){
        const table = this.get_value("table");
        const room = this.get_value("room");

        if(table.length > 0){
            RM.navigate_room = room;
            RM.navigate_table = table;
            frappe.set_route(`restaurant-manage?restaurant_room=${room}`);
            //RM.go_to_table(table, room);
        }else{
            RM.reservation = this.doc_name;
            //RM.permanent_message = "Checking for available table..."
            //RM.working("Checking for available table...");
            /*new WaitingMessage({
                reservation_manage: this.reservation_manage,
                title: "Checking for available table...",
            });*/
            this.reservation_manage.hide();
        }
    }

    clear_inputs() {
        this.fields.forEach((field) => {
            this.set_value(field.fieldname, "");
        });
    }

    make(){
        super.make();
        console.log(["Reservation make", this._wrapper])
        setTimeout(() => {
            this.show();
            
            this.reservation_manage.trigger("i_have_reservation", "change");
        }, 0);
    }
}

class WaitingMessage{
    constructor(props){
        this.props = props;
        this.make();
    }

    make(){
        this.dialog = new frappe.ui.Dialog({
            title: this.props.title,
            static: true,
            fields: [
                {
                    fieldtype: "HTML",
                    fieldname: "message",
                    options: `<div class="text-center">
                        <i class="fa fa-spinner fa-spin fa-3x fa-fw"></i>
                        <span class="sr-only">Loading...</span>
                    </div>`
                }
            ]
        });

        this.dialog.show();
    }
}