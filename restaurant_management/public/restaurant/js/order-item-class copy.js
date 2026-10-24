class OrderItem {
  enabled_form_fields_status = {
    "Pending": ["qty", "rate", "notes", "batch_no", "serial_no"],
    "Attending": ["qty", "rate", "notes", "batch_no", "serial_no"],
    "Sent": ["notes"],
    "Processing": ["notes"]
  }

  constructor(options) {
    Object.assign(this, options);

    this.attending_status = this.order.data.attending_status;
    this.status_enabled_for_edit = [this.attending_status, "Pending", null, undefined, ""];
    this.status_enabled_for_delete = [this.attending_status, "Pending", "Sent", null, undefined, ""];

    this.render();
    this.init_synchronize();
  }

  init_synchronize() {
    frappe.realtime.on("pos_profile_update", () => {
      setTimeout(() => {
        this.active_editor();
      }, 0);
    });
  }

  hide() {
    this.row.hide();
  }

  get is_enabled_to_edit() {
    return (this.status_enabled_for_edit.includes(this.data.status)) &&
      RM.check_permissions("order", this.order, "write");
  }

  get is_enabled_to_delete() {
    return (
      this.status_enabled_for_delete.includes(this.data.status)) &&
      (
        RM.check_permissions("order", this.order, "write")// &&
        //RM.check_permissions("pos", null, "delete")
      );
  }

  reset_html() {
    const ps = this.data.process_status_data;

    this.amount.val(RM.format_currency(this.data.amount));
    this.detail.val(this.html_detail);
    this.notes.val(this.data.notes);
    this.icon.val(`<i class="${ps.icon}" style="color: ${ps.color}"></i>`);

    this.form_editor && this.form_editor.reload(this.data, false);
  }

  delete() {
    if (RM.busy_message() || !this.is_enabled_to_delete) return;
    this.data.qty = 0;
    if (this.data.status === "Pending") {
      this.order.delete_item(this.data.identifier);
    } else {
      this.update(true);
    }
  }

  remove() {
    this.row.remove();
  }

  render() {
    console.log('FAZ OU CALL RENDER');
    this.row = frappe.jshtml({
      tag: "li",
      properties: { class: "media event" },
      content: this.template
    });

    this.order.container.append(this.row.html());
    //FIX 31-05-2025
    //this.select(false);
    //const teste = new TableOrder();
    //teste.select();
  }

  async select(scroller = false) {
    this.order.current_item = this;
    this.order.order_manage.check_item_editor_status(this);
    this.row.toggle_common('media.event', 'selected');

    //this.order.order_manage.toggle_main_section("items");

    if (scroller) this.order.scroller();
    console.log('ACHOOOO ASYNC SELECT');
    console.log('ORDER ITEM ', this.order.current_item);

  
    //FIX 30-05-2025
    //this.form_editor.field_properties.ponto_carne.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {
        this.form_editor.field_properties.ponto_carne.hidden = true;
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
        this.form_editor.field_properties.ponto_carne.hidden = true;
  
      }
    } else if (this.form_editor && this.form_editor.fields_dict.ponto_carne._label === "") {
      document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      this.form_editor.field_properties.ponto_carne.hidden = true;
    }

    //this.form_editor.field_properties.dish_side_01.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {      
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >0) {
          this.form_editor.field_properties.dish_side_01.hidden = false;
          this.form_editor.field_properties.dish_side_01.label = this.order.current_item.data.dish_sides[0].item_name;
          this.form_editor.fields_dict.dish_side_01._label = this.order.current_item.data.dish_sides[0].item_name
        } else {
          if (document.querySelector('[data-fieldname="dish_side_01"]')) {
            this.form_editor.field_properties.dish_side_01.hidden = true;
            //document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
            this.form_editor.field_properties.dish_side_01.hidden = true;
  
            //document.querySelector('[data-fieldname="dish_side_01"]').remove()
          };
  
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_01._label === "") {
      //document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >0) {
        this.form_editor.field_properties.dish_side_01.hidden = false;
        this.form_editor.field_properties.dish_side_01.label = this.order.current_item.data.dish_sides[0].item_name;
        this.form_editor.fields_dict.dish_side_01._label = this.order.current_item.data.dish_sides[0].item_name
      } else {

        if (document.querySelector('[data-fieldname="dish_side_01"]')) {
          this.form_editor.field_properties.dish_side_01.hidden = true;          
          //document.querySelector('[data-fieldname="dish_side_01"]').remove()
        };
      }
    }
    

    //this.form_editor.field_properties.dish_side_02.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {      
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >1) {
          this.form_editor.field_properties.dish_side_02.hidden = false;
          this.form_editor.field_properties.dish_side_02.label = this.order.current_item.data.dish_sides[1].item_name;
          this.form_editor.fields_dict.dish_side_02._label = this.order.current_item.data.dish_sides[1].item_name
        } else {

          if (document.querySelector('[data-fieldname="dish_side_02"]')) {
            this.form_editor.field_properties.dish_side_02.hidden = true;
            document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
            this.form_editor.field_properties.dish_side_02.hidden = true;
              
            //document.querySelector('[data-fieldname="dish_side_02"]').remove()
          };
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_02._label === "") {
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >1) {
        this.form_editor.field_properties.dish_side_02.hidden = false;
        this.form_editor.field_properties.dish_side_02.label = this.order.current_item.data.dish_sides[1].item_name;
        this.form_editor.fields_dict.dish_side_02._label = this.order.current_item.data.dish_sides[1].item_name
      } else {

        if (document.querySelector('[data-fieldname="dish_side_02"]')) {
          document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
          this.form_editor.field_properties.dish_side_02.hidden = true;
  
          //document.querySelector('[data-fieldname="dish_side_02"]').remove()
        };
      }
    }



    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >2) {
          this.form_editor.field_properties.dish_side_03.hidden = false;
          this.form_editor.field_properties.dish_side_03.label = this.order.current_item.data.dish_sides[2].item_name;
          this.form_editor.fields_dict.dish_side_03._label = this.order.current_item.data.dish_sides[2].item_name
        } else {

          if (document.querySelector('[data-fieldname="dish_side_03"]')) {
            this.form_editor.field_properties.dish_side_03.hidden = true;
            document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
            this.form_editor.field_properties.dish_side_03.hidden = true;
  
            //document.querySelector('[data-fieldname="dish_side_03"]').remove()
          };
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_03._label === "") {
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >3) {
        this.form_editor.field_properties.dish_side_03.hidden = false;
        this.form_editor.field_properties.dish_side_03.label = this.order.current_item.data.dish_sides[3].item_name;
        this.form_editor.fields_dict.dish_side_03._label = this.order.current_item.data.dish_sides[3].item_name
      } else {

        if (document.querySelector('[data-fieldname="dish_side_03"]')) {
          document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
          this.form_editor.field_properties.dish_side_03.hidden = true;
  
          //document.querySelector('[data-fieldname="dish_side_03"]').remove()
        };
      }
    }

    
    //this.form_editor.field_properties.dish_side_04.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >4) {
          this.form_editor.field_properties.dish_side_04.hidden = false;
          this.form_editor.field_properties.dish_side_04.label = this.order.current_item.data.dish_sides[4].item_name;
          this.form_editor.fields_dict.dish_side_04._label = this.order.current_item.data.dish_sides[4].item_name
        } else {

          if (document.querySelector('[data-fieldname="dish_side_04"]')) {
            this.form_editor.field_properties.dish_side_04.hidden = true;
            document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
            this.form_editor.field_properties.dish_side_04.hidden = true;
  
            //document.querySelector('[data-fieldname="dish_side_04"]').remove()
          };
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_04._label === "") {
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >4) {
        this.form_editor.field_properties.dish_side_04.hidden = false;
        this.form_editor.field_properties.dish_side_04.label = this.order.current_item.data.dish_sides[4].item_name;
        this.form_editor.fields_dict.dish_side_04._label = this.order.current_item.data.dish_sides[4].item_name
      } else {

        if (document.querySelector('[data-fieldname="dish_side_04"]')) {
          document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
          this.form_editor.field_properties.dish_side_04.hidden = true;
            
          //document.querySelector('[data-fieldname="dish_side_04"]').remove()
        };
      }
    }


    //this.form_editor.field_properties.dish_side_05.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >5) {
          this.form_editor.field_properties.dish_side_05.hidden = false;
          this.form_editor.field_properties.dish_side_05.label = this.order.current_item.data.dish_sides[5].item_name;
          this.form_editor.fields_dict.dish_side_05._label = this.order.current_item.data.dish_sides[5].item_name
        } else {

          if (document.querySelector('[data-fieldname="dish_side_05"]')) {
            this.form_editor.field_properties.dish_side_05.hidden = true;
            document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
            this.form_editor.field_properties.dish_side_05.hidden = true;
  
            //document.querySelector('[data-fieldname="dish_side_05"]').remove()
          };
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_05._label === "") {
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >5) {
        this.form_editor.field_properties.dish_side_05.hidden = false;
        this.form_editor.field_properties.dish_side_05.label = this.order.current_item.data.dish_sides[5].item_name;
        this.form_editor.fields_dict.dish_side_05._label = this.order.current_item.data.dish_sides[5].item_name
      } else {

        if (document.querySelector('[data-fieldname="dish_side_05"]')) {
          document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
          this.form_editor.field_properties.dish_side_05.hidden = true;
  
          //document.querySelector('[data-fieldname="dish_side_05"]').remove()
        };
      }
    }


    //this.form_editor.field_properties.dish_side_06.hidden = this.data.item_group != "Comidas"
    if (this.data.item_group != "Comidas") {
      if (this.form_editor) {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >6) {
          this.form_editor.field_properties.dish_side_06.hidden = false;
          this.form_editor.field_properties.dish_side_06.label = this.order.current_item.data.dish_sides[5].item_name;
          this.form_editor.fields_dict.dish_side_06._label = this.order.current_item.data.dish_sides[5].item_name
        } else {

          if (document.querySelector('[data-fieldname="dish_side_06"]')) {
            this.form_editor.field_properties.dish_side_06.hidden = true;
            document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
            this.form_editor.field_properties.dish_side_06.hidden = true;
            //document.querySelector('[data-fieldname="dish_side_06"]').remove();
  
          }
        }
      }
    } else if (this.form_editor && this.form_editor.fields_dict.dish_side_06._label === "") {
      //Check if has DISH SIDES
      if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >6) {
        this.form_editor.field_properties.dish_side_06.hidden = false;
        this.form_editor.field_properties.dish_side_06.label = this.order.current_item.data.dish_sides[6].item_name;
        this.form_editor.fields_dict.dish_side_06._label = this.order.current_item.data.dish_sides[6].item_name
      } else {
        if (document.querySelector('[data-fieldname="dish_side_06"]')) {
          document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
          this.form_editor.field_properties.dish_side_06.hidden = true;
          //document.querySelector('[data-fieldname="dish_side_06"]').remove();
  
        }
      }

    }

  }

  active_editor() {
    if (typeof this.order == "undefined") return;
    this.order.order_manage.check_item_editor_status(this);
  }

  update(server = true) {
    if (this.edit_item) return;
    if (this.data.qty === 0 && !this.is_enabled_to_delete) {
      frappe.throw(__("You do not have permissions to delete Items"));
    }

    if (this.data.qty === 0) {
      //this.order.delete_item(this.data.identifier);
    } else {
      this.calculate();
      this.reset_html();
    }

    this.order.aggregate(true);
    if (!server) return;

    RM.working("Update Item", false);

    window.saving = true;

    this.data = Object.entries(this.data).reduce((acc, [key, value]) => {
      acc[key] = value === 0 ? 0 : value || "";
      return acc;
    }, {});

    frappeHelper.api.call({
      model: "Table Order",
      name: this.order.data.name,
      method: this.data.qty > 0 ? "push_item" : "delete_item",
      args: { item: this.data.qty > 0 ? this.data : this.data.identifier },
      always: (r) => {
        if (r.exc) {
          console.log('Check items!!!!!!!')
          this.order.check_items({ items: [...Object.values(this.order.items).map(item => item.data), this.data] });
        }
        this.order.aggregate(true);

        window.saving = false;
        RM.ready();
        //FIX 22-05-2025; Click on ORder to update...
        console.log('update Order by clicking...');
        //this.order.order_manage.reload();
        //this.order.order_manage.modal.render();
        //this.order.order_manage.render();
        //this.modal.render();
        //this.calculate();
        //this.check_buttons_status();
        //this.order.order_manage.objects
        this.order.order_manage.check_permissions_status();
        //document.querySelector("#order-container-gelhv7ljkn > button.btn.btn-app.btn-lg.btn-order.selected").click;
        this.order.current_item.order.button.$[0].click();

        //this.order.order_manage.check_permissions_status();

        /*
        frappeHelper.api.call({
          model: "Table Order",
          name: this.order.data.name,
          method: "get_items",
          always: (r) => {
            console.log('RECARRRRRRRR');
            this.order.order_manage.reload();
            //this.order.order_manage.in_modal.reload();
          }
        });
        */

      }
    });
  }

  calculate() {
    const base_amount = flt(this.data.qty) * flt(this.data.rate);
    this.tax_calculate(base_amount);

    this.order.order_manage.objects.Qty.val(this.data.qty);
    this.order.order_manage.objects.Rate.val(this.data.rate);
    this.order.order_manage.objects.Discount.val(this.data.discount_percentage);

    this.order.aggregate(true);
  }

  calculate_form(input, value) {
    /**TODO: merge with general order management function */
    const set_data = (qty, discount, rate) => {
      this.data.qty = qty;
      this.data.discount_percentage = discount;
      this.data.rate = rate;
    }

    if (input && ["qty", "rate", "discount_percentage"].includes(input)) {
      //const input_field = this.form_editor.get_field(input);
      if (!this.is_enabled_to_edit) {
        return;
      }

      const qty_field = this.form_editor.get_field("qty");
      const rate_field = this.form_editor.get_field("rate");
      const discount_field = this.form_editor.get_field("discount_percentage");

      const qty = flt(qty_field.get_value());
      let discount = flt(discount_field.get_value());
      let rate = flt(rate_field.get_value());
      const base_rate = flt(this.data.price_list_rate);

      if (input === "qty") {
        if (value === 0 && this.is_enabled_to_delete) {
          frappe.msgprint(__("You do not have permissions to delete Items"));
          return;
        }
        set_data(qty, discount, rate);
      }

      if (input === "discount_percentage") {
        rate = (base_rate * (1 - discount / 100));
        set_data(qty, discount, rate);
      }

      if (input === "rate") {
        const _discount = (((base_rate - rate) / base_rate) * 100);
        discount = _discount >= 0 ? _discount : 0
        set_data(qty, discount, rate);
      }
    } else {
      this.data[input] = value;
    }
    /**merge with general order management function */
  }

  tax_calculate(base_amount) {
    const tax_inclusive = RM.pos_profile.posa_tax_inclusive;
    //FIX 19-12-2024; CHECK IF two TAXES.... 
    console.log('TAXXES ', this.data.item_tax_rate);
    console.log(Object.values(RMHelper.JSONparse(this.data.item_tax_rate) || {}));

    const tax_amount = Object.values(RMHelper.JSONparse(this.data.item_tax_rate) || {}).reduce((acc, cur) => {
      if (tax_inclusive) {
        const base_without_tax = base_amount / (1 + (cur / 100));
        return acc + (base_without_tax * (cur / 100));
      } else {
        //FIX 19-12-2024; Has two TAXES Accounts; Avoid Duplicated Calcs
        if (this.data.item_tax_rate.split(',').length >= 2 && acc > 0) {
          acc = 0;
        }
        return acc + (base_amount * cur / 100);
      }
    }, 0);

    this.data.tax_amount = tax_amount;
    this.data.amount = base_amount + (tax_inclusive ? 0 : tax_amount);
  }

  discount_calculate(base_amount) {
    const discount_amount = flt(this.data.discount_amount);
    const discount_percentage = flt(this.data.discount_percentage);
    const tax_amount = flt(this.data.tax_amount);

    if (discount_amount > 0) {
      this.data.amount = base_amount + tax_amount - discount_amount;
    } else if (discount_percentage > 0) {
      this.data.discount_amount = base_amount * (discount_percentage / 100);
      this.data.amount = base_amount + tax_amount - this.data.discount_amount;
    } else {
      this.data.amount = base_amount + tax_amount;
    }
  }

  get template() {
    const psd = this.data.process_status_data;

    this.icon = frappe.jshtml({
      tag: "a",
      properties: { class: "pull-left border-aero profile_thumb" },
      content: `<i class="${psd.icon}" style="color: ${psd.color}"></i>`
    });

    this.notes = frappe.jshtml({
      tag: "small",
      properties: { class: "notes" },
      content: (typeof this.data.notes == "object" ? "" : this.data.notes)
    });

    this.detail = frappe.jshtml({
      tag: "p",
      content: this.html_detail
    });

    this.amount = frappe.jshtml({
      tag: 'a',
      properties: { class: 'pull-right' },
      content: RM.format_currency(this.data.amount)
    });

    this.form_editor_container = frappe.jshtml({
      tag: "div",
      properties: { class: "form-editor p-2" }
    });

    const header_template = `
      ${this.icon.html()}
      <div class="media-body">
          <a class="title" href="javascript:void(0)">${this.data.item_name}
              ${this.amount.html()}
          </a>
          ${this.detail.html()}
          <p class="text-muted m-0">  ${this.notes.html()}</p>
      </div>
      `

    this.header = frappe.jshtml({
      tag: "div",
      properties: { class: "widget-user-header" },
      content: header_template
    }).on("click", () => {
      RM.pull_alert("left");
      this.make_form_editor();
      this.select();
    });

    return `
      <div class="card card-widget widget-user-2">
        ${this.header.html()}
        <div class="card-footer p-0">
            ${this.form_editor_container.html()}
        </div>
      </div>
      `
  }

  async make_form_editor() {
    console.log('ASYN make form editor')
    if (this.form_editor) {
      const selected = this.row.has_class("selected");

      await this.form_editor.reload(this.data);

      this.form_editor[!selected || this.form_editor.in_modal ? "show" : "toggle"]();

      //FIX 30-05-2025
      //this.form_editor.field_properties.ponto_carne.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.ponto_carne.hidden = true;
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      } else if (this.form_editor.field_properties.ponto_carne.label === "") {
        this.form_editor.field_properties.ponto_carne.hidden = true;
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      } else if (this.form_editor.fields_dict.ponto_carne._label == "") {
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      }

      //this.form_editor.field_properties.dish_side_01.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >0) {
          this.form_editor.field_properties.dish_side_01.hidden = false;
          this.form_editor.field_properties.dish_side_01.label = this.order.current_item.data.dish_sides[0].item_name;
          this.form_editor.fields_dict.dish_side_01._label = this.order.current_item.data.dish_sides[0].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_01"]')) {
            this.form_editor.field_properties.dish_side_01.hidden = true;
            //document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
  
            //document.querySelector('[data-fieldname="dish_side_01"]').remove()
          };
        }
      } else if (this.form_editor.field_properties.dish_side_01.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >0) {
          this.form_editor.field_properties.dish_side_01.hidden = false;
          this.form_editor.field_properties.dish_side_01.label = this.order.current_item.data.dish_sides[0].item_name;
          this.form_editor.fields_dict.dish_side_01._label = this.order.current_item.data.dish_sides[0].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_01"]')) {
            this.form_editor.field_properties.dish_side_01.hidden = true;
            //document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
  
            //document.querySelector('[data-fieldname="dish_side_01"]').remove()
          };
        }
      } else if (this.form_editor.fields_dict.dish_side_01._label == "") {
        //document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >0) {
          this.form_editor.field_properties.dish_side_01.hidden = false;
          this.form_editor.field_properties.dish_side_01.label = this.order.current_item.data.dish_sides[0].item_name;
          this.form_editor.fields_dict.dish_side_01._label = this.order.current_item.data.dish_sides[0].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_01"]')) {
            console.log('Nadddd 01')
            //document.querySelector('[data-fieldname="dish_side_01"]').remove()
          };
        }
      }
      

      //this.form_editor.field_properties.dish_side_02.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >1) {
          this.form_editor.field_properties.dish_side_02.hidden = false;
          this.form_editor.field_properties.dish_side_02.label = this.order.current_item.data.dish_sides[1].item_name;
          this.form_editor.fields_dict.dish_side_02._label = this.order.current_item.data.dish_sides[1].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_02"]')) {
            this.form_editor.field_properties.dish_side_02.hidden = true;
            document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
          }
        }
      } else if (this.form_editor.field_properties.dish_side_02.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >1) {
          this.form_editor.field_properties.dish_side_02.hidden = false;
          this.form_editor.field_properties.dish_side_02.label = this.order.current_item.data.dish_sides[1].item_name;
          this.form_editor.fields_dict.dish_side_02._label = this.order.current_item.data.dish_sides[1].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_02"]')) {
            this.form_editor.field_properties.dish_side_02.hidden = true;
            document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
          }
        }
      } else if (this.form_editor.fields_dict.dish_side_02._label == "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >1) {
          this.form_editor.field_properties.dish_side_02.hidden = false;
          this.form_editor.field_properties.dish_side_02.label = this.order.current_item.data.dish_sides[1].item_name;
          this.form_editor.fields_dict.dish_side_02._label = this.order.current_item.data.dish_sides[1].item_name
        } else {        

          if (document.querySelector('[data-fieldname="dish_side_02"]')) document.querySelector('[data-fieldname="dish_side_02"]').style.display="none";
        }
      }



      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >2) {
          this.form_editor.field_properties.dish_side_03.hidden = false;
          this.form_editor.field_properties.dish_side_03.label = this.order.current_item.data.dish_sides[2].item_name;
          this.form_editor.fields_dict.dish_side_03._label = this.order.current_item.data.dish_sides[2].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_03"]')) {
            this.form_editor.field_properties.dish_side_03.hidden = true;
            document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
          }
        }
      } else if (this.form_editor.field_properties.dish_side_03.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >2) {
          this.form_editor.field_properties.dish_side_03.hidden = false;
          this.form_editor.field_properties.dish_side_03.label = this.order.current_item.data.dish_sides[2].item_name;
          this.form_editor.fields_dict.dish_side_03._label = this.order.current_item.data.dish_sides[2].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_03"]')) {
            this.form_editor.field_properties.dish_side_03.hidden = true;
            document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
          }
        }
      } else if (this.form_editor.fields_dict.dish_side_03._label == "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >2) {
          this.form_editor.field_properties.dish_side_03.hidden = false;
          this.form_editor.field_properties.dish_side_03.label = this.order.current_item.data.dish_sides[2].item_name;
          this.form_editor.fields_dict.dish_side_03._label = this.order.current_item.data.dish_sides[2].item_name
        } else {        

          if (document.querySelector('[data-fieldname="dish_side_03"]')) document.querySelector('[data-fieldname="dish_side_03"]').style.display="none";
        }
      }

      
      //this.form_editor.field_properties.dish_side_04.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >3) {
          this.form_editor.field_properties.dish_side_04.hidden = false;
          this.form_editor.field_properties.dish_side_04.label = this.order.current_item.data.dish_sides[3].item_name;
          this.form_editor.fields_dict.dish_side_04._label = this.order.current_item.data.dish_sides[3].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_04"]')) {
            this.form_editor.field_properties.dish_side_04.hidden = true;
            document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
          }
        }
      } else if (this.form_editor.field_properties.dish_side_04.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >3) {
          this.form_editor.field_properties.dish_side_04.hidden = false;
          this.form_editor.field_properties.dish_side_04.label = this.order.current_item.data.dish_sides[3].item_name;
          this.form_editor.fields_dict.dish_side_04._label = this.order.current_item.data.dish_sides[3].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_04"]')) {
            this.form_editor.field_properties.dish_side_04.hidden = true;
            document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
          }
        }
      } else if (this.form_editor.fields_dict.dish_side_04._label == "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >3) {
          this.form_editor.field_properties.dish_side_04.hidden = false;
          this.form_editor.field_properties.dish_side_04.label = this.order.current_item.data.dish_sides[3].item_name;
          this.form_editor.fields_dict.dish_side_04._label = this.order.current_item.data.dish_sides[3].item_name
        } else {        

          if (document.querySelector('[data-fieldname="dish_side_04"]')) document.querySelector('[data-fieldname="dish_side_04"]').style.display="none";
        }
      }


      //this.form_editor.field_properties.dish_side_05.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >4) {
          this.form_editor.field_properties.dish_side_05.hidden = false;
          this.form_editor.field_properties.dish_side_05.label = this.order.current_item.data.dish_sides[4].item_name;
          this.form_editor.fields_dict.dish_side_05._label = this.order.current_item.data.dish_sides[4].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_05"]')) {
            this.form_editor.field_properties.dish_side_05.hidden = true;
            document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
          }
        }
      } else if (this.form_editor.field_properties.dish_side_05.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >4) {
          this.form_editor.field_properties.dish_side_05.hidden = false;
          this.form_editor.field_properties.dish_side_05.label = this.order.current_item.data.dish_sides[4].item_name;
          this.form_editor.fields_dict.dish_side_05._label = this.order.current_item.data.dish_sides[4].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_05"]')) {
            this.form_editor.field_properties.dish_side_05.hidden = true;
            document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
          }
        }
      } else if (this.form_editor.fields_dict.dish_side_05._label == "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >4) {
          this.form_editor.field_properties.dish_side_05.hidden = false;
          this.form_editor.field_properties.dish_side_05.label = this.order.current_item.data.dish_sides[4].item_name;
          this.form_editor.fields_dict.dish_side_05._label = this.order.current_item.data.dish_sides[4].item_name
        } else {        

          if (document.querySelector('[data-fieldname="dish_side_05"]')) document.querySelector('[data-fieldname="dish_side_05"]').style.display="none";
        }
      }


      //this.form_editor.field_properties.dish_side_06.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >5) {
          this.form_editor.field_properties.dish_side_06.hidden = false;
          this.form_editor.field_properties.dish_side_06.label = this.order.current_item.data.dish_sides[5].item_name;
          this.form_editor.fields_dict.dish_side_06._label = this.order.current_item.data.dish_sides[5].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_06"]')) {
            this.form_editor.field_properties.dish_side_06.hidden = true;
            document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
          }
        }
      } else if (this.form_editor.field_properties.dish_side_06.label === "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >5) {
          this.form_editor.field_properties.dish_side_06.hidden = false;
          this.form_editor.field_properties.dish_side_06.label = this.order.current_item.data.dish_sides[5].item_name;
          this.form_editor.fields_dict.dish_side_06._label = this.order.current_item.data.dish_sides[5].item_name
        } else {        
          if (document.querySelector('[data-fieldname="dish_side_06"]')) {
            this.form_editor.field_properties.dish_side_06.hidden = true;
            document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
          }
        }
      } else if (this.form_editor.fields_dict.dish_side_06._label == "") {
        //Check if has DISH SIDES
        if (this.order.current_item.data.dish_sides && this.order.current_item.data.dish_sides.length >5) {
          this.form_editor.field_properties.dish_side_06.hidden = false;
          this.form_editor.field_properties.dish_side_06.label = this.order.current_item.data.dish_sides[5].item_name;
          this.form_editor.fields_dict.dish_side_06._label = this.order.current_item.data.dish_sides[5].item_name
        } else {        

          if (document.querySelector('[data-fieldname="dish_side_06"]')) document.querySelector('[data-fieldname="dish_side_06"]').style.display="none";
        }
      }





    } else {
      this.form_editor = new OrderItemEditor({
        order_item: this,
        location: this.form_editor_container.JQ(),
        doc: this.data,
        field_properties: {
          item_code: {
            read_only: true
          },
          has_batch_no: {
            read_only: true,
            hidden: this.data.has_batch_no === 0,
          },
          batch_no: {
            hidden: this.data.has_batch_no === 0,
            "get_query": () => {
              return {
                filters: [
                  ['item', '=', this.data.item_code],
                  ['disabled', '=', 0],
                  ['batch_qty', '>', 0]
                ]
              }
            }
          },
          has_serial_no: {
            read_only: true,
            hidden: this.data.has_serial_no === 0,
          },
          serial_no: {
            hidden: this.data.has_serial_no === 0,
            "get_query": () => {
              return {
                filters: [
                  ['item_code', '=', this.data.item_code],
                  ['status', '=', 'Active']
                ]
              }
            }
          },
          //FIX 29-05-2025; Hide
          item_tax_rate: {
            hidden: 1,
          },
          valuation_rate: {
            hidden: 1,
          },
          price_list_rate: {
            hidden: 1,
          },
          tax_amout: {
            hidden: 1,
          },
          ponto_carne: {
            hidden: this.data.item_group != "Comidas",
            "get_query": () => {
              console.log('acompanhaaaaaaa PONTO CARNE');
              console.log(this.data.item_code);
              return {
                filters: [
                  ['item_code', '=', this.data.item_code]
                ]
              }
            }
          },
          dish_side_01: {
            hidden: this.data.item_group != "Comidas",
            label: !this.data.dish_sides || this.data.dish_sides.length <= 0 
            ? "" 
            : this.data.dish_sides[0].item_name,
            
          },
          dish_side_02: {
            hidden: this.data.item_group != "Comidas",
            label: !this.data.dish_sides || this.data.dish_sides.length <= 1
            ? "" 
            : this.data.dish_sides[1].item_name,
          },
          dish_side_03: {
            hidden: this.data.item_group != "Comidas" || this.data.dish_sides?.length <= 2,
            label: !this.data.dish_sides || this.data.dish_sides.length <= 2 
            ? "" 
            : this.data.dish_sides[2]?.item_name || "",
            read_only: this.data.dish_sides?.length <= 2,
          },
          dish_side_04: {
            hidden: this.data.item_group != "Comidas",
            label: !this.data.dish_sides || this.data.dish_sides.length <= 3 
            ? "" 
            : this.data.dish_sides[3].item_name,
          },
          dish_side_05: {
            hidden: this.data.item_group != "Comidas",
            label: !this.data.dish_sides || this.data.dish_sides.length <= 4 
            ? "" 
            : this.data.dish_sides[4].item_name,
          },
          dish_side_06: {
            hidden: this.data.item_group != "Comidas",
            label: !this.data.dish_sides || this.data.dish_sides.length <= 5 
            ? "" 
            : this.data.dish_sides[5].item_name,
          },



        }
      });

      //FIX 30-05-2025
      //this.form_editor.field_properties.ponto_carne.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.ponto_carne.hidden = true;
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      } else if (this.form_editor.field_properties.ponto_carne.label === "") {
        this.form_editor.field_properties.ponto_carne.hidden = true;
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      } else if (this.form_editor.fields_dict.ponto_carne._label == "") {
        document.querySelector('[data-fieldname="ponto_carne"]').style.display="none"
      }

      //this.form_editor.field_properties.dish_side_01.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_01.hidden = true;
        document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_01.label === "") {
        this.form_editor.field_properties.dish_side_01.hidden = true;
        document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_01._label == "") {
        document.querySelector('[data-fieldname="dish_side_01"]').style.display="none"
      }


      //this.form_editor.field_properties.dish_side_02.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_02.hidden = true;
        document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_02.label === "") {
        this.form_editor.field_properties.dish_side_02.hidden = true;
        document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_02._label == "") {
        document.querySelector('[data-fieldname="dish_side_02"]').style.display="none"
      }



      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_03.hidden = true;
        document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_03.label === "") {
        this.form_editor.field_properties.dish_side_03.hidden = true;
        document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_03._label == "") {
        document.querySelector('[data-fieldname="dish_side_03"]').style.display="none"
      }

      
      //this.form_editor.field_properties.dish_side_04.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_04.hidden = true;
        document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_04.label === "") {
        this.form_editor.field_properties.dish_side_04.hidden = true;
        document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_04._label == "") {
        document.querySelector('[data-fieldname="dish_side_04"]').style.display="none"
      }


      //this.form_editor.field_properties.dish_side_05.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_05.hidden = true;
        document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_05.label === "") {
        this.form_editor.field_properties.dish_side_05.hidden = true;
        document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_05._label == "") {
        document.querySelector('[data-fieldname="dish_side_05"]').style.display="none"
      }


      //this.form_editor.field_properties.dish_side_06.hidden = this.data.item_group != "Comidas"
      if (this.data.item_group != "Comidas") {
        this.form_editor.field_properties.dish_side_06.hidden = true;
        document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
      } else if (this.form_editor.field_properties.dish_side_06.label === "") {
        this.form_editor.field_properties.dish_side_06.hidden = true;
        document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
      } else if (this.form_editor.fields_dict.dish_side_06._label == "") {
        document.querySelector('[data-fieldname="dish_side_06"]').style.display="none"
      }


    }
  }

  check_status() {
    if (this.form_editor) {
      const fields = this.form_editor.get_fields();

      Object.entries(fields).forEach(([field_name, field]) => {
        const enabled = (this.enabled_form_fields_status[this.data.status] || []).includes(field_name);

        this.form_editor.set_field_property(field_name, "read_only", !enabled);
      });

      const pos_profile = RM.pos_profile;

      this.form_editor.set_field_property("qty", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("discount_percentage", "read_only", !this.is_enabled_to_edit || !pos_profile.allow_discount_change);
      this.form_editor.set_field_property("rate", "read_only", !this.is_enabled_to_edit || !pos_profile.allow_rate_change);

      //FIX 30-05-2025
      this.form_editor.set_field_property("ponto_carne", "read_only", !this.is_enabled_to_edit);

      this.form_editor.set_field_property("dish_side_01", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("dish_side_02", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("dish_side_03", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("dish_side_04", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("dish_side_05", "read_only", !this.is_enabled_to_edit);
      this.form_editor.set_field_property("dish_side_06", "read_only", !this.is_enabled_to_edit);

      //FIX 30-05-2025
      if (this.data.item_group == "Comidas") {
        this.form_editor.set_field_property("ponto_carne", "hidden", 0);
        this.form_editor.set_field_property("dish_side_01", "hidden", 0);
        this.form_editor.set_field_property("dish_side_02", "hidden", 0);
        this.form_editor.set_field_property("dish_side_03", "hidden", 0);
        this.form_editor.set_field_property("dish_side_04", "hidden", 0);
        this.form_editor.set_field_property("dish_side_05", "hidden", 0);
        this.form_editor.set_field_property("dish_side_06", "hidden", 0);
  
      } else {
        this.form_editor.set_field_property("ponto_carne", "hidden", 1);        
        this.form_editor.set_field_property("dish_side_01", "hidden", 1);
        this.form_editor.set_field_property("dish_side_02", "hidden", 1);
        this.form_editor.set_field_property("dish_side_03", "hidden", 1);
        this.form_editor.set_field_property("dish_side_04", "hidden", 1);
        this.form_editor.set_field_property("dish_side_05", "hidden", 1);
        this.form_editor.set_field_property("dish_side_06", "hidden", 1);

      }



    }
  }

  get html_detail() {
    const rate = flt(this.data.rate, 2);
    const discount_percentage = flt(this.data.discount_percentage, RM.currency_precision);

    const discount_info = discount_percentage ? `
			<small class="badge" style="background-color: var(--dark); color: var(--green); padding:5px; display: inline;">
				<label>${discount_percentage}%<span class="fa fa-tags" style="padding-left: 5px;"></span></label>
			</small>` : ''

    return `${this.data.qty} x @${RM.format_currency(rate)} ${discount_info}`;
  }
}

class OrderItemEditor extends DeskForm {
  reload_from_doc = true;
  primary_action_label = __("Update");
  title = __("Item Editor");
  desk_form = RM.order_item_editor_form;
  disabled_to_save = true;

  constructor(opts) {
    super(opts);

    this.order_item = opts.order_item;
    super.initialize();
  }

  async make() {
    await super.make();

    const update = (field) => {
      if (this.order_item.data[field.df.fieldname] === field.get_value()) return;

      this.order_item.calculate_form(field.df.fieldname, field.get_value());
      this.order_item.calculate();
      this.order_item.update();
    }

    const update_dishsides = (field) => {
      if (this.order_item.data[field.df.fieldname] === field.get_value()) return;
      this.order_item.calculate_form(field.df.fieldname, field.get_value());
      this.order_item.update();
    }
    this.on(["qty", "rate", "discount_percentage", "batch_no"], "change", (field) => {
      update(field);
    });

    //FIX 29-05-2025
    
    this.on(["ponto_carne","dish_side_01","dish_side_02","dish_side_03","dish_side_04","dish_side_05","dish_side_06"], "change", (field) => {
      update_dishsides(field);
    });
    

    this.get_input("notes").css("height", "100px").on("focusout", (e) => {
      console.log('ORDERITEMEDITOR getINPUT notes');
      update(this.get_field("notes"));
    });
  }

  on_refresh_dependency() {
    this.order_item.check_status();
  }
}