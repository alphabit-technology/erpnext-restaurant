//LAST MODIFIED: 03-06-2025
ProcessManage = class ProcessManage {
  status = "close";
  modal = null;
  items = {};
  new_items_keys = [];
  orders = {};
  
  //FIX 28-12-2024
  timeoutId = null;

  constructor(options) {
    Object.assign(this, options);

    this.command_container_name = this.table.data.name + "-command_container";
    this.initialize();
  }

  reload(clean = false) {
    //FIX 28-12-2024; Trying to AUTO-RELOAD so items are printted
    /*
    setTimeout(() => {
      if(clean) {
        this.get_commands_food(clean);
      } else {
        console.log(' timeout 2 minutes');
        console.log(' timeout 2 minutes!!!!!!');
        this.get_commands_food(false);
      }
    }, 120000);
    */
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
    //FIX 17-10-2024
    //qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
    this.qz_connect();
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
    //FIX 28-12-2024; Trying to AUTO-RELOAD so items are printted
    /*
    setTimeout(() => {
      console.log(' timeout 2 minutes');
      console.log(' timeout 2 minutes!!!!!!');
      this.get_commands_food();
    }, 30000);
    */

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
    console.log('PROCESS MANAGE CLASS - GET COMMANDS FOOD');
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
        //HELKYDS 13-10-2024
        console.log('print DATA....');
        console.log(data);
        this.print_order(data);
      });
      //FIX 17-10-2024
      //console.log('TENTA PRINT on ADD ORDER');
      //this.print_kitchen_qz(order);

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
        //HELKYDS 13-10-2024
        console.log('print DATA.... UPDATE');
        console.log(data);
        console.log('availabel ', available);
        
        available ? update_order(data) : delete_order(data);
      } else if (available) {
        //HELKYDS 16-10-2024
        console.log('ADD ORDER - process manage class');
        console.log('data ',data);
        console.log('------- ORDER');
        console.log(order);
        //FIX 17-10-2024
        console.log('PRINT BEFOREEeeeeeeeeeeeee ADD ORDER');
        this.print_kitchen_qz(order);

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
    //FIX 02-01-2025
    console.log('PROCESS MANAGE - PRINT ORDER');
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
    console.log('PROCESS MANAGE CLASS - make food commands');
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
        //FIX 13-10-2024; Check if was printed....
        console.log('PRINTED ', item.entry_name);
        console.log(item.was_printed);
        //TODO: Print to default PRINTER.... 
        if (!item.was_printed) {
          console.log('PRINT ..... ', item);
          //this.print_kitchen_qz(item);
        }

        this.items[item.identifier].process_manage = this;
      });

    });
    //FIX 15-10-2024
    //this.print_kitchen_qz(this.items);

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

    //setTimeout(() => this.time_elapsed(), 3000);
    //FIX 28-12-2024;
    //FIX 28-12-2024; Trying to AUTO-RELOAD so items are printted
    /*
    setTimeout(() => {
      console.log(' timeout 1 minutes');
      console.log(' timeout 1 minutes!!!!!!');
      this.get_commands_food(true);
      this.time_elapsed();
    }, 60000);
    */
    if (this.timeoutId) {
      // Clear the timeout before it executes
      console.log('Clear the timeout before it executes');
      clearTimeout(this.timeoutId);
      this.timeoutId = setTimeout(() => {
        console.log("This message will not be displayed. 000000");
        //this.time_elapsed();
        this.get_commands_food(true);
      }, 40000);

    } else {
      this.timeoutId = setTimeout(() => {
        console.log("This message will not be displayed.");
        this.time_elapsed();
      }, 40000);

    }
  
    /*
    setInterval(() => {
      console.log('set interval 0000000');
      this.get_commands_food(true);
      this.time_elapsed();
    }, 120000);
    */

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
    console.log('PROCESS MANAGE - CHECK ITEMMMMMMM');
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

  qz_connect() {
    console.log('check if QZ CONNECTINGGGGG...');
          
    qz.security.setCertificatePromise(function(resolve, reject) {
      //FIX 20-03-2025; Updated
      //Alternate method 2 - direct
      resolve("-----BEGIN CERTIFICATE-----\n" +
  "MIIFZzCCBE+gAwIBAgISBKeB9JF8GL67Vh7aDFo87c+kMA0GCSqGSIb3DQEBCwUA\n" +
  "MDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQD\n" +
  "EwNSMTAwHhcNMjUwMjI3MDQxNjA2WhcNMjUwNTI4MDQxNjA1WjAcMRowGAYDVQQD\n" +
  "DBEqLmFuZ29sYWVycC5jby5hbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\n" +
  "ggEBANJoMKTOTaPDhrptrcQOdrZhxb7aAdo8B9AbbReyXEi9vsFpmQJYwcJGx+MP\n" +
  "jQv+1ho+meftk41oeJuLWAKGsyLyAPVA7c4RAdnvk0NSqIsAfjxzC2AavGFWKFn3\n" +
  "eU8HpdjstkU2M8qeALqAbOihDc3WkYvmjcu8nSBmQpzWDP/c/Q3hXYiC5DvVdKYN\n" +
  "yLRlE0vOd5yN+rtzMUVqa5Uzt2Lbkm7CtU/N5TKJElK2mH2xkPJg7r+pCzArWYC3\n" +
  "XozK7jfFhBzrRITM5Qu7p9SuGzVkRmO8JHyFTCl6m54zOlgJCz8xrEKOPAU+dskm\n" +
  "q3ORx4qgTG6tMIMQ3b/l4nT6bk8CAwEAAaOCAoowggKGMA4GA1UdDwEB/wQEAwIF\n" +
  "oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd\n" +
  "BgNVHQ4EFgQUYQY/sGxP2IfRfI5ISqxX8aPGNNEwHwYDVR0jBBgwFoAUu7zDR6Xk\n" +
  "vKnGw6RyDBCNojXhyOgwVwYIKwYBBQUHAQEESzBJMCIGCCsGAQUFBzABhhZodHRw\n" +
  "Oi8vcjEwLm8ubGVuY3Iub3JnMCMGCCsGAQUFBzAChhdodHRwOi8vcjEwLmkubGVu\n" +
  "Y3Iub3JnLzCBjgYDVR0RBIGGMIGDghEqLmFuZ29sYWVycC5jby5hb4IaKi5mYWN0\n" +
  "dXJhcy5hbmdvbGFlcnAuY28uYW+CFiouZmFjdHVyYXMubWV0YWdlc3QuYW+CDSou\n" +
  "bWV0YWdlc3QuYW+CD2FuZ29sYWVycC5jby5hb4INZWxpc3F1YXRyby5hb4ILbWV0\n" +
  "YWdlc3QuYW8wEwYDVR0gBAwwCjAIBgZngQwBAgEwggEGBgorBgEEAdZ5AgQCBIH3\n" +
  "BIH0APIAdwDm0jFjQHeMwRBBBtdxuc7B0kD2loSG+7qHMh39HjeOUAAAAZVF1ACb\n" +
  "AAAEAwBIMEYCIQCDCrAEMpI2uxDMEsniWyH3Lay2jTwkKt6Fpb8BqJolswIhAKtn\n" +
  "yAHffksDOhnp2zDtB+OWLiaovnssGBG54FTSTvF9AHcATnWjJ1yaEMM4W2zU3z9S\n" +
  "6x3w4I4bjWnAsfpksWKaOd8AAAGVRdQAjQAABAMASDBGAiEA+w3QLqhVf8UO0L9n\n" +
  "SvJrOXB6A6UBqFCsj4izRVanoucCIQDMut6xEJeOM2al+0HXJxauggCkAk2XrA7a\n" +
  "coZexx4b9zANBgkqhkiG9w0BAQsFAAOCAQEAyin5uu+L1Qlq/i2C2s+6yerlBH1k\n" +
  "dtJ9PQG67mZivZYb9DFEdzt8p4u7feUGKWqVR6rYku4wcj85Ta46t7Y3nX4ZG7MV\n" +
  "jrgBKVGp6qWxrVFRHPLKnmQIOrG0nuubydoHVT2xRTcWdk8Q0AOS8bq07OUET0NR\n" +
  "t8BXqOwQi/G2ixvFjOHDAemfAVNcmXG4ddf2pzWOPQFq9qpYwxWXbzLnP52X7Ocd\n" +
  "QDAjmGw1OBWT0CLy+odzNmk3cl+7rO8oefqOBvL4seWz/WsUzL3sNR0JHSk+3bXC\n" +
  "11Z2F9YkqgzsWLYLJOZtCHNNrblssC6469D/eVLP9C4dNdLyuVWJHMZXaQ==\n" +
  "-----END CERTIFICATE-----\n" +
  "-----BEGIN CERTIFICATE-----\n" +
  "MIIFBTCCAu2gAwIBAgIQS6hSk/eaL6JzBkuoBI110DANBgkqhkiG9w0BAQsFADBP\n" +
  "MQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFy\n" +
  "Y2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMTAeFw0yNDAzMTMwMDAwMDBa\n" +
  "Fw0yNzAzMTIyMzU5NTlaMDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBF\n" +
  "bmNyeXB0MQwwCgYDVQQDEwNSMTAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK\n" +
  "AoIBAQDPV+XmxFQS7bRH/sknWHZGUCiMHT6I3wWd1bUYKb3dtVq/+vbOo76vACFL\n" +
  "YlpaPAEvxVgD9on/jhFD68G14BQHlo9vH9fnuoE5CXVlt8KvGFs3Jijno/QHK20a\n" +
  "/6tYvJWuQP/py1fEtVt/eA0YYbwX51TGu0mRzW4Y0YCF7qZlNrx06rxQTOr8IfM4\n" +
  "FpOUurDTazgGzRYSespSdcitdrLCnF2YRVxvYXvGLe48E1KGAdlX5jgc3421H5KR\n" +
  "mudKHMxFqHJV8LDmowfs/acbZp4/SItxhHFYyTr6717yW0QrPHTnj7JHwQdqzZq3\n" +
  "DZb3EoEmUVQK7GH29/Xi8orIlQ2NAgMBAAGjgfgwgfUwDgYDVR0PAQH/BAQDAgGG\n" +
  "MB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATASBgNVHRMBAf8ECDAGAQH/\n" +
  "AgEAMB0GA1UdDgQWBBS7vMNHpeS8qcbDpHIMEI2iNeHI6DAfBgNVHSMEGDAWgBR5\n" +
  "tFnme7bl5AFzgAiIyBpY9umbbjAyBggrBgEFBQcBAQQmMCQwIgYIKwYBBQUHMAKG\n" +
  "Fmh0dHA6Ly94MS5pLmxlbmNyLm9yZy8wEwYDVR0gBAwwCjAIBgZngQwBAgEwJwYD\n" +
  "VR0fBCAwHjAcoBqgGIYWaHR0cDovL3gxLmMubGVuY3Iub3JnLzANBgkqhkiG9w0B\n" +
  "AQsFAAOCAgEAkrHnQTfreZ2B5s3iJeE6IOmQRJWjgVzPw139vaBw1bGWKCIL0vIo\n" +
  "zwzn1OZDjCQiHcFCktEJr59L9MhwTyAWsVrdAfYf+B9haxQnsHKNY67u4s5Lzzfd\n" +
  "u6PUzeetUK29v+PsPmI2cJkxp+iN3epi4hKu9ZzUPSwMqtCceb7qPVxEbpYxY1p9\n" +
  "1n5PJKBLBX9eb9LU6l8zSxPWV7bK3lG4XaMJgnT9x3ies7msFtpKK5bDtotij/l0\n" +
  "GaKeA97pb5uwD9KgWvaFXMIEt8jVTjLEvwRdvCn294GPDF08U8lAkIv7tghluaQh\n" +
  "1QnlE4SEN4LOECj8dsIGJXpGUk3aU3KkJz9icKy+aUgA+2cP21uh6NcDIS3XyfaZ\n" +
  "QjmDQ993ChII8SXWupQZVBiIpcWO4RqZk3lr7Bz5MUCwzDIA359e57SSq5CCkY0N\n" +
  "4B6Vulk7LktfwrdGNVI5BsC9qqxSwSKgRJeZ9wygIaehbHFHFhcBaMDKpiZlBHyz\n" +
  "rsnnlFXCb5s8HKn5LsUgGvB24L7sGNZP2CX7dhHov+YhD+jozLW2p9W4959Bz2Ei\n" +
  "RmqDtmiXLnzqTpXbI+suyCsohKRg6Un0RC47+cpiVwHiXZAW+cn8eiNIjqbVgXLx\n" +
  "KPpdzvvtTnOPlC7SQZSYmdunr3Bf9b77AiC/ZidstK36dRILKz7OA54=\n" +
  "-----END CERTIFICATE-----\n"); 
    })
    var privateKey = "-----BEGIN PRIVATE KEY-----\n" +
  "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDSaDCkzk2jw4a6\n" +
  "ba3EDna2YcW+2gHaPAfQG20XslxIvb7BaZkCWMHCRsfjD40L/tYaPpnn7ZONaHib\n" +
  "i1gChrMi8gD1QO3OEQHZ75NDUqiLAH48cwtgGrxhVihZ93lPB6XY7LZFNjPKngC6\n" +
  "gGzooQ3N1pGL5o3LvJ0gZkKc1gz/3P0N4V2IguQ71XSmDci0ZRNLznecjfq7czFF\n" +
  "amuVM7di25JuwrVPzeUyiRJStph9sZDyYO6/qQswK1mAt16Myu43xYQc60SEzOUL\n" +
  "u6fUrhs1ZEZjvCR8hUwpepueMzpYCQs/MaxCjjwFPnbJJqtzkceKoExurTCDEN2/\n" +
  "5eJ0+m5PAgMBAAECggEAB1x0zeHtLnG3Q3Ygh6+X206gC/V1mMx+hiXc0wuUQJ6U\n" +
  "JLvMihv6f2ZZij9E3dVnE9j6f8uR3Mx5t7tlc1qCEZK/kipY3NuUdyrzZH4TqR/1\n" +
  "yqiduRmGW1jCevn2U7D+o5BjL22zhymwTdYTZATKcQKflJzsJg4YaIXwsQBTc8TC\n" +
  "ZBBXqyHbf/L27wVQWmSsq+eVm/U5BCCrPdam1M/OmtjJRZ59VokHIc/g/DJFs8Go\n" +
  "RBntQ7sRI8iVei075CVmBZIt0M0OBrU1GIbnbKC5XrKb+cUWzok6xJ2uOK+sCjTc\n" +
  "GWuECU1O7gSbI/WEt9ybg+TfQ6SJHbLqLHXFNdXD1QKBgQD1PHV9uw/9Mp8Be4+P\n" +
  "Gh45qe/BdsYEdaL4CH1iZsuFMt7YoCD0xj0vuo4JwOrpnbMbO44llFhjKR6CEiU0\n" +
  "lujIhH5UMYKCIbbC9uzPn7aKj7Qqs+4c+INw+avyxAt+hH+oOg6XLGjRKauOzBZA\n" +
  "EGXoS0B6Yi0hXSdAT9QomT9FGwKBgQDbpGGAeRL1uKQWPFkwbI1VKqvVcVUmMDAg\n" +
  "/XHm1WxfqybcfFomjCq25puvveNdXZmPlq7nk6xDS/OsC2ZxyO37dkGeAsvVMJMv\n" +
  "3N7Hb9jXoSsXpL52w12n/io7indMQxamCTfWATXJKtyPdasE+nrJZpht255v2ZhF\n" +
  "nl+7ud2y3QKBgEO084NJGDsBtODF6nbJ8TpebrFtR3KHv/zW6zc1xk76IoiQfUjX\n" +
  "SqFY0kpjFvh077Q/FxnNATIvchrbQ6ZnW9Gwsugv2yZuhHUDk5InOFC9KDL6Bm29\n" +
  "Nx0D8bNO6RV/I3egv9KBElddN95u/l2lqV0fGagwXuFtRJ7+60ZiOROtAoGAWMku\n" +
  "ELzgiSvGSKbEduqqhw7kvzc88F7yVaOd8226jUGmR+KMnqByc9TsgjIEQq2fcYe7\n" +
  "1CjBrcJ6EcXZ94z9hnTbOYBv3RHxrZtfAseXpDKmNLyHsYJvzYTUlZT3fIByG1QG\n" +
  "mh+LGnKVDfjG1RBbqiYq392zQgt3nkzS7hPIJpECgYBSTHt7sTdxWKBQiUzHdxpT\n" +
  "RMjje70TMn/AlVXabsvVmVNphVBD8IA1wpi9MivTd7ypcuV3nCOf6GLavlkjlCVc\n" +
  "vc0evRxMwIuZXEaf86aT1JkaDKrgvXk9eUJxHZ4+zVgP932K8jELsZkG4wdv6fqB\n" +
  "wKDMJOQHouVXPMyEGNnuoQ==\n" +
  "-----END PRIVATE KEY-----\n";
    if (qz.security.getSignatureAlgorithm() == "SHA512") {
      console.log('JA TEM SHA512');
    } else {
      console.log('Adddddddddddddddd SHA512');
      qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
    }

    qz.security.setSignaturePromise(function(toSign) {
        return function(resolve, reject) {
            try {
                var pk = KEYUTIL.getKey(privateKey);
                var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
                sig.init(pk);
                sig.updateString(toSign);
                var hex = sig.sign();
                //console.log("DEBUG: \n\n" + stob64(hextorstr(hex)));
                resolve(stob64(hextorstr(hex)));
            } catch (err) {
                console.error(err);
                reject(err);
            }
        };
    });

    // here you can use anything you defined in the loaded script
    //const qz = require("qz-tray");
    var options = [];
    //FIX 24-10-2024; Due to Cert on Qz-Tray we will try local first not SECURED
    //options['host']=['localhost','POS-BAR01','POS-BAR02','helkyd-HP-Pavilion-x360-Convertible-14-dy1xxx'];
    options['host']='localhost';
    options['usingSecure']= false;
    
    var kitprinter_name = "PRT-KIT01"; 
    var bar1printer_name = "PRT-BAR01"; //Ground Floor
    var bar2printer_name = "PRT-BAR02"; //1st Floor


    qz.websocket.connect(options).then(function() { 
      console.log('QZ connected.....');
    })
          
  }

  print_kitchen_qz(data) {
    console.log('check if QZ LOADED...');
          
    qz.security.setCertificatePromise(function(resolve, reject) {
      //FIX 20-03-2025; Updated
      //Alternate method 2 - direct
      resolve("-----BEGIN CERTIFICATE-----\n" +
  "MIIFZzCCBE+gAwIBAgISBKeB9JF8GL67Vh7aDFo87c+kMA0GCSqGSIb3DQEBCwUA\n" +
  "MDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQD\n" +
  "EwNSMTAwHhcNMjUwMjI3MDQxNjA2WhcNMjUwNTI4MDQxNjA1WjAcMRowGAYDVQQD\n" +
  "DBEqLmFuZ29sYWVycC5jby5hbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\n" +
  "ggEBANJoMKTOTaPDhrptrcQOdrZhxb7aAdo8B9AbbReyXEi9vsFpmQJYwcJGx+MP\n" +
  "jQv+1ho+meftk41oeJuLWAKGsyLyAPVA7c4RAdnvk0NSqIsAfjxzC2AavGFWKFn3\n" +
  "eU8HpdjstkU2M8qeALqAbOihDc3WkYvmjcu8nSBmQpzWDP/c/Q3hXYiC5DvVdKYN\n" +
  "yLRlE0vOd5yN+rtzMUVqa5Uzt2Lbkm7CtU/N5TKJElK2mH2xkPJg7r+pCzArWYC3\n" +
  "XozK7jfFhBzrRITM5Qu7p9SuGzVkRmO8JHyFTCl6m54zOlgJCz8xrEKOPAU+dskm\n" +
  "q3ORx4qgTG6tMIMQ3b/l4nT6bk8CAwEAAaOCAoowggKGMA4GA1UdDwEB/wQEAwIF\n" +
  "oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd\n" +
  "BgNVHQ4EFgQUYQY/sGxP2IfRfI5ISqxX8aPGNNEwHwYDVR0jBBgwFoAUu7zDR6Xk\n" +
  "vKnGw6RyDBCNojXhyOgwVwYIKwYBBQUHAQEESzBJMCIGCCsGAQUFBzABhhZodHRw\n" +
  "Oi8vcjEwLm8ubGVuY3Iub3JnMCMGCCsGAQUFBzAChhdodHRwOi8vcjEwLmkubGVu\n" +
  "Y3Iub3JnLzCBjgYDVR0RBIGGMIGDghEqLmFuZ29sYWVycC5jby5hb4IaKi5mYWN0\n" +
  "dXJhcy5hbmdvbGFlcnAuY28uYW+CFiouZmFjdHVyYXMubWV0YWdlc3QuYW+CDSou\n" +
  "bWV0YWdlc3QuYW+CD2FuZ29sYWVycC5jby5hb4INZWxpc3F1YXRyby5hb4ILbWV0\n" +
  "YWdlc3QuYW8wEwYDVR0gBAwwCjAIBgZngQwBAgEwggEGBgorBgEEAdZ5AgQCBIH3\n" +
  "BIH0APIAdwDm0jFjQHeMwRBBBtdxuc7B0kD2loSG+7qHMh39HjeOUAAAAZVF1ACb\n" +
  "AAAEAwBIMEYCIQCDCrAEMpI2uxDMEsniWyH3Lay2jTwkKt6Fpb8BqJolswIhAKtn\n" +
  "yAHffksDOhnp2zDtB+OWLiaovnssGBG54FTSTvF9AHcATnWjJ1yaEMM4W2zU3z9S\n" +
  "6x3w4I4bjWnAsfpksWKaOd8AAAGVRdQAjQAABAMASDBGAiEA+w3QLqhVf8UO0L9n\n" +
  "SvJrOXB6A6UBqFCsj4izRVanoucCIQDMut6xEJeOM2al+0HXJxauggCkAk2XrA7a\n" +
  "coZexx4b9zANBgkqhkiG9w0BAQsFAAOCAQEAyin5uu+L1Qlq/i2C2s+6yerlBH1k\n" +
  "dtJ9PQG67mZivZYb9DFEdzt8p4u7feUGKWqVR6rYku4wcj85Ta46t7Y3nX4ZG7MV\n" +
  "jrgBKVGp6qWxrVFRHPLKnmQIOrG0nuubydoHVT2xRTcWdk8Q0AOS8bq07OUET0NR\n" +
  "t8BXqOwQi/G2ixvFjOHDAemfAVNcmXG4ddf2pzWOPQFq9qpYwxWXbzLnP52X7Ocd\n" +
  "QDAjmGw1OBWT0CLy+odzNmk3cl+7rO8oefqOBvL4seWz/WsUzL3sNR0JHSk+3bXC\n" +
  "11Z2F9YkqgzsWLYLJOZtCHNNrblssC6469D/eVLP9C4dNdLyuVWJHMZXaQ==\n" +
  "-----END CERTIFICATE-----\n" +
  "-----BEGIN CERTIFICATE-----\n" +
  "MIIFBTCCAu2gAwIBAgIQS6hSk/eaL6JzBkuoBI110DANBgkqhkiG9w0BAQsFADBP\n" +
  "MQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJuZXQgU2VjdXJpdHkgUmVzZWFy\n" +
  "Y2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBYMTAeFw0yNDAzMTMwMDAwMDBa\n" +
  "Fw0yNzAzMTIyMzU5NTlaMDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBF\n" +
  "bmNyeXB0MQwwCgYDVQQDEwNSMTAwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEK\n" +
  "AoIBAQDPV+XmxFQS7bRH/sknWHZGUCiMHT6I3wWd1bUYKb3dtVq/+vbOo76vACFL\n" +
  "YlpaPAEvxVgD9on/jhFD68G14BQHlo9vH9fnuoE5CXVlt8KvGFs3Jijno/QHK20a\n" +
  "/6tYvJWuQP/py1fEtVt/eA0YYbwX51TGu0mRzW4Y0YCF7qZlNrx06rxQTOr8IfM4\n" +
  "FpOUurDTazgGzRYSespSdcitdrLCnF2YRVxvYXvGLe48E1KGAdlX5jgc3421H5KR\n" +
  "mudKHMxFqHJV8LDmowfs/acbZp4/SItxhHFYyTr6717yW0QrPHTnj7JHwQdqzZq3\n" +
  "DZb3EoEmUVQK7GH29/Xi8orIlQ2NAgMBAAGjgfgwgfUwDgYDVR0PAQH/BAQDAgGG\n" +
  "MB0GA1UdJQQWMBQGCCsGAQUFBwMCBggrBgEFBQcDATASBgNVHRMBAf8ECDAGAQH/\n" +
  "AgEAMB0GA1UdDgQWBBS7vMNHpeS8qcbDpHIMEI2iNeHI6DAfBgNVHSMEGDAWgBR5\n" +
  "tFnme7bl5AFzgAiIyBpY9umbbjAyBggrBgEFBQcBAQQmMCQwIgYIKwYBBQUHMAKG\n" +
  "Fmh0dHA6Ly94MS5pLmxlbmNyLm9yZy8wEwYDVR0gBAwwCjAIBgZngQwBAgEwJwYD\n" +
  "VR0fBCAwHjAcoBqgGIYWaHR0cDovL3gxLmMubGVuY3Iub3JnLzANBgkqhkiG9w0B\n" +
  "AQsFAAOCAgEAkrHnQTfreZ2B5s3iJeE6IOmQRJWjgVzPw139vaBw1bGWKCIL0vIo\n" +
  "zwzn1OZDjCQiHcFCktEJr59L9MhwTyAWsVrdAfYf+B9haxQnsHKNY67u4s5Lzzfd\n" +
  "u6PUzeetUK29v+PsPmI2cJkxp+iN3epi4hKu9ZzUPSwMqtCceb7qPVxEbpYxY1p9\n" +
  "1n5PJKBLBX9eb9LU6l8zSxPWV7bK3lG4XaMJgnT9x3ies7msFtpKK5bDtotij/l0\n" +
  "GaKeA97pb5uwD9KgWvaFXMIEt8jVTjLEvwRdvCn294GPDF08U8lAkIv7tghluaQh\n" +
  "1QnlE4SEN4LOECj8dsIGJXpGUk3aU3KkJz9icKy+aUgA+2cP21uh6NcDIS3XyfaZ\n" +
  "QjmDQ993ChII8SXWupQZVBiIpcWO4RqZk3lr7Bz5MUCwzDIA359e57SSq5CCkY0N\n" +
  "4B6Vulk7LktfwrdGNVI5BsC9qqxSwSKgRJeZ9wygIaehbHFHFhcBaMDKpiZlBHyz\n" +
  "rsnnlFXCb5s8HKn5LsUgGvB24L7sGNZP2CX7dhHov+YhD+jozLW2p9W4959Bz2Ei\n" +
  "RmqDtmiXLnzqTpXbI+suyCsohKRg6Un0RC47+cpiVwHiXZAW+cn8eiNIjqbVgXLx\n" +
  "KPpdzvvtTnOPlC7SQZSYmdunr3Bf9b77AiC/ZidstK36dRILKz7OA54=\n" +
  "-----END CERTIFICATE-----\n"); 
            })
            var privateKey = "-----BEGIN PRIVATE KEY-----\n" +
  "MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDSaDCkzk2jw4a6\n" +
  "ba3EDna2YcW+2gHaPAfQG20XslxIvb7BaZkCWMHCRsfjD40L/tYaPpnn7ZONaHib\n" +
  "i1gChrMi8gD1QO3OEQHZ75NDUqiLAH48cwtgGrxhVihZ93lPB6XY7LZFNjPKngC6\n" +
  "gGzooQ3N1pGL5o3LvJ0gZkKc1gz/3P0N4V2IguQ71XSmDci0ZRNLznecjfq7czFF\n" +
  "amuVM7di25JuwrVPzeUyiRJStph9sZDyYO6/qQswK1mAt16Myu43xYQc60SEzOUL\n" +
  "u6fUrhs1ZEZjvCR8hUwpepueMzpYCQs/MaxCjjwFPnbJJqtzkceKoExurTCDEN2/\n" +
  "5eJ0+m5PAgMBAAECggEAB1x0zeHtLnG3Q3Ygh6+X206gC/V1mMx+hiXc0wuUQJ6U\n" +
  "JLvMihv6f2ZZij9E3dVnE9j6f8uR3Mx5t7tlc1qCEZK/kipY3NuUdyrzZH4TqR/1\n" +
  "yqiduRmGW1jCevn2U7D+o5BjL22zhymwTdYTZATKcQKflJzsJg4YaIXwsQBTc8TC\n" +
  "ZBBXqyHbf/L27wVQWmSsq+eVm/U5BCCrPdam1M/OmtjJRZ59VokHIc/g/DJFs8Go\n" +
  "RBntQ7sRI8iVei075CVmBZIt0M0OBrU1GIbnbKC5XrKb+cUWzok6xJ2uOK+sCjTc\n" +
  "GWuECU1O7gSbI/WEt9ybg+TfQ6SJHbLqLHXFNdXD1QKBgQD1PHV9uw/9Mp8Be4+P\n" +
  "Gh45qe/BdsYEdaL4CH1iZsuFMt7YoCD0xj0vuo4JwOrpnbMbO44llFhjKR6CEiU0\n" +
  "lujIhH5UMYKCIbbC9uzPn7aKj7Qqs+4c+INw+avyxAt+hH+oOg6XLGjRKauOzBZA\n" +
  "EGXoS0B6Yi0hXSdAT9QomT9FGwKBgQDbpGGAeRL1uKQWPFkwbI1VKqvVcVUmMDAg\n" +
  "/XHm1WxfqybcfFomjCq25puvveNdXZmPlq7nk6xDS/OsC2ZxyO37dkGeAsvVMJMv\n" +
  "3N7Hb9jXoSsXpL52w12n/io7indMQxamCTfWATXJKtyPdasE+nrJZpht255v2ZhF\n" +
  "nl+7ud2y3QKBgEO084NJGDsBtODF6nbJ8TpebrFtR3KHv/zW6zc1xk76IoiQfUjX\n" +
  "SqFY0kpjFvh077Q/FxnNATIvchrbQ6ZnW9Gwsugv2yZuhHUDk5InOFC9KDL6Bm29\n" +
  "Nx0D8bNO6RV/I3egv9KBElddN95u/l2lqV0fGagwXuFtRJ7+60ZiOROtAoGAWMku\n" +
  "ELzgiSvGSKbEduqqhw7kvzc88F7yVaOd8226jUGmR+KMnqByc9TsgjIEQq2fcYe7\n" +
  "1CjBrcJ6EcXZ94z9hnTbOYBv3RHxrZtfAseXpDKmNLyHsYJvzYTUlZT3fIByG1QG\n" +
  "mh+LGnKVDfjG1RBbqiYq392zQgt3nkzS7hPIJpECgYBSTHt7sTdxWKBQiUzHdxpT\n" +
  "RMjje70TMn/AlVXabsvVmVNphVBD8IA1wpi9MivTd7ypcuV3nCOf6GLavlkjlCVc\n" +
  "vc0evRxMwIuZXEaf86aT1JkaDKrgvXk9eUJxHZ4+zVgP932K8jELsZkG4wdv6fqB\n" +
  "wKDMJOQHouVXPMyEGNnuoQ==\n" +
  "-----END PRIVATE KEY-----\n";
    if (qz.security.getSignatureAlgorithm() == "SHA512") {
      console.log('JA TEM SHA512');
    } else {
      console.log('Adddddddddddddddd SHA512');
      qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
    }

    qz.security.setSignaturePromise(function(toSign) {
        return function(resolve, reject) {
            try {
                var pk = KEYUTIL.getKey(privateKey);
                var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
                sig.init(pk);
                sig.updateString(toSign);
                var hex = sig.sign();
                //console.log("DEBUG: \n\n" + stob64(hextorstr(hex)));
                resolve(stob64(hextorstr(hex)));
            } catch (err) {
                console.error(err);
                reject(err);
            }
        };
    });

    // here you can use anything you defined in the loaded script
    //const qz = require("qz-tray");
    var options = [];
    options['host']=['localhost','POS-BAR01','POS-BAR02'];
    options['usingSecure']= true;
    
    var kitprinter_name = "PRT-KIT01"; 
    var bar1printer_name = "PRT-BAR01"; //Ground Floor
    var bar2printer_name = "PRT-BAR02"; //1st Floor

    console.log('daaatttttttaaaaa');
    console.log(data);
    var new_data = [];
    Object.keys(data).forEach((i) => { 
      if (i == "items" && data[i].indexOf('data') != -1){ // (data[i].includes('data',0)) {
        console.log('ITEMS E DATA');
        console.log(data[i].data.item_code);
        console.log(data[i].data.was_printed); 
        if (!data[i].data.was_printed) {
          //Check if already... 
          var add_newdata = false;
          if (new_data.length) {
            new_data.forEach((aa) => {
              if (aa.short_name != data[i].data.short_name && aa.item_code != data[i].data.item_code)
                add_newdata = true;
            })
          } else {
            add_newdata = true;
          }

          if (add_newdata) {

            new_data.push({
              'short_name': data[i].data.short_name,
              'table_description': data[i].data.table_description,
              'item_name': data[i].data.item_name,
              'item_code': data[i].data.item_code,
              'qty':data[i].data.qty,
              'ordered_time': data[i].data.ordered_time,
              'item_group': data[i].data.item_group,
              'notes': data[i].data.notes,
              'was_printed': data[i].data.was_printed
            });
          }
        }
  
      } else if (i == "items" ) {
        console.log('ITEMSSSSSSSSSSSSSS');
        console.log(data[i][0].item_code);
        console.log(data[i][0].was_printed); 
        if (!data[i][0].was_printed) {
          //Check if already... 
          var add_newdata = false;
          if (new_data.length) {
            new_data.forEach((aa) => {
              if (aa.short_name != data[i][0].short_name && aa.item_code != data[i][0].item_code)
                add_newdata = true;
            })
          } else {
            add_newdata = true;
          }
          if (add_newdata) {

            new_data.push({
              'short_name': data[i][0].short_name,
              'table_description': data[i][0].table_description,
              'item_name': data[i][0].item_name,
              'item_code': data[i][0].item_code,
              'qty':data[i][0].qty,
              'ordered_time': data[i][0].ordered_time,
              'item_group': data[i][0].item_group,
              'notes': data[i][0].notes,
              'was_printed': data[i][0].was_printed
            });
          }
        }
  
      } else if (Object(data).hasOwnProperty('item_code')) {
        console.log('ITEM CODEEEEEEEEEEEEEEEEEEE');
        console.log(data.item_code);
        console.log(data.was_printed); 
        if (!data.was_printed) {
          //Check if already... 
          var add_newdata = false;
          if (new_data.length) {
            new_data.forEach((aa) => {
              if (aa.short_name != data.short_name && aa.item_code != data.item_code)
                add_newdata = true;
            })
          } else {
            add_newdata = true;
          }

          if (add_newdata) {
            new_data.push({
              'short_name': data.short_name,
              'table_description': data.table_description,
              'item_name': data.item_name,
              'item_code': data.item_code,
              'qty':data.qty,
              'ordered_time': data.ordered_time,
              'item_group': data.item_group,
              'notes': data.notes,
              'was_printed': data.was_printed
            });
              
          }
        }

      }

    })

    console.log('NEWWWWW DATA');
    console.log(new_data);
    var dados_to_print = [];
    var dados_print = "";

    //FIX 31-12-2024; RECHECK if Printed
    /*
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
    */

    //FIX 30-12-2024; TO Avoid printting twice;
    if (new_data.length >0) {
      frappeHelper.api.call({
        model: "Restaurant Object",
        name: this.table.data.name,
        method: "get_item_wasprinted",
        args: {
          'shortcode': new_data[0].short_name,
          'itemcode': new_data[0].item_code
        },
        always: (r) => {
          RM.ready();
  
          setTimeout(() => {
            var new_dados = r.message;
            console.log('NEW DADOS ', new_dados);
            console.log('NEW DADOS PRINT ', new_dados[0].was_printed);
            //FIX 03-06-2025; NO LONGER NEEDED so SET 1000; not to run
            if (new_dados[0].was_printed == 1000) {    
  
              new_data.forEach((data) => {
                console.log('TEM SHORT NAMEEEEEEEEEEE ', data.short_name);
                console.log('TEM MESAAAAAAAAAAAAAAA ', data.table_description);
                console.log('ITEM ', data.item_code);
                console.log('WAS PRINTEDDDDDDDDDDD ', data.was_printed);
  
                //FIX 31-12-2024; Not REAL as no REFRESH WAS DONE... but the CALL API BEFORE will check and get the real PRINTED result
                if (data.was_printed == 0) {
                //if (data.table_description.startsWith("M-") || data.table_description.startsWith("MV-")) {
                  //PRINTS
                  dados_print =  '<strong><p class="text-center" style="margin-bottom: 1rem;text-align:center;font-size:12px;">	PEDIDO MESA<br></p></strong>'
                  //'&nbsp;&nbsp;&nbsp;&nbsp;<div class="text-center"><h2>PEDIDO MESA</h2></div> '
                  dados_print += '<strong><p style="font-size:12px;">Pedido N. ' + data.short_name + ' - ' + data.table_description + ' </p> '
                  //dados_print += '<p style="font-size:10px;">MESA: ' + data.table_description + ' </p> </strong>'
                  dados_print += '<strong><p style="font-size:14px;text-align:center;text-transform: uppercase;">' + data.item_name.trim() + ' </p> </strong>'
                  if (data.notes != "") {
                    dados_print += '<strong><p style="font-size:12px;text-align:center;text-transform: uppercase;">' + data.notes.trim() + ' </p> </strong>'
                  }
                  dados_print += '<strong><p>QTD:  ' + data.qty + ' </p> </strong>'
                  dados_print += '<p> ' + data.item_group + ' </p>'
                  dados_print += '<strong><p class="text-center" style="text-align:center;font-size:10px;" >Pedido as:  ' + data.ordered_time + ' </p> </strong>'
            
                  dados_to_print.push(dados_print);
  
                } else {
                  //NO PRINT
                  console.log('DO NOT PRINT');
                  dados_to_print = [];
                }
                
  
              })
  
              console.log('USAR PARA PRINT ');
              
              console.log(dados_to_print);

              //FIX 27-05-2025; Trying to use printer node 
              
              
              /*
              let dados_print =  '<strong><p class="text-center" style="margin-bottom: 1rem;text-align:center;font-size:12px;">	PEDIDO MESA<br></p></strong>'
              //'&nbsp;&nbsp;&nbsp;&nbsp;<div class="text-center"><h2>PEDIDO MESA</h2></div> '
              dados_print += '<strong><p style="font-size:12px;">Pedido N. ' + data.short_name + ' - ' + data.table_description + ' </p> '
              //dados_print += '<p style="font-size:10px;">MESA: ' + data.table_description + ' </p> </strong>'
              dados_print += '<strong><p style="font-size:16px;text-align:center;text-transform: uppercase;">' + data.item_name.trim() + ' </p> </strong>'
              dados_print += '<strong><p>QTD:  ' + data.qty + ' </p> </strong>'
              dados_print += '<strong><p class="text-center" style="text-align:center;font-size:10px;" >Pedido as:  ' + data.ordered_time + ' </p> </strong>'
              */
  
              if (qz.websocket.isActive()) {	// if already active, resolve immediately
                //resolve();
                console.log('ja ESTA LIGADOOOOOOOOOOOOOOOOOOOOOO');
                  
                dados_to_print.forEach((dd) => {
                  if (dd.indexOf("Comidas") != -1) {
                    qz.printers.find(kitprinter_name).then((r) => {
                      console.log('aaaaa PRINTER ');
                      console.log(r);
                      let config = qz.configs.create(r);
  
                      //SET ITEM PRINTED...
                      new_data.forEach((nn) => {
                        if (dd.indexOf(nn.item_name) != -1) {
                          console.log(nn.name);
                          console.log(nn.item_code);
                          console.log('table data name ', this.table)
                          frappeHelper.api.call({
                            model: "Table Order",
                            name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                            method: "set_printed_status",
                            args: {
                              identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              itemcode: nn.item_code
                            },
                            always: () => {
                              RM.ready(false, "success");
                            },
                          });            
              
                        }
  
                      })
  
  
                      return qz.print(config, [{
                          type: 'pixel',
                          format: 'html',
                          flavor: 'plain',
                          data: dd
                      }]);            
  
                    });
                  } else if (this.table.data.printer_name != "" && this.table.data.printer_name != null) {
                    qz.printers.find(this.table.data.printer_name).then((r) => {
                      console.log('aaaaa PRINTER ', this.table.data.printer_name);
                      console.log(r);
                      let config = qz.configs.create(r);
  
                      //SET ITEM PRINTED...
                      new_data.forEach((nn) => {
                        if (dd.indexOf(nn.item_name) != -1) {
                          console.log(nn.name);
                          console.log(nn.item_code);
                          console.log('table data name ', this.table)
                          frappeHelper.api.call({
                            model: "Table Order",
                            name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                            method: "set_printed_status",
                            args: {
                              identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              itemcode: nn.item_code
                            },
                            always: () => {
                              RM.ready(false, "success");
                            },
                          });            
              
                        }
  
                      })
  
  
                      return qz.print(config, [{
                          type: 'pixel',
                          format: 'html',
                          flavor: 'plain',
                          data: dd
                      }]);            
  
                    });          
                  } else {
                    qz.printers.getDefault().then((r) => {
                      console.log('PRINTERRRRRRRRRRRRRRRRR ');
                      console.log(r);
                      console.log(dd);
                      let config = qz.configs.create(r);
  
                      //SET ITEM PRINTED...
                      new_data.forEach((nn) => {
                        if (dd.indexOf(nn.item_name) != -1) {
                          console.log(nn.name);
                          console.log(nn.item_code);
                          console.log('table data name ', this.table)
                          frappeHelper.api.call({
                            model: "Table Order",
                            name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                            method: "set_printed_status",
                            args: {
                              identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              itemcode: nn.item_code
                            },
                            always: () => {
                              RM.ready(false, "success");
                            },
                          });            
              
                        }
  
                      })
  
                      return qz.print(config, [{
                          type: 'pixel',
                          format: 'html',
                          flavor: 'plain',
                          data: dd
                      }]);            
  
                    });
  
                  }
                })
  
              } else {
                qz.websocket.connect(options).then(function() { 
                  console.log('ligouuuuuuu');
                  
                  dados_to_print.forEach((dd) => {
                    if (dd.indexOf("Comidas") != -1) {
                      qz.printers.find(kitprinter_name).then((r) => {
                        console.log('aaaaa PRINTER ');
                        console.log(r);
                        let config = qz.configs.create(r);
  
                        //SET ITEM PRINTED...
                        new_data.forEach((nn) => {
                          if (dd.indexOf(nn.item_name) != -1) {
                            console.log(nn.name);
                            console.log(nn.item_code);
                            console.log('table data name ', this.table)
                            frappeHelper.api.call({
                              model: "Table Order",
                              name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              method: "set_printed_status",
                              args: {
                                identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                                itemcode: nn.item_code
                              },
                              always: () => {
                                RM.ready(false, "success");
                              },
                            });            
                
                          }
  
                        })
  
                        return qz.print(config, [{
                            type: 'pixel',
                            format: 'html',
                            flavor: 'plain',
                            data: dd
                        }]);            
            
                      });
                    } else if (this.table.data.printer_name != "" && this.table.data.printer_name != null) {
                      qz.printers.find(this.table.data.printer_name).then((r) => {
                        console.log('aaaaa PRINTER ', this.table.data.printer_name);
                        console.log(r);
                        let config = qz.configs.create(r);
            
                        //SET ITEM PRINTED...
                        new_data.forEach((nn) => {
                          if (dd.indexOf(nn.item_name) != -1) {
                            console.log(nn.name);
                            console.log(nn.item_code);
                            console.log('table data name ', this.table)
                            frappeHelper.api.call({
                              model: "Table Order",
                              name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              method: "set_printed_status",
                              args: {
                                identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                                itemcode: nn.item_code
                              },
                              always: () => {
                                RM.ready(false, "success");
                              },
                            });            
                
                          }
            
                        })
            
            
                        return qz.print(config, [{
                            type: 'pixel',
                            format: 'html',
                            flavor: 'plain',
                            data: dd
                        }]);            
            
                      });          
  
                    } else {
                      qz.printers.getDefault().then((r) => {
                        console.log('PRINTERRRRRRRRRRRRRRRRR ');
                        console.log(r);
                        console.log(dd);
                        let config = qz.configs.create(r);
  
                        //SET ITEM PRINTED...
                        new_data.forEach((nn) => {
                          if (dd.indexOf(nn.item_name) != -1) {
                            console.log(nn.name);
                            console.log(nn.item_code);
                            console.log('table data name ', this.table)
                            frappeHelper.api.call({
                              model: "Table Order",
                              name: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                              method: "set_printed_status",
                              args: {
                                identifier: "OR-" + moment(frappe.datetime.nowdate()).year().toString() + "-" + nn.short_name,
                                itemcode: nn.item_code
                              },
                              always: () => {
                                RM.ready(false, "success");
                              },
                            });            
                
                          }
  
                        })
  
                        return qz.print(config, [{
                            type: 'pixel',
                            format: 'html',
                            flavor: 'plain',
                            data: dd
                        }]);            
            
                      });
            
                    }
                  })
  
                })
              
              }
            }
          }, 100);
        }
      })
    }



  }      

  
  print_kitchen_qz_WORKING(data) {
    console.log('check if QZ LOADED...');
          
    qz.security.setCertificatePromise(function(resolve, reject) {
      //Alternate method 2 - direct
      resolve("-----BEGIN CERTIFICATE-----\n" +
          "MIIFZDCCBEygAwIBAgISBOmw39PanxXJu38jolDeV7Z+MA0GCSqGSIb3DQEBCwUA\n" +
          "MDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQD\n" +
          "EwNSMTEwHhcNMjQxMDA5MDU0MDU2WhcNMjUwMTA3MDU0MDU1WjAcMRowGAYDVQQD\n" +
          "DBEqLmFuZ29sYWVycC5jby5hbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\n" +
          "ggEBAIGqj8ZzZ0bYOFd7COzcwIaESVr+EMxboL6NfZA2LHC1K9tVF8HOInM3GR1F\n" +
          "fAzXiw4EY9D7wxCNvtPOSA1ANbjwQ2P7M6hKKD/FxMLbOdS8YRAq8VmjSiMz5/do\n" +
          "xpECgpR9exryPcgEMhi8Uiv6IeBfZs9IQca7D6vvFbHy+hP7fUGAF/dudnuHffK4\n" +
          "tvoATXghx7393/jxRJz5njKphOfOzDW3XiGljJ+pzUnC23tjXGEqtetn/L3wXRXg\n" +
          "kriulGjairnAWkrURf0M+GwsABSqq7Hpmtr+T137o3rCLrXVzKgkzbMbQnt21VK3\n" +
          "NjeSK/pGTcfusehkQ6GuHtD7NrECAwEAAaOCAocwggKDMA4GA1UdDwEB/wQEAwIF\n" +
          "oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd\n" +
          "BgNVHQ4EFgQUw0miG9OZUB+d2LRDb/1lE5Bbsg0wHwYDVR0jBBgwFoAUxc9GpOr0\n" +
          "w8B6bJXELbBeki8m47kwVwYIKwYBBQUHAQEESzBJMCIGCCsGAQUFBzABhhZodHRw\n" +
          "Oi8vcjExLm8ubGVuY3Iub3JnMCMGCCsGAQUFBzAChhdodHRwOi8vcjExLmkubGVu\n" +
          "Y3Iub3JnLzCBjgYDVR0RBIGGMIGDghEqLmFuZ29sYWVycC5jby5hb4IaKi5mYWN0\n" +
          "dXJhcy5hbmdvbGFlcnAuY28uYW+CFiouZmFjdHVyYXMubWV0YWdlc3QuYW+CDSou\n" +
          "bWV0YWdlc3QuYW+CD2FuZ29sYWVycC5jby5hb4INZWxpc3F1YXRyby5hb4ILbWV0\n" +
          "YWdlc3QuYW8wEwYDVR0gBAwwCjAIBgZngQwBAgEwggEDBgorBgEEAdZ5AgQCBIH0\n" +
          "BIHxAO8AdQDPEVbu1S58r/OHW9lpLpvpGnFnSrAX7KwB0lt3zsw7CAAAAZJwAP+7\n" +
          "AAAEAwBGMEQCIFcmwaskxK8aXtEoibs49bUIzLqBRkV2WX63R33u1FdOAiBatDOW\n" +
          "WOhsytyrDC/sUQT/VsyvitLRot9OnUQQk8eWAQB2AOCSs/wMHcjnaDYf3mG5lk0K\n" +
          "UngZinLWcsSwTaVtb1QEAAABknAA/58AAAQDAEcwRQIgKic7CsRcvjxzf0q79/lf\n" +
          "V8xe64INfjDf6M6VYoHQbBACIQDo2uSUNOVYpMgFNH/skwR1HOEMjpLO/n16y3Bq\n" +
          "FLyQrjANBgkqhkiG9w0BAQsFAAOCAQEAmrLMfHyl4Zq9t/7JTA0rvv07eN8fK4d/\n" +
          "uKQV7FVcQEKTSwwO49MbUtkSiSONhhWQfHND5h1TEUyavnvzz0XwibYuJTMlt9m6\n" +
          "ean4pm8/FCYJcsHPuSkyZ1nTkpvl+VsGYVFDPjKjjOQ5LeShFq+JJKH90p1Y2rdg\n" +
          "FAENFgJaS55KtReGpd7I3LhWbGUd0+7zeKID0gDwXob4sy790TBLKuUR7uB2LZwI\n" +
          "YUSG+rdyiKM7jSfvOMw3rYj0oZ4QAS7k34CQ2J8mbp/Uet+MPpDC4xj/h2rFpdGe\n" +
          "ZAi9thWEBymd0AlX58Y5vA4izk+7pm009JmteXQpU4qFN4SgjXMW4A==\n" +
          "-----END CERTIFICATE-----\n" +
          "-----BEGIN CERTIFICATE-----\n" +
          "MIIFBjCCAu6gAwIBAgIRAIp9PhPWLzDvI4a9KQdrNPgwDQYJKoZIhvcNAQELBQAw\n" +
          "TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" +
          "cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw\n" +
          "WhcNMjcwMzEyMjM1OTU5WjAzMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg\n" +
          "RW5jcnlwdDEMMAoGA1UEAxMDUjExMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\n" +
          "CgKCAQEAuoe8XBsAOcvKCs3UZxD5ATylTqVhyybKUvsVAbe5KPUoHu0nsyQYOWcJ\n" +
          "DAjs4DqwO3cOvfPlOVRBDE6uQdaZdN5R2+97/1i9qLcT9t4x1fJyyXJqC4N0lZxG\n" +
          "AGQUmfOx2SLZzaiSqhwmej/+71gFewiVgdtxD4774zEJuwm+UE1fj5F2PVqdnoPy\n" +
          "6cRms+EGZkNIGIBloDcYmpuEMpexsr3E+BUAnSeI++JjF5ZsmydnS8TbKF5pwnnw\n" +
          "SVzgJFDhxLyhBax7QG0AtMJBP6dYuC/FXJuluwme8f7rsIU5/agK70XEeOtlKsLP\n" +
          "Xzze41xNG/cLJyuqC0J3U095ah2H2QIDAQABo4H4MIH1MA4GA1UdDwEB/wQEAwIB\n" +
          "hjAdBgNVHSUEFjAUBggrBgEFBQcDAgYIKwYBBQUHAwEwEgYDVR0TAQH/BAgwBgEB\n" +
          "/wIBADAdBgNVHQ4EFgQUxc9GpOr0w8B6bJXELbBeki8m47kwHwYDVR0jBBgwFoAU\n" +
          "ebRZ5nu25eQBc4AIiMgaWPbpm24wMgYIKwYBBQUHAQEEJjAkMCIGCCsGAQUFBzAC\n" +
          "hhZodHRwOi8veDEuaS5sZW5jci5vcmcvMBMGA1UdIAQMMAowCAYGZ4EMAQIBMCcG\n" +
          "A1UdHwQgMB4wHKAaoBiGFmh0dHA6Ly94MS5jLmxlbmNyLm9yZy8wDQYJKoZIhvcN\n" +
          "AQELBQADggIBAE7iiV0KAxyQOND1H/lxXPjDj7I3iHpvsCUf7b632IYGjukJhM1y\n" +
          "v4Hz/MrPU0jtvfZpQtSlET41yBOykh0FX+ou1Nj4ScOt9ZmWnO8m2OG0JAtIIE38\n" +
          "01S0qcYhyOE2G/93ZCkXufBL713qzXnQv5C/viOykNpKqUgxdKlEC+Hi9i2DcaR1\n" +
          "e9KUwQUZRhy5j/PEdEglKg3l9dtD4tuTm7kZtB8v32oOjzHTYw+7KdzdZiw/sBtn\n" +
          "UfhBPORNuay4pJxmY/WrhSMdzFO2q3Gu3MUBcdo27goYKjL9CTF8j/Zz55yctUoV\n" +
          "aneCWs/ajUX+HypkBTA+c8LGDLnWO2NKq0YD/pnARkAnYGPfUDoHR9gVSp/qRx+Z\n" +
          "WghiDLZsMwhN1zjtSC0uBWiugF3vTNzYIEFfaPG7Ws3jDrAMMYebQ95JQ+HIBD/R\n" +
          "PBuHRTBpqKlyDnkSHDHYPiNX3adPoPAcgdF3H2/W0rmoswMWgTlLn1Wu0mrks7/q\n" +
          "pdWfS6PJ1jty80r2VKsM/Dj3YIDfbjXKdaFU5C+8bhfJGqU3taKauuz0wHVGT3eo\n" +
          "6FlWkWYtbt4pgdamlwVeZEW+LM7qZEJEsMNPrfC03APKmZsJgpWCDWOKZvkZcvjV\n" +
          "uYkQ4omYCTX5ohy+knMjdOmdH9c7SpqEWBDC86fiNex+O0XOMEZSa8DA\n" +
          "-----END CERTIFICATE-----"); 
    })
    var privateKey = "-----BEGIN PRIVATE KEY-----\n" +
    "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCBqo/Gc2dG2DhX\n" +
    "ewjs3MCGhEla/hDMW6C+jX2QNixwtSvbVRfBziJzNxkdRXwM14sOBGPQ+8MQjb7T\n" +
    "zkgNQDW48ENj+zOoSig/xcTC2znUvGEQKvFZo0ojM+f3aMaRAoKUfXsa8j3IBDIY\n" +
    "vFIr+iHgX2bPSEHGuw+r7xWx8voT+31BgBf3bnZ7h33yuLb6AE14Ice9/d/48USc\n" +
    "+Z4yqYTnzsw1t14hpYyfqc1Jwtt7Y1xhKrXrZ/y98F0V4JK4rpRo2oq5wFpK1EX9\n" +
    "DPhsLAAUqqux6Zra/k9d+6N6wi611cyoJM2zG0J7dtVStzY3kiv6Rk3H7rHoZEOh\n" +
    "rh7Q+zaxAgMBAAECggEAFusOKX3ZSbjK0I+DBtaHwt7b1lTkpDInybZZdKVWmn8z\n" +
    "Jru2DL/B8ApTioxu/hgU0F/vQo9VLXZYPbiOnKT2Od9hkeji+wJMdeUfP2+fG55G\n" +
    "K6TjbrwBTRKOE/k1a4j9ioBZQ2yAhftT3XJftb0qwq0qD0YOtjD29qU1+PNgxyoi\n" +
    "VB+Xci5pA1IH5lOkIo5fLROVDCmJmsP1qBYHFLEGsnQYjJ2yz1dYCFII73sOY4P3\n" +
    "fcV9VnX6xgXS0K8a59SXrtDKM0jtshaMJLBoUaKOxAM/z/9PK8jkuxTS/kU4jNHR\n" +
    "ww2nAHYCq5HbUH6wxvmwJp5+/jUHEK9ocIgS2/lFyQKBgQC2Tj5aW8tNRwoZU78s\n" +
    "CWADTx0LWIJWzfAfTtB//1oesX02l8z6nTRomJAcgQbODucPcLTvMlnJKlD5FzsW\n" +
    "Vk3ouLTJmZy5jPIG1Jtus9L2N2HudLy+vqctBUVbn5KxaW7Bg/x77bSFVB+FxOWU\n" +
    "f8A0cCZ2AAEwMVbuuqvrcAHi9QKBgQC2FPkEi1HCyWPq3375iXvAqenTcRVZRQxi\n" +
    "sCv8wfdD7IIHSRxhqPh0Bw3+aVPL8yKsFloEB82hRZ360Zi1uabzG4ivve7lkrSM\n" +
    "jGFh5O1SyHntcg8NvwJKVne2ekgUgiz5EOB1cErbODEoL3YKqHu3o/ex7fZL8KhJ\n" +
    "LfCF1ZhHTQKBgDx2pueBGmR+8zKDPBx234k5bACfUltH4iQAF9bb8h/L7iN1JV7Z\n" +
    "VNB8CQ/rGz6sYqYUU24h3PWDO2fh9I7sANr2p79VW02PGZZ6XTLSIV3X8HsN7Ku2\n" +
    "v+uGnAJPYm/E8B7uj4bqx7yQsgPD0gD2feDmcVshlUNOme6DqxFjDL0hAoGBAJ/2\n" +
    "BtqmJpsQYBZMaHmC/dRBsalPFGlLjtj4WnyATuE+WvFZmnR1hGgydmnGUJbBL/ms\n" +
    "3UHjNRR0W5ipIBauVewHiWqTWtgWrUU4Yqkk/BWZB/zBElaKMtHp6tvFy6MwxZ+9\n" +
    "4uNpVmoGkLD0GSi94Ypwoz+Oha0rbDx1/nMlNdWVAoGBAJntwgDDMIljIzKC8hXx\n" +
    "8wzkSgcFdOHPaltxy8E/H/tF+HtRqWupYTR0ZFPF0HEqUEu5RsVRWD507Twf7Y11\n" +
    "6cTzgXdrTHIIvgMa+UcKU4QfOWZcLNEa8BYL4TWm0lJFT4u1szdHePruuC13CzpK\n" +
    "optJSuqGciLUsSiPRFVWcUII\n" +
    "-----END PRIVATE KEY-----\n";

    qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
    qz.security.setSignaturePromise(function(toSign) {
        return function(resolve, reject) {
            try {
                var pk = KEYUTIL.getKey(privateKey);
                var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
                sig.init(pk);
                sig.updateString(toSign);
                var hex = sig.sign();
                //console.log("DEBUG: \n\n" + stob64(hextorstr(hex)));
                resolve(stob64(hextorstr(hex)));
            } catch (err) {
                console.error(err);
                reject(err);
            }
        };
    });

    // here you can use anything you defined in the loaded script
    //const qz = require("qz-tray");
    var options = [];
    options['host']=['POS-BAR01','POS-BAR02'];
    options['usingSecure']= true;
    
    var kitprinter_name = "PRT-KIT01"; 

    if (qz.websocket.isActive()) {	// if already active, resolve immediately
      //resolve();
      console.log('ja ESTA LIGADOOOOOOOOOOOOOOOOOOOOOO');
    } else {
      qz.websocket.connect(options).then(() => {
        console.log('ligouuuuuuu');
        if (data.item_group == "Comidas") {
          return qz.printers.find(kitprinter_name);
        } else {
          return qz.printers.getDefault();
        }

      }).then((impressora) => {
          console.log(impressora);
          print ('dadaosssssss');
          print (data);

          //PRinter 0
          //To get from USER Settings WHICH PRINTER BAR and KITCHEN
          //let config = qz.configs.create(printers[0]);
          let config = qz.configs.create(impressora);
          //let dados_print =  '<!DOCTYPE html><style>	.print-format table, .print-format tr, 	.print-format td, .print-format div, .print-format p {		font-family: Tahoma, sans-serif;		line-height: 150%;		vertical-align: middle;	}	@media screen {		.print-format {			width: 4in;			padding: 0.25in;			min-height: 8in;		}	}</style><strong><p class="text-center" style="margin-bottom: 1rem;text-align:center;">	PEDIDO MESA<br></p></strong>'
          let dados_print =  '<strong><p class="text-center" style="margin-bottom: 1rem;text-align:center;">	PEDIDO MESA<br></p></strong>'
          //'&nbsp;&nbsp;&nbsp;&nbsp;<div class="text-center"><h2>PEDIDO MESA</h2></div> '
          dados_print += '&nbsp;&nbsp;<strong><p style="font-size:10px;">Pedido N. ' + data.short_name + ' - ' + data.table_description + ' </p> '
          //dados_print += '<p style="font-size:10px;">MESA: ' + data.table_description + ' </p> </strong>'
          dados_print += '<strong><p style="font-size:14px;text-align:center;">' + data.item_name.trim() + ' </p> '
          dados_print += ' &nbsp;&nbsp;<p>QTD:  ' + data.qty + ' </p> </strong>'
          dados_print += '&nbsp;&nbsp;&nbsp;&nbsp;<p class="text-center" style="text-align:center;font-size:10px;" >Pedido as:  ' + data.ordered_time + ' </p>'

          return qz.print(config, [{
              type: 'pixel',
              format: 'html',
              flavor: 'plain',
              data: dados_print
          }]);
      }).then(() => {
          return qz.websocket.disconnect();
      }).then(() => {
          // process.exit(0);
      }).catch((err) => {
          console.error(err);
          // process.exit(1);
      });           
    }


  }      


  print_kitchen_qz_ORIG(data) {
    $.getScript("https://cdnjs.cloudflare.com/ajax/libs/jsrsasign/11.1.0/jsrsasign-all-min.js", function() {
        console.log('Carregou jsrass.... USER O LOCAL MELHOR');

        $.getScript("https://cdn.jsdelivr.net/npm/qz-tray@2.2.4/qz-tray.min.js", function() {
        //$.getScript("/assets/js/qz-tray.min.js", function() {	
            console.log ("Script loaded and executed.");
            
            //$.getScript("/assets/js/sign-message.js", function() {
            //    console.log('Carregou sign-message');
            //})
            qz.security.setCertificatePromise(function(resolve, reject) {
                //Preferred method - from server
        //        fetch("assets/signing/digital-certificate.txt", {cache: 'no-store', headers: {'Content-Type': 'text/plain'}})
        //          .then(function(data) { data.ok ? resolve(data.text()) : reject(data.text()); });
        
                //Alternate method 1 - anonymous
        //        resolve();  // remove this line in live environment
        
                //Alternate method 2 - direct
                resolve("-----BEGIN CERTIFICATE-----\n" +
                    "MIIFZDCCBEygAwIBAgISBOmw39PanxXJu38jolDeV7Z+MA0GCSqGSIb3DQEBCwUA\n" +
                    "MDMxCzAJBgNVBAYTAlVTMRYwFAYDVQQKEw1MZXQncyBFbmNyeXB0MQwwCgYDVQQD\n" +
                    "EwNSMTEwHhcNMjQxMDA5MDU0MDU2WhcNMjUwMTA3MDU0MDU1WjAcMRowGAYDVQQD\n" +
                    "DBEqLmFuZ29sYWVycC5jby5hbzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoC\n" +
                    "ggEBAIGqj8ZzZ0bYOFd7COzcwIaESVr+EMxboL6NfZA2LHC1K9tVF8HOInM3GR1F\n" +
                    "fAzXiw4EY9D7wxCNvtPOSA1ANbjwQ2P7M6hKKD/FxMLbOdS8YRAq8VmjSiMz5/do\n" +
                    "xpECgpR9exryPcgEMhi8Uiv6IeBfZs9IQca7D6vvFbHy+hP7fUGAF/dudnuHffK4\n" +
                    "tvoATXghx7393/jxRJz5njKphOfOzDW3XiGljJ+pzUnC23tjXGEqtetn/L3wXRXg\n" +
                    "kriulGjairnAWkrURf0M+GwsABSqq7Hpmtr+T137o3rCLrXVzKgkzbMbQnt21VK3\n" +
                    "NjeSK/pGTcfusehkQ6GuHtD7NrECAwEAAaOCAocwggKDMA4GA1UdDwEB/wQEAwIF\n" +
                    "oDAdBgNVHSUEFjAUBggrBgEFBQcDAQYIKwYBBQUHAwIwDAYDVR0TAQH/BAIwADAd\n" +
                    "BgNVHQ4EFgQUw0miG9OZUB+d2LRDb/1lE5Bbsg0wHwYDVR0jBBgwFoAUxc9GpOr0\n" +
                    "w8B6bJXELbBeki8m47kwVwYIKwYBBQUHAQEESzBJMCIGCCsGAQUFBzABhhZodHRw\n" +
                    "Oi8vcjExLm8ubGVuY3Iub3JnMCMGCCsGAQUFBzAChhdodHRwOi8vcjExLmkubGVu\n" +
                    "Y3Iub3JnLzCBjgYDVR0RBIGGMIGDghEqLmFuZ29sYWVycC5jby5hb4IaKi5mYWN0\n" +
                    "dXJhcy5hbmdvbGFlcnAuY28uYW+CFiouZmFjdHVyYXMubWV0YWdlc3QuYW+CDSou\n" +
                    "bWV0YWdlc3QuYW+CD2FuZ29sYWVycC5jby5hb4INZWxpc3F1YXRyby5hb4ILbWV0\n" +
                    "YWdlc3QuYW8wEwYDVR0gBAwwCjAIBgZngQwBAgEwggEDBgorBgEEAdZ5AgQCBIH0\n" +
                    "BIHxAO8AdQDPEVbu1S58r/OHW9lpLpvpGnFnSrAX7KwB0lt3zsw7CAAAAZJwAP+7\n" +
                    "AAAEAwBGMEQCIFcmwaskxK8aXtEoibs49bUIzLqBRkV2WX63R33u1FdOAiBatDOW\n" +
                    "WOhsytyrDC/sUQT/VsyvitLRot9OnUQQk8eWAQB2AOCSs/wMHcjnaDYf3mG5lk0K\n" +
                    "UngZinLWcsSwTaVtb1QEAAABknAA/58AAAQDAEcwRQIgKic7CsRcvjxzf0q79/lf\n" +
                    "V8xe64INfjDf6M6VYoHQbBACIQDo2uSUNOVYpMgFNH/skwR1HOEMjpLO/n16y3Bq\n" +
                    "FLyQrjANBgkqhkiG9w0BAQsFAAOCAQEAmrLMfHyl4Zq9t/7JTA0rvv07eN8fK4d/\n" +
                    "uKQV7FVcQEKTSwwO49MbUtkSiSONhhWQfHND5h1TEUyavnvzz0XwibYuJTMlt9m6\n" +
                    "ean4pm8/FCYJcsHPuSkyZ1nTkpvl+VsGYVFDPjKjjOQ5LeShFq+JJKH90p1Y2rdg\n" +
                    "FAENFgJaS55KtReGpd7I3LhWbGUd0+7zeKID0gDwXob4sy790TBLKuUR7uB2LZwI\n" +
                    "YUSG+rdyiKM7jSfvOMw3rYj0oZ4QAS7k34CQ2J8mbp/Uet+MPpDC4xj/h2rFpdGe\n" +
                    "ZAi9thWEBymd0AlX58Y5vA4izk+7pm009JmteXQpU4qFN4SgjXMW4A==\n" +
                    "-----END CERTIFICATE-----\n" +
                    "-----BEGIN CERTIFICATE-----\n" +
                    "MIIFBjCCAu6gAwIBAgIRAIp9PhPWLzDvI4a9KQdrNPgwDQYJKoZIhvcNAQELBQAw\n" +
                    "TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh\n" +
                    "cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMjQwMzEzMDAwMDAw\n" +
                    "WhcNMjcwMzEyMjM1OTU5WjAzMQswCQYDVQQGEwJVUzEWMBQGA1UEChMNTGV0J3Mg\n" +
                    "RW5jcnlwdDEMMAoGA1UEAxMDUjExMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIB\n" +
                    "CgKCAQEAuoe8XBsAOcvKCs3UZxD5ATylTqVhyybKUvsVAbe5KPUoHu0nsyQYOWcJ\n" +
                    "DAjs4DqwO3cOvfPlOVRBDE6uQdaZdN5R2+97/1i9qLcT9t4x1fJyyXJqC4N0lZxG\n" +
                    "AGQUmfOx2SLZzaiSqhwmej/+71gFewiVgdtxD4774zEJuwm+UE1fj5F2PVqdnoPy\n" +
                    "6cRms+EGZkNIGIBloDcYmpuEMpexsr3E+BUAnSeI++JjF5ZsmydnS8TbKF5pwnnw\n" +
                    "SVzgJFDhxLyhBax7QG0AtMJBP6dYuC/FXJuluwme8f7rsIU5/agK70XEeOtlKsLP\n" +
                    "Xzze41xNG/cLJyuqC0J3U095ah2H2QIDAQABo4H4MIH1MA4GA1UdDwEB/wQEAwIB\n" +
                    "hjAdBgNVHSUEFjAUBggrBgEFBQcDAgYIKwYBBQUHAwEwEgYDVR0TAQH/BAgwBgEB\n" +
                    "/wIBADAdBgNVHQ4EFgQUxc9GpOr0w8B6bJXELbBeki8m47kwHwYDVR0jBBgwFoAU\n" +
                    "ebRZ5nu25eQBc4AIiMgaWPbpm24wMgYIKwYBBQUHAQEEJjAkMCIGCCsGAQUFBzAC\n" +
                    "hhZodHRwOi8veDEuaS5sZW5jci5vcmcvMBMGA1UdIAQMMAowCAYGZ4EMAQIBMCcG\n" +
                    "A1UdHwQgMB4wHKAaoBiGFmh0dHA6Ly94MS5jLmxlbmNyLm9yZy8wDQYJKoZIhvcN\n" +
                    "AQELBQADggIBAE7iiV0KAxyQOND1H/lxXPjDj7I3iHpvsCUf7b632IYGjukJhM1y\n" +
                    "v4Hz/MrPU0jtvfZpQtSlET41yBOykh0FX+ou1Nj4ScOt9ZmWnO8m2OG0JAtIIE38\n" +
                    "01S0qcYhyOE2G/93ZCkXufBL713qzXnQv5C/viOykNpKqUgxdKlEC+Hi9i2DcaR1\n" +
                    "e9KUwQUZRhy5j/PEdEglKg3l9dtD4tuTm7kZtB8v32oOjzHTYw+7KdzdZiw/sBtn\n" +
                    "UfhBPORNuay4pJxmY/WrhSMdzFO2q3Gu3MUBcdo27goYKjL9CTF8j/Zz55yctUoV\n" +
                    "aneCWs/ajUX+HypkBTA+c8LGDLnWO2NKq0YD/pnARkAnYGPfUDoHR9gVSp/qRx+Z\n" +
                    "WghiDLZsMwhN1zjtSC0uBWiugF3vTNzYIEFfaPG7Ws3jDrAMMYebQ95JQ+HIBD/R\n" +
                    "PBuHRTBpqKlyDnkSHDHYPiNX3adPoPAcgdF3H2/W0rmoswMWgTlLn1Wu0mrks7/q\n" +
                    "pdWfS6PJ1jty80r2VKsM/Dj3YIDfbjXKdaFU5C+8bhfJGqU3taKauuz0wHVGT3eo\n" +
                    "6FlWkWYtbt4pgdamlwVeZEW+LM7qZEJEsMNPrfC03APKmZsJgpWCDWOKZvkZcvjV\n" +
                    "uYkQ4omYCTX5ohy+knMjdOmdH9c7SpqEWBDC86fiNex+O0XOMEZSa8DA\n" +
                    "-----END CERTIFICATE-----"); 
            });
        

            var privateKey = "-----BEGIN PRIVATE KEY-----\n" +
            "MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCBqo/Gc2dG2DhX\n" +
            "ewjs3MCGhEla/hDMW6C+jX2QNixwtSvbVRfBziJzNxkdRXwM14sOBGPQ+8MQjb7T\n" +
            "zkgNQDW48ENj+zOoSig/xcTC2znUvGEQKvFZo0ojM+f3aMaRAoKUfXsa8j3IBDIY\n" +
            "vFIr+iHgX2bPSEHGuw+r7xWx8voT+31BgBf3bnZ7h33yuLb6AE14Ice9/d/48USc\n" +
            "+Z4yqYTnzsw1t14hpYyfqc1Jwtt7Y1xhKrXrZ/y98F0V4JK4rpRo2oq5wFpK1EX9\n" +
            "DPhsLAAUqqux6Zra/k9d+6N6wi611cyoJM2zG0J7dtVStzY3kiv6Rk3H7rHoZEOh\n" +
            "rh7Q+zaxAgMBAAECggEAFusOKX3ZSbjK0I+DBtaHwt7b1lTkpDInybZZdKVWmn8z\n" +
            "Jru2DL/B8ApTioxu/hgU0F/vQo9VLXZYPbiOnKT2Od9hkeji+wJMdeUfP2+fG55G\n" +
            "K6TjbrwBTRKOE/k1a4j9ioBZQ2yAhftT3XJftb0qwq0qD0YOtjD29qU1+PNgxyoi\n" +
            "VB+Xci5pA1IH5lOkIo5fLROVDCmJmsP1qBYHFLEGsnQYjJ2yz1dYCFII73sOY4P3\n" +
            "fcV9VnX6xgXS0K8a59SXrtDKM0jtshaMJLBoUaKOxAM/z/9PK8jkuxTS/kU4jNHR\n" +
            "ww2nAHYCq5HbUH6wxvmwJp5+/jUHEK9ocIgS2/lFyQKBgQC2Tj5aW8tNRwoZU78s\n" +
            "CWADTx0LWIJWzfAfTtB//1oesX02l8z6nTRomJAcgQbODucPcLTvMlnJKlD5FzsW\n" +
            "Vk3ouLTJmZy5jPIG1Jtus9L2N2HudLy+vqctBUVbn5KxaW7Bg/x77bSFVB+FxOWU\n" +
            "f8A0cCZ2AAEwMVbuuqvrcAHi9QKBgQC2FPkEi1HCyWPq3375iXvAqenTcRVZRQxi\n" +
            "sCv8wfdD7IIHSRxhqPh0Bw3+aVPL8yKsFloEB82hRZ360Zi1uabzG4ivve7lkrSM\n" +
            "jGFh5O1SyHntcg8NvwJKVne2ekgUgiz5EOB1cErbODEoL3YKqHu3o/ex7fZL8KhJ\n" +
            "LfCF1ZhHTQKBgDx2pueBGmR+8zKDPBx234k5bACfUltH4iQAF9bb8h/L7iN1JV7Z\n" +
            "VNB8CQ/rGz6sYqYUU24h3PWDO2fh9I7sANr2p79VW02PGZZ6XTLSIV3X8HsN7Ku2\n" +
            "v+uGnAJPYm/E8B7uj4bqx7yQsgPD0gD2feDmcVshlUNOme6DqxFjDL0hAoGBAJ/2\n" +
            "BtqmJpsQYBZMaHmC/dRBsalPFGlLjtj4WnyATuE+WvFZmnR1hGgydmnGUJbBL/ms\n" +
            "3UHjNRR0W5ipIBauVewHiWqTWtgWrUU4Yqkk/BWZB/zBElaKMtHp6tvFy6MwxZ+9\n" +
            "4uNpVmoGkLD0GSi94Ypwoz+Oha0rbDx1/nMlNdWVAoGBAJntwgDDMIljIzKC8hXx\n" +
            "8wzkSgcFdOHPaltxy8E/H/tF+HtRqWupYTR0ZFPF0HEqUEu5RsVRWD507Twf7Y11\n" +
            "6cTzgXdrTHIIvgMa+UcKU4QfOWZcLNEa8BYL4TWm0lJFT4u1szdHePruuC13CzpK\n" +
            "optJSuqGciLUsSiPRFVWcUII\n" +
            "-----END PRIVATE KEY-----\n";

            qz.security.setSignatureAlgorithm("SHA512"); // Since 2.1
            qz.security.setSignaturePromise(function(toSign) {
                return function(resolve, reject) {
                    try {
                        var pk = KEYUTIL.getKey(privateKey);
                        var sig = new KJUR.crypto.Signature({"alg": "SHA512withRSA"});  // Use "SHA1withRSA" for QZ Tray 2.0 and older
                        sig.init(pk);
                        sig.updateString(toSign);
                        var hex = sig.sign();
                        console.log("DEBUG: \n\n" + stob64(hextorstr(hex)));
                        resolve(stob64(hextorstr(hex)));
                    } catch (err) {
                        console.error(err);
                        reject(err);
                    }
                };
            });
    
            // here you can use anything you defined in the loaded script
            //const qz = require("qz-tray");
            var options = [];
            options['host']=['POS-BAR01','POS-BAR02'];
            options['usingSecure']= true;

            if (qz.websocket.isActive()) {	// if already active, resolve immediately
              //resolve();
              console.log('ja ESTA LIGADOOOOOOOOOOOOOOOOOOOOOO');
            } else {
              qz.websocket.connect(options).then(() => {
                console.log('ligouuuuuuu');
                //return qz.printers.find();
                return qz.printers.getDefault();
              }).then((printers) => {
                  console.log(printers);
                  print ('dadaosssssss');
                  print (data);

                  //PRinter 0
                  //To get from USER Settings WHICH PRINTER BAR and KITCHEN
                  //let config = qz.configs.create(printers[0]);
                  let config = qz.configs.create(printers);
                  let dados_print =  '<!DOCTYPE html><style>	.print-format table, .print-format tr, 	.print-format td, .print-format div, .print-format p {		font-family: Tahoma, sans-serif;		line-height: 150%;		vertical-align: middle;	}	@media screen {		.print-format {			width: 4in;			padding: 0.25in;			min-height: 8in;		}	}</style><p class="text-center" style="margin-bottom: 1rem">	PEDIDO MESA<br></p>'
                  //'&nbsp;&nbsp;&nbsp;&nbsp;<div class="text-center"><h2>PEDIDO MESA</h2></div> '
                  dados_print += '&nbsp;&nbsp;<strong><p style="font-size:10px;>Sala: ' + data.table_description + ' </p> '
                  dados_print += '<p style="font-size:10px;>MESA: ' + data.table_description + ' </p> </strong>'
                  dados_print += '<strong><p class="text-center">' + data.item_name.trim() + ' </p> '
                  dados_print += ' &nbsp;&nbsp;<p>QTD:  ' + data.qty + ' </p> </strong>'
                  dados_print += '&nbsp;&nbsp;&nbsp;&nbsp;<p class="text-center" style="font-size:10px;" >Pedido as:  ' + data.ordered_time + ' </p>'
                  /*
                  return qz.print(config, [{
                      type: 'pixel',
                      format: 'html',
                      flavor: 'plain',
                      data: dados_print
                  }]);
                  */
              }).then(() => {
                  return qz.websocket.disconnect();
              }).then(() => {
                  // process.exit(0);
              }).catch((err) => {
                  console.error(err);
                  // process.exit(1);
              });           
            }
 
        });

        //TODO: USAR O LOCAL
    })

  }        
}

