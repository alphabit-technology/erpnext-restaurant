class CheckReservation extends DeskForm{
    form_name = "Check Reservation";
    title = "Check Reservation";
    has_primary_action = false;
    
    constructor(props){
        super(props);

        super.initialize();
    }

    async make(){
        await super.make();

        Object.entries({ width: "100%", height: "50px", fontSize: "20px", fontWeight: "400", }).forEach(([key, value]) => {
            this.get_field("new_reservation").input.style[key] = value;
            this.get_field("assign_table").input.style[key] = value;
        });

        this.make_buttons();

        this.on("restaurant_reservation", "change", (field) => {
            if(field.get_value().length > 0){
                this.assign_table.enable();
            }else{
                this.assign_table.disable();
            }
        });

        setTimeout(() => {
            this.assign_table.remove_class("btn-default").add_class("btn-primary");
            this.new_reservation.remove_class("btn-default").add_class("btn-warning");
            
        }, 0);
    }

    make_buttons() {
        this.assign_table = frappe.jshtml({
            from_html: this.get_field("assign_table").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            }
        }).on("click", () => {
            
        });

        this.assign_table.disable();

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
    form_name = "Reservation";
    title = "Reservation";
    has_primary_action = false;
    
    constructor(props){
        super(props);
    }

    make(){
        super.make();
        //this.make_reservation_button();
        //this.make_check_reservation();

        Object.entries({ width: "100%", height: "60px", fontSize: "25px", fontWeight: "400", }).forEach(([key, value]) => {
            this.get_field("new_reservation").input.style[key] = value;
            this.get_field("assign_table").input.style[key] = value;
        });
    }

    make_reservation_button() {
        this.payment_button = frappe.jshtml({
            from_html: this.get_field("assign_table").input,
            properties: {
                type: "button",
                class: `btn btn-primary btn-lg btn-flat`,
                style: "width: 100%; height: 60px;"
            },
            content: `<span style="font-size: 25px; font-weight: 400">Assign Table</span>`,
            //text: `${__("Pay")}`
        }).on("click", () => {
            /*if (!RM.can_pay) return;
            this.payment_button.disable().val(__("Paying"));
            this.send_payment();*/
        });
    }
}