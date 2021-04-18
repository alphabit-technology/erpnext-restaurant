# -*- coding: utf-8 -*-
# Copyright (c) 2020, CETI Systems and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document

status_attending = "Attending"


class TableOrder(Document):
    # def onload(self):
    #    return frappe.throw(_("The table is Assigned to another User"))

    def validate(self):
        self.set_default_customer()

    def set_default_customer(self):
        if self.customer:
            return

        self.customer = frappe.db.get_value('POS Profile', self.pos_profile, 'customer')

    @property
    def short_name(self):
        return self.name[8:]

    @property
    def items_count(self):
        return frappe.db.count("Order Entry Item", filters={
            "parentType": "Table Order", "parent": self.name, "qty": (">", 0)
        })

    @property
    def products_not_ordered_count(self):
        return frappe.db.count("Order Entry Item", filters={
            "parentType": "Table Order", "parent": self.name, "status": status_attending
        })

    @property
    def _table(self):
        return frappe.get_doc("Restaurant Object", self.table)

    def divide_template(self):
        return frappe.render_template(
            "restaurant_management/restaurant_management/doctype/table_order/divide_template.html", {
                "model": self,
                "items": self.items_list(),
                "table": self.table
            })

    def get_restaurant(self):
        table = frappe.get_doc("Restaurant Object", self.table)
        return frappe.db.get_value('Restaurant', table._restaurant)

    def divide(self, items, client):
        new_order = frappe.new_doc("Table Order")

        for item in self.entry_items:
            divide_item = items[item.identifier] if item.identifier in items else None

            if divide_item is not None:
                rest = (int(item.qty) - int(divide_item["qty"]))

                frappe.db.set_value("Order Entry Item", {"identifier": item.identifier}, "qty", rest)
                new_order.append('entry_items', dict(
                    item_code=item.item_code,
                    qty=divide_item["qty"],
                    rate=item.rate,
                    price_list_rate=item.price_list_rate,
                    item_tax_template=item["item_tax_template"],
                    discount_percentage=item.discount_percentage,
                    status=item.status,
                    identifier=item.identifier if rest == 0 else divide_item["identifier"],
                    notes=item.notes,
                    creation=item.creation
                ))

        table = self._table
        new_order.table = table.name
        new_order.save()

        table.send_notifications(client, new_order.name)

        return True
        """return {
            "current_items": self.items_list(),
            "order": new_order.data(),
            "orders": table.orders_list()
        }"""

    def make_invoice(self, mode_of_payment, customer=None, dinners=0):
        if self.link_invoice:
            return frappe.throw(_("The order has been invoiced"))

        self.customer = customer
        self.dinners = dinners
        self.save()

        if customer is None or len(customer) == 0 or dinners == 0:
            none_customer = "Please set a Customer<br>" if customer is None or len(customer) == 0 else ""
            none_dinners = "Please set a Dinners" if dinners == 0 else ""

            frappe.throw(none_customer + none_dinners)

        entry_items = {
            item.identifier: item.as_dict() for item in self.entry_items
        }

        if len(entry_items) == 0:
            frappe.throw(_("There is not Item in this Order"))

        invoice = self.get_invoice(entry_items, True)

        for mp in mode_of_payment:
            invoice.append('payments', dict(
                mode_of_payment=mp,
                amount=mode_of_payment[mp]
            ))

        invoice.save()

        self.status = "Invoiced"
        self.link_invoice = invoice.name
        self.save()
        self.submit()
        invoice.submit()

        frappe.msgprint(_('Invoice Created'), indicator='green', alert=True)

        table = self._table
        table.send_notifications()

        return dict(
            status=True,
            invoice_name=invoice.name
        )

    def transfer(self, table, client):
        last_table = self._table
        new_table = frappe.get_doc("Restaurant Object", table)

        #last_table.validate_user()
        new_table.validate_user(self.owner)

        self.table = table
        self.save()

        new_table._on_update()

        data = self.data()
        frappe.publish_realtime(self.name, dict(
            action="Transfer",
            table=self.table
        ))

        new_table.send_notifications(client)

        frappe.publish_realtime(table, dict(
            action="Transfer Order",
            orders=self._table.orders_list(),
            order=data["data"],
            items=data["items"],
            client=client
        ))

        #self._table.send_notifications(client)

        last_table.send_notifications(client)

    def set_invoice_values(self, invoice):
        invoice.company = self.company
        invoice.is_pos = 1
        invoice.customer = self.customer
        invoice.title = self.customer
        invoice.taxes_and_charges = self.taxes_and_charges
        invoice.selling_price_list = self.selling_price_list
        invoice.pos_profile = self.pos_profile

    def get_invoice(self, entry_items=None, make=False):
        invoice = frappe.new_doc("Sales Invoice")
        self.set_invoice_values(invoice)

        invoice.items = []
        taxes = {}
        for i in entry_items:
            item = entry_items[i]
            if item["qty"] > 0:
                rate = 0 if item["rate"] is None else item["rate"]
                price_list_rate = 0 if item["price_list_rate"] is None else item["price_list_rate"]

                margin_rate_or_amount = (rate - price_list_rate)
                invoice.append('items', dict(
                    serial_no="" if make else item["identifier"],
                    item_code=item["item_code"],
                    qty=item["qty"],
                    rate=item["rate"],
                    discount_percentage=item["discount_percentage"],

                    item_tax_template=item["item_tax_template"] if "item_tax_template" in item else None,
                    item_tax_rate=item["item_tax_rate"] if "item_tax_rate" in item else None,

                    margin_type="Amount",
                    margin_rate_or_amount=0 if margin_rate_or_amount < 0 else margin_rate_or_amount,
                    # conversion_factor=1,
                ))

                for payment in frappe.get_list("POS Payment Method", {
                    "parenttype": "POS Profile",
                    "parent": self.pos_profile
                }):
                    invoice.append('payments', dict(
                        mode_of_payment=payment.mode_of_payment,
                        amount=0
                    ))

                if "item_tax_rate" in item:
                    if not item["item_tax_rate"] in taxes:
                        taxes[item["item_tax_rate"]] = item["item_tax_rate"]

        if invoice.taxes_and_charges:
            from erpnext.accounts.doctype.sales_invoice.pos import update_tax_table
            update_tax_table(invoice)
        else:
            in_invoice_taxes = [t for t in invoice.get("taxes")]

            import json
            for tax in taxes:
                for t in json.loads(tax):
                    in_invoice_taxes.append(t)

            for t in set(in_invoice_taxes):
                invoice.append('taxes', {
                    "charge_type": "On Net Total", "account_head": t, "rate": 0, "description": t
                })

        invoice.run_method("set_missing_values")
        invoice.run_method("calculate_taxes_and_totals")

        return invoice

    def set_queue_items(self, all_items):
        from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
        check_exceptions(
            dict(name="Table Order", short_name="order", action="write", data=self),
            "You cannot modify an order from another User"
        )

        entry_items = {
            item["identifier"]: item for item in all_items
        }

        invoice = self.get_invoice(entry_items)

        self.entry_items = []
        for item in invoice.items:
            entry_item = entry_items[item.serial_no] if item.serial_no in entry_items else None

            self.append('entry_items', dict(
                item_code=item.item_code,
                qty=item.qty,
                rate=item.rate,
                price_list_rate=item.price_list_rate,
                item_tax_template=item.item_tax_template,
                item_tax_rate=item.item_tax_rate,
                amount=item.amount,
                discount_percentage=item.discount_percentage,
                status="Attending" if entry_item["status"] in ["Pending", "", None] else entry_item["status"],
                identifier=entry_item["identifier"],
                notes=entry_item["notes"]
            ))
            item.serial_no = None

        self.tax = invoice.base_total_taxes_and_charges
        self.discount = invoice.base_discount_amount
        self.amount = invoice.grand_total
        self.save()

        data = self.data()

        frappe.publish_realtime(self.name, dict(
            action="Update",
            data=data["data"],
            items=data["items"]
        ))

        return data, invoice

    @property
    def identifier(self):
        return self.name  # f'{self.table}_{self.name}'

    def data(self):
        return dict(
            data=self.short_data()["data"],
            items=self.items_list()
        )

    def short_data(self):
        return dict(
            data=dict(
                table=self.table,
                customer=self.customer,
                name=self.name,
                status=self.status,
                short_name=self.short_name,
                items_count=self.items_count,
                attending_status=status_attending,
                products_not_ordered=self.products_not_ordered_count,
                tax=self.tax,
                amount=self.amount,
                owner=self.owner
            )
        )

    def items_list(self):
        table = self._table
        items = []
        for item in self.entry_items:
            if item.qty > 0:
                _item = item.as_dict()

                row = {col: _item[col] for col in [
                    "identifier",
                    "qty",
                    "rate",
                    "amount",
                    "discount_percentage",
                    "item_code",
                    "item_name",
                    "notes",
                    "status",
                    "price_list_rate",
                    "item_tax_template",
                    "item_tax_rate"
                ]}

                row["status_color"] = table._status(item.status)["color"]
                row["status_icon"] = table._status(item.status)["icon"]
                row["entry_name"] = item.name

                items.append(row)

        return items

    @property
    def send(self):
        table = self._table
        #status_managed = table._status_managed

        items_to_return = []
        data_to_send = []
        for i in self.entry_items:
            item = frappe.get_doc("Order Entry Item", {"identifier": i.identifier})
            if item.status == status_attending:
                items_to_return.append(i.identifier)

                item.status = "Sent"
                item.save()

                data_to_send.append(table.get_command_data(item))

        if len(data_to_send):
            table.notify_to_check_command(["Sent"], data_to_send)

        self.reload()

        return self.data()

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
                    status=item.status,
                    identifier=item.identifier,
                    notes=item.notes,
                    creation=item.notes,
                ))
        self.save()

    def after_delete(self):
        self._table.send_notifications()

        if frappe.db.count("Table Order", self.name) == 0:
            frappe.publish_realtime(self.name, dict(
                action="Delete",
                order=self.name
            ))
