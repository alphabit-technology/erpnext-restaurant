# -*- coding: utf-8 -*-
# Copyright (c) 2021, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
from operator import inv
import frappe
from frappe import _
from frappe.model.document import Document
import json

import os

from restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage import RestaurantManage

status_attending = "Attending"

#Last Modified: 04-08-2025

class TableOrder(Document):
    synchronize_data = None
    def before_save(self):
        print ('BEFORE SAVE')
        print (self.synchronize_data)
        if self.synchronize_data:
            self.synchronize(self.synchronize_data)
        else:
            self.synchronize(dict(status=self.status))

        self.notify_status()

        if self.link_invoice:
            return

        entry_items = self.items_list()

        if len(entry_items) > 0:
            print ('call calculate ORDER!!!!!!')
            self.calculate_order(entry_items)

    def notify_status(self):
        last_status = frappe.db.get_value("Table Order", self.name, "status")
        if self.status == "Sent" and last_status != "Sent":
            frappe.msgprint(_('Order {0} has been sent to kitchen').format(self.name),
                            indicator='green', alert=True)

        if self.status == "Cancelled" and last_status != "Cancelled":
            frappe.msgprint(_('Order {0} has been cancelled').format(self.name),
                            indicator='red', alert=True)

    def validate(self):
        if self.status is None:
           self.status = "Opened"
           self.show_in_pos = 1

        if self.status == "Cancelled":
            self.show_in_pos = 0

        if self.status == "Sent" and len(self.entry_items) == 0:
            if self.status != frappe.db.get_value("Table Order", self.name, "status"):
                frappe.throw(_("You can't send an empty order"))

            self.show_in_pos = 0
            self.ordered_time = frappe.utils.now_datetime()

        self.set_default_customer()

    def set_default_customer(self):
        if self.customer:
            return

        if self._table and self._table.customer:
            self.customer = self._table.customer
        else:
            self.customer = frappe.db.get_value(
                'POS Profile', self.pos_profile, 'customer')

    @property
    def short_name(self):
        return self.name[8:]

    @property
    def items_count(self):
        return frappe.db.count("Order Entry Item", filters={
            "parenttype": "Table Order", "parent": self.name, "qty": (">", "0")
        })

    @property
    def products_not_ordered_count(self):
        return frappe.db.count("Order Entry Item", filters={
            "parenttype": "Table Order", "parent": self.name, "status": status_attending
        })

    @property
    def _table(self):
        return frappe.get_doc("Restaurant Object", self.table)

    def divide_template(self):
        #import os
        # Get the directory of the current file
        current_dir = os.path.dirname(os.path.abspath(__file__))
        template_path = os.path.join(current_dir, 'divide_template.html')
        
        # Read the template file
        with open(template_path, 'r') as f:
            template_content = f.read()
        
        # Render the template
        return frappe.render_template(
            template_content,
            {
                "model": self,
                "items": self.items_list(),
                "table": self.table
            }
        )

    def divide_template_v0(self):
        return frappe.render_template(
            "restaurant_management/restaurant_management/restaurant_management/doctype/table_order/divide_template.html", {
                "model": self,
                "items": self.items_list(),
                "table": self.table
            })

    def get_restaurant(self):
        table = frappe.get_doc("Restaurant Object", self.table)
        return frappe.db.get_value('Restaurant', table._restaurant)

    def divide(self, items, client):
        new_order = frappe.new_doc("Table Order")
        self.transfer_order_values(new_order)
        new_order.save()
        status = []

        for item in self.entry_items:
            divide_item = items[item.identifier] if item.identifier in items else None

            if divide_item is not None:
                rest = (int(item.qty) - int(divide_item["qty"]))
                current_item = self.items_list(item.identifier)[0]
                current_item["qty"] = rest
                self.update_item(current_item, True, False)

                new_order.update_item(dict(
                    item_code=item.item_code,
                    qty=divide_item["qty"],
                    rate=item.rate,
                    price_list_rate=item.price_list_rate,
                    item_tax_template=item.item_tax_template,
                    item_tax_rate=item.item_tax_rate,
                    discount_percentage=item.discount_percentage,
                    status=item.status,
                    identifier=item.identifier if rest == 0 else divide_item["identifier"],
                    notes=item.notes,
                    ordered_time=item.ordered_time,
                    room=self.room,
                    branch=self.branch,
                    table=self.table,
                    #table_description=self.table_info,
                    has_batch_no=item.has_batch_no,
                    batch_no=item.batch_no,
                    has_serial_no=item.has_serial_no,
                    serial_no=item.serial_no,
                ))

            status.append(item.status)

        self.db_commit()
        new_order.aggregate()
        new_order.save()

        new_order.synchronize(dict(action="Add", client=client))
        self.synchronize(dict(action="Split", client=client, status=status))

        return True

    @staticmethod
    def debug_data(data):
        frappe.publish_realtime("debug_data", data)

    @staticmethod
    def options_param(options, param):
        return None if options is None else (options[param] if param in options else None)

    def synchronize(self, options=None):
        action = self.options_param(options, "action") or "Update"
        items = self.options_param(options, "items")
        last_table = self.options_param(options, "last_table")
        status = self.options_param(options, "status")
        item_removed = self.options_param(options, "item_removed")

        frappe.publish_realtime("synchronize_order_data", dict(
            action=action,
            data=[] if action is None else self.data(items, last_table),
            client=self.options_param(options, "client"),
            item_removed=item_removed
        ))

        self._table.synchronize()

        if status is not None:
            RestaurantManage.production_center_notify(status)

    def make_invoice(self, mode_of_payment):
        if self.link_invoice:
            return frappe.throw(_("The order has been invoiced"))

        entry_items = {
            item.identifier: item.as_dict() for item in self.entry_items
        }

        if len(entry_items) == 0:
            frappe.throw(_("There is not Item in this Order"))
        print ('call get invoice - make_invoice')
        invoice = self.get_invoice(entry_items, True)

        #FIX 21-08-2026;
        invoice.update_stock = 1

        invoice.payments = []
        for mp in mode_of_payment:
            invoice.append('payments', dict(
                mode_of_payment=mp,
                amount=mode_of_payment[mp]
            ))

        invoice.validate()
        invoice.save()
        invoice.submit()

        self.status = "Invoiced"
        self.show_in_pos = 0
        self.link_invoice = invoice.name

        self.synchronize_data = dict(action="Invoiced", status=["Invoiced"])
        self.save()

        frappe.db.set_value("Table Order", self.name, "docstatus", 1)

        frappe.msgprint(_('Invoice Created'), indicator='green', alert=True)

        #self.synchronize(dict(action="Invoiced", status=["Invoiced"]))

        return dict(
            status=True,
            invoice_name=invoice.name
        )

    def transfer(self, table, client):
        last_table = self._table
        new_table = frappe.get_doc("Restaurant Object", table)

        # last_table.validate_user()
        last_table_name = self.table
        new_table.validate_transaction(self.owner)

        self.table = table

        #self.synchronize_data = dict(
        #    action="Transfer", client=client, last_table=last_table_name)
        self.save()

        #table_description = self.table_info

        #for i in self.entry_items:
        #    frappe.db.set_value("Order Entry Item", {"identifier": i.identifier}, "table_description",
        #                        table_description)

        self.reload()
        
        self.synchronize(
            dict(action="Transfer", client=client, last_table=last_table_name))

        last_table.synchronize()
        return True

    def transfer_order_values(self, to_doc):
        to_doc.company = self.company
        to_doc.is_pos = 1
        to_doc.customer = self.customer
        to_doc.title = self.customer
        to_doc.taxes_and_charges = self.taxes_and_charges
        to_doc.selling_price_list = self.selling_price_list
        to_doc.pos_profile = self.pos_profile
        to_doc.table = self.table
        #to_doc.shipping_rule = self.shipping_rule

    def get_invoice(self, entry_items=None, make=False):
        invoice = frappe.new_doc("POS Invoice")
        self.transfer_order_values(invoice)

        invoice.items = []
        invoice.taxes = []
        taxes = {}

        print ('GET INVOICE - ENTRY_ITEMS')
        print (self.name)
        print (entry_items)

        for i in entry_items:
            item = entry_items[i]
            is_customizable = True if "is_customizable" in item and item["is_customizable"] == 1 else False

            if item["qty"] > 0:
                try: rate = float(item["rate"])
                except ValueError: rate = 0
                
                try: price_list_rate = float(item["price_list_rate"])
                except ValueError: price_list_rate = 0

                print ('GET INVOICE =====================================')
                if "ponto_carne" in item:
                    print (item["ponto_carne"])

                margin_rate_or_amount = (rate - price_list_rate)
                invoice.append('items', dict(
                    identifier=item["identifier"],
                    item_code=item["item_code"],
                    qty=item["qty"],
                    rate=item["rate"],
                    discount_percentage=item["discount_percentage"],

                    item_tax_template=item["item_tax_template"] if "item_tax_template" in item else None,
                    item_tax_rate=item["item_tax_rate"] if "item_tax_rate" in item else None,

                    margin_type="Amount",
                    margin_rate_or_amount=0 if margin_rate_or_amount < 0 else margin_rate_or_amount,

                    has_serial_no=item["has_serial_no"],
                    serial_no=item["serial_no"],
                    has_batch_no=item["has_batch_no"],
                    batch_no=item["batch_no"],

                    conversion_factor=1,

                    ponto_carne = item['ponto_carne'] if "ponto_carne" in item else None,

                    stock_uom=item['stock_uom'] if "stock_uom" in item else None,   #FIX 20-08-2026
                    dish_side_selected = item['dish_side_selected'] if "dish_side_selected" in item else None,
                    dish_side_selected1 = item['dish_side_selected1'] if "dish_side_selected1" in item else None,
                    which_printer = item['which_printer'] if "which_printer" in item else None
                ))

                #frappe.publish_realtime("debug", dict(data=item))

                if is_customizable:
                    sub_items = json.loads(item["sub_items"])

                    for sub_item in sub_items:
                        if sub_item["included"] == 1:
                            invoice.append('items', dict(
                                item_code=sub_item["item_code"],
                                qty=sub_item["qty"],
                                rate=0,
                                price_list_rate=0,
                                from_customize=1,
                                customize_parent=item["identifier"],
                                conversion_factor=1,
                            ))

                if "item_tax_rate" in item:
                    if not item["item_tax_rate"] in taxes:
                        taxes[item["item_tax_rate"]] = item["item_tax_rate"]

        in_invoice_taxes = [t for t in invoice.get("taxes")]

        for tax in taxes:
            if tax is not None:
                for t in json.loads(tax):
                    in_invoice_taxes.append(t)

        included_in_print_rate = frappe.db.get_value(
            "POS Profile", self.pos_profile, "posa_tax_inclusive")

        cost_center = frappe.db.get_value(
            "POS Profile", self.pos_profile, "cost_center")

        invoice.cost_center = cost_center

        tax_template = frappe.db.get_value(
            "Sales Taxes and Charges Template", {"company": self.company})

        print ('in_invoice_taxes')
        print (in_invoice_taxes)
        for t in set(in_invoice_taxes):
            #FIX 19-12-2024; Sales Taxes And Charges to Sales Taxes and Charges; amount to tax_amount
            tax = frappe.db.get_value("Sales Taxes and Charges", dict(
                parenttype=tax_template, account_head=t), ["charge_type", "rate", "tax_amount", "included_in_print_rate"], as_dict=True)

            if isinstance(tax, type(None)):
                invoice.append('taxes', {
                    "charge_type": "On Net Total",
                    "account_head": t,
                    "rate": 0,
                    "description": t,
                    "included_in_print_rate": included_in_print_rate
                })
            else:
                invoice.append('taxes', {
                    "charge_type": tax.charge_type,
                    "account_head": t,
                    "rate": tax.rate or 0,
                    "tax_amount": tax.tax_amount or 0,
                    "description": t,
                    "included_in_print_rate": included_in_print_rate or tax.included_in_print_rate
                })

        if self.is_delivery == 1 and self.delivery_branch != 1 and self.address:
            address = frappe.db.get_value(
                "Address", self.address, "posa_delivery_charges")
            shipping_data = frappe.db.get_value("Delivery Charges", address, [
                                                "default_rate", "shipping_account", "cost_center"], as_dict=True)

            if not isinstance(shipping_data, type(None)):
                invoice.append('taxes', {
                    "charge_type": "Actual",
                    "account_head": shipping_data.shipping_account,
                    "rate": 0,
                    "tax_amount": shipping_data.default_rate or 0,
                    "description": shipping_data.shipping_account,
                    "cost_center": shipping_data.cost_center,
                    "included_in_print_rate": 0
                })

        invoice.run_method("set_missing_values")
        invoice.run_method("calculate_taxes_and_totals")

        ##To validate the invoice
        invoice.payments = []
        invoice.append('payments', dict(
            mode_of_payment="cash",
            amount=invoice.grand_total
        ))
        invoice._action = "submit"
        invoice.validate()
        ##To validate the invoice

        return invoice

    def set_queue_items(self, all_items):
        from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
        check_exceptions(
            dict(name="Table Order", short_name="order",
                 action="write", data=self),
            "You cannot modify an order from another User"
        )

        self.synchronize_data = dict(action="queue")
        print ('SET QUEUE ITEMS call calculate ORDER!!!!!!')
        self.calculate_order(all_items, True)
        
        #self.action = "queue"
        #self.synchronize(dict(action="queue"))

    def set_is_delivery(self, is_delivery):
        self.is_delivery = is_delivery
        self.save()

    def set_delivery_branch(self, delivery_branch):
        self.delivery_branch = delivery_branch
        self.save()

    def push_item(self, item):
        if self.customer is None:
            frappe.throw(_("Please set a Customer"))

        from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
        check_exceptions(
            dict(name="Table Order", short_name="order",
                 action="write", data=self),
            "You cannot modify an order from another User"
        )

        if self.status == "Opened":
            self.status = "Attending"
            self.save()

        action = self.update_item(item)

        self.synchronize_data = dict(item=item["identifier"])
        print ('AFTTER PUSH SYNc')
        print (item)

        if action == "db_commit":
            self.db_commit()
        else:
            self.aggregate()

        
        #self.synchronize(dict(item=item["identifier"]))

    def delete_item(self, item, unrestricted=False, synchronize=True):
        if not unrestricted:
            from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
            check_exceptions(
                dict(name="Table Order", short_name="order",
                     action="write", data=self),
                "You cannot modify an order from another User"
            )

        status = frappe.db.get_value(
            "Order Entry Item", {'identifier': item}, "status")
        frappe.db.delete('Order Entry Item', {'identifier': item})
        self.db_commit()

        if synchronize and frappe.db.count("Order Entry Item", {"identifier": item}) == 0:
            #self.synchronize_data = dict(action='queue', item_removed=item, status=[status])
            self.synchronize(
                dict(action='queue', item_removed=item, status=[status]))

    def db_commit(self):
        frappe.db.commit()
        self.reload()
        self.aggregate()

    def aggregate(self):
        tax = 0
        amount = 0
        for item in self.entry_items:
            #FIX 15-10-2024
            tax += item.tax_amount if item.tax_amount else 0
            amount += item.amount

        self.tax = tax
        #FIX 29-07-2025; Added Round....
        #self.amount = amount
        self.amount = round(amount,2)

        self.save()

    def update_item(self, entry, unrestricted=False, synchronize_on_delete=True):
        if entry["qty"] == 0:
            self.delete_item(entry["identifier"],
                             unrestricted, synchronize_on_delete)
            return "db_commit"
        else:
            print ('UPDATE ITEM ENTRY ', entry)
            invoice = self.get_invoice({entry["identifier"]: entry})
            item = invoice.items[0]
            #FIX 31-12-2024            
            get_wasprinted =  frappe.get_all("Order Entry Item",filters={'identifier':entry["identifier"]},fields=['name','parent','was_printed'])
            print ('get_wasprinted ', get_wasprinted)
            if get_wasprinted:
                print (get_wasprinted[0].was_printed)

            print ('UPDATE ITEM=====================================')
            print (item.ponto_carne)


            data = dict(
                item_code=item.item_code,
                qty=item.qty,
                rate=item.rate,
                stock_uom=item.stock_uom,   #FIX 03-06-2025
                price_list_rate=item.price_list_rate,
                item_tax_template=item.item_tax_template,
                item_tax_rate=item.item_tax_rate,
                tax_amount=invoice.base_total_taxes_and_charges,
                amount=invoice.grand_total,
                discount_percentage=item.discount_percentage,
                discount_amount=item.discount_amount,
                status="Attending" if entry["status"] in [
                    "Pending", "", None] else entry["status"],
                identifier=entry["identifier"],
                notes=entry["notes"],
                room=self.room,
                branch=self.branch,
                table=self.table,
                #table_description=self.table_info,
                ordered_time=entry["ordered_time"]or frappe.utils.now_datetime(),
                has_batch_no=entry["has_batch_no"],
                batch_no=entry["batch_no"],
                has_serial_no=entry["has_serial_no"],
                serial_no=entry["serial_no"],
                was_printed=get_wasprinted[0].was_printed if get_wasprinted !=[] else 0,   #FIX 31-12-2024

                #sub_items=entry["sub_items"],  #REMOVED FOR NOW; 14-10-2024
                #is_customizable=entry["is_customizable"],  #REMOVED FOR NOW; 14-10-2024
                #FIX 30-05-2025
                ponto_carne = entry["ponto_carne"] if "ponto_carne" in entry else None,

                dish_side_selected = entry['dish_side_selected'] if "dish_side_selected" in entry else None,
                dish_side_selected1 = entry['dish_side_selected1'] if "dish_side_selected1" in entry else None,
                which_printer = entry['which_printer'] if "which_printer" in entry else None

            )

            self.validate()

            if frappe.db.count("Order Entry Item", {"identifier": entry["identifier"]}) == 0:
                print ('AQQQQQQQ')
                self.append('entry_items', data)
                return "aggregate"
            else:
                values = ','.join('='.join((f"`{key}`", """{value}""".format(value=(f"'{val}'" if val is not None else "") if key == "item_tax_template" else frappe.db.escape(val)))) for (key, val) in data.items())
                base_sql = f"UPDATE `tabOrder Entry Item` set {values}"
 
                frappe.db.sql("""{base_sql} WHERE `identifier`='{identifier}'""".format(base_sql = base_sql, identifier=entry["identifier"]))
                print ('XXXXXXXXXXXXXXXXXXX')

                return "db_commit"

    def calculate_order(self, items, save=False):
        print ('call get invoice - calculate order')
        print ('items ')
        print (items)

        entry_items = {item["identifier"]: item for item in items}
        invoice = self.get_invoice(entry_items)

        self.entry_items = []
        for item in invoice.items:            
            if item.from_customize == 1:
                continue
            entry_item = entry_items[item.identifier] if item.identifier in entry_items else None

            self.append('entry_items', dict(
                item_code=item.item_code,
                item_group=item.item_group,
                item_name=item.item_name,
                qty=item.qty,
                rate=item.rate,
                price_list_rate=item.price_list_rate,
                item_tax_template=item.item_tax_template,
                item_tax_rate=item.item_tax_rate,
                amount=item.amount,
                discount_percentage=item.discount_percentage,
                discount_amount=item.discount_amount,
                status="Attending" if entry_item["status"] in [
                    "Pending", "", None] else entry_item["status"],
                identifier=entry_item["identifier"],
                notes=entry_item["notes"],
                ordered_time=entry_item["ordered_time"],
                room=self.room,
                branch=self.branch,
                table=self.table,
                #table_description=self.table_info,
                has_batch_no=entry_item["has_batch_no"],
                batch_no=entry_item["batch_no"],
                has_serial_no=entry_item["has_serial_no"],
                serial_no=entry_item["serial_no"],
                sub_items=entry_item["sub_items"],
                is_customizable=entry_item["is_customizable"],
                was_printed=entry_item["was_printed"],    #FIX 31-12-2024

                #FIX 30-05-2025
                ponto_carne=entry_item["ponto_carne"],

                stock_uom=item.stock_uom,    #FIX 03-06-2025

                dish_side_selected = entry_item['dish_side_selected'],
                dish_side_selected1 = entry_item['dish_side_selected1'],
                which_printer = entry_item['which_printer']

            ))
            #item.serial_no = None

        self.tax = invoice.base_total_taxes_and_charges
        self.discount = invoice.base_discount_amount
        self.amount = invoice.grand_total
        save and self.save()
        #self.save(True)

    @property
    def identifier(self):
        return self.name

    def data(self, items=None, last_table=None):
        short_data = self.short_data(last_table)
        print ('TABLE ORDER - DATA')
        print ('items')
        print (items)

        items = self.items_list() if items is None else items

        return dict(
            order=short_data,
            items=dict(data=short_data, items=items)
        )

    def get_delivery_address(self, address=None):
        if not address:
            return {
                "address": "",
                "charges": 0
            }

        _address = frappe.get_doc("Address", address)

        charges = 0 if self.delivery_branch == 1 else frappe.db.get_value(
            "Delivery Charges", _address.posa_delivery_charges, "default_rate"
        )

        return dict(
            address=_address.get_display(),
            charges=charges
        )

    @property
    def table_info(self):
        return f'{self.room_description} ({self.table_description})',

    def short_data(self, last_table=None):
        return dict(
            data=dict(
                last_table=last_table,
                table=self.table,
                customer=self.customer,
                is_delivery=self.is_delivery,
                delivery_branch=self.delivery_branch,
                charge_amount=self.charge_amount,
                name=self.name,
                order=self.name,
                table_description=self.table_description if self.table_description else self.table,
                room_description=self.room_description if self.room_description else self.room,
                #table_description=self.table_info,
                status=self.status,
                short_name=self.short_name,
                items_count=self.items_count,
                attending_status=status_attending,
                products_not_ordered=self.products_not_ordered_count,
                tax=self.tax,
                amount=self.amount,
                owner=self.owner,
                dinners=self.dinners,
                process_status_data=self._table.process_status_data(self),
                show_in_pos=self.show_in_pos,
                delivery_address=self.get_delivery_address(self.address)["address"],
                notes=self.notes,
                ordered_time=self.ordered_time or frappe.utils.now_datetime(),
                branch=self.branch,
                #table_info=self.table_info,
            )
        )

    def items_list(self, from_item=None):
        print ('ITEM LIST ++++++++++++++++++++++++++++++++')
        table = self._table
        items = []
        short_name = self.short_name

        for item in self.entry_items:
            if item.qty is not None and item.qty > 0 and (from_item is None or from_item == item.identifier):
                _item = item.as_dict()

                row = {col: _item[col] for col in [
                    "identifier",
                    "item_group",
                    "item_code",
                    "item_name",
                    "qty",
                    "stock_uom",    #FIX 03-06-2025
                    "rate",
                    "amount",
                    "discount_percentage",
                    "discount_amount",
                    "price_list_rate",
                    "item_tax_template",
                    "item_tax_rate",
                    "room",
                    "branch",
                    "table",
                    #"table_description",
                    "status",
                    "notes",
                    "ordered_time",
                    "has_batch_no",
                    "batch_no",
                    "has_serial_no",
                    "serial_no",
                    "sub_items",
                    "is_customizable",
                    "was_printed",
                    "ponto_carne",
                    "dish_side_selected",
                    "dish_side_selected1",
                    "which_printer"
                ]}

                row["order_name"] = item.parent
                row["entry_name"] = item.name
                row["short_name"] = short_name
                row["process_status_data"] = table.process_status_data(item)
                row["name"] = item.identifier
                row["order"] = short_name
                row["table_description"] = self.table_info
                #row["table_info"] = self.table_info
                
                print ('item item_code ', item.item_code)
                
                #FIX 02-06-2025
                pratos = frappe.get_doc('Item',item.item_code)
                if pratos.dish_sides:
                    #row['dish_sides'] = frappe.get_doc('Item',item.item_code).dish_sides #FIX 30-05-2025
                    row['dish_sides'] = pratos.dish_sides #FIX 30-05-2025

                #FIX 31-12-2024
                #row["was_printed"] = item.was_printed

                items.append(row)
        return items

    @property
    def send(self):
        table = self._table
        items_to_return = []
        data_to_send = []
        for i in self.entry_items:
            item = frappe.get_doc("Order Entry Item", {"identifier": i.identifier})
            if item.status == status_attending:
                items_to_return.append(i.identifier)

                item.status = "Sent"
                item.ordered_time = frappe.utils.now_datetime()
                #fIX 30-05-2025
                print ('PONTO CARNE ', i.ponto_carne)
                item.save()

                data_to_send.append(table.get_command_data(item))

        self.reload()
        #self.synchronize_data = dict(status=["Sent"])
        self.synchronize(dict(status=["Sent"]))

        return self.data()

    def set_item_note(self, item, notes):
        frappe.db.set_value("Order Entry Item", {
                            "identifier": item}, "notes", notes)
        self.reload()
        item = self.items_list(item)
        self.synchronize(dict(items=item))

    @property
    def get_items(self):
        return self.data()

    @property
    def _delete(self):
        self.normalize_data()
        if len(self.entry_items) > self.products_not_ordered_count:
            frappe.throw(_("There are ordered products, you cannot delete"))

        self.delete()

    def normalize_data(self):
        self.entry_items = []
        for item in self.entry_items:
            if item.qty > 0:
                self.append('entry_items', dict(
                    name=item.name,
                    item_code=item.item_code,
                    qty=item.qty,
                    rate=item.rate,
                    price_list_rate=item.price_list_rate,
                    item_tax_template=item["item_tax_template"],
                    discount_percentage=item.discount_percentage,
                    discount_amount=item.discount_amount,
                    status=item.status,
                    identifier=item.identifier,
                    notes=item.notes,
                    ordered_time=item.ordered_time,
                    has_batch_no=item.has_batch_no,
                    batch_no=item.batch_no,
                    has_serial_no=item.has_serial_no,
                    serial_no=item.serial_no,
                    was_printed=item.was_printed    #FIX 31-12-2024
                ))
        self.save()

    def after_delete(self):
        self.synchronize(dict(action="Delete", status=["Deleted"]))

    def set_printed_status(self, identifier, itemcode):
        #FIX 19-10-2024
        print ('identi ', identifier)
        print ('itemmmm ', itemcode)

        if identifier:
            print ('SET PRINTED STATUZ DONE....')
            frappe.db.sql(""" UPDATE `tabOrder Entry Item` set was_printed = 1 where parent = %s and item_code = %s """, (identifier,itemcode), as_dict=False)
            frappe.db.commit()

