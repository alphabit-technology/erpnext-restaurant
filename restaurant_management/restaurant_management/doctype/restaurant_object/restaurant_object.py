# -*- coding: utf-8 -*-
# Copyright (c) 2020, CETI Systems and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe import _
from frappe.model.document import Document


class RestaurantObject(Document):
    @property
    def _room(self):
        return frappe.get_doc("Restaurant Object", self.room)

    def on_update(self):
        self._on_update()

    def _on_update(self):
        data = self.get_objects(self.name)

        if len(data) > 0:
            frappe.publish_realtime(self.name, dict(
                action="Update",
                data=data[0]
            ))

    def validate_user(self, user=frappe.session.user):
        if self.current_user is None:
            frappe.db.set_value("Restaurant Object", self.name, "current_user", user)
            return True
        else:
            if self.orders_count == 0:
                frappe.db.set_value("Restaurant Object", self.name, "current_user", user)
                return True

        if self.current_user != user and self.orders_count > 0:
            frappe.throw(_("The table {0} is Assigned to another User").format(self.description))

    def add_order(self, client=None):
        last_user = self.current_user
        self.validate_user()

        from erpnext.stock.get_item_details import get_pos_profile
        # from erpnext.controllers.accounts_controller import get_default_taxes_and_charges

        company = frappe.defaults.get_user_default('company')
        pos_profile = get_pos_profile(company)

        order = frappe.new_doc("Table Order")
        if pos_profile:
            order.pos_profile = None if pos_profile is None else pos_profile.name
            order.customer = frappe.db.get_value('POS Profile', pos_profile.name, 'customer')
            taxes_and_charges = frappe.db.get_value('POS Profile', pos_profile.name, 'taxes_and_charges')
            # if taxes_and_charges is None:
            #    taxes = get_default_taxes_and_charges("Sales Taxes and Charges Template", company=company)
            #    taxes_and_charges = taxes.get("taxes_and_charges")

            order.taxes_and_charges = taxes_and_charges
        else:
            frappe.throw(_("POS Profile is required to use Point-of-Sale"))

        order.selling_price_list = frappe.db.get_value('Price List', dict(enabled=1))
        order.table = self.name
        order.company = company

        order.save()

        self.send_notifications(client, order.name)

        #if last_user != frappe.session.user:
        #    self._on_update()

    def send_notifications(self, client=None, order=None):
        if self.type == "Production Center":
            frappe.publish_realtime(self.name, dict(
                action="Notifications",
                orders_count=self.orders_count_in_production_center
            ))
        else:
            frappe.publish_realtime(self.name, dict(
                action="Notifications",
                orders_count=self.orders_count,
                client=client,
                order=order
            ))

            frappe.publish_realtime(self._room.name, dict(
                action="Notifications",
                orders_count=self._room.orders_count
            ))

    def notify_to_check_command(self, status, data):
        productions_center = []
        orders = []

        status = frappe.get_list("Status Managed Production Center", "parent", filters={
            "parentType": "Restaurant Object",
            "status_managed": ("in", status)
        })

        for item in status:
            table = frappe.get_doc("Restaurant Object", item.parent)
            productions_center.append(table.name)
            table.send_notifications()

        for item in data:
            orders.append(item["order_name"])

        if len(productions_center) > 0:
            frappe.publish_realtime("notify_to_check_command", dict(
                orders=orders,
                productions_center=productions_center,
                commands_food=data
            ))

        if len(orders):
            order = frappe.get_doc("Table Order", orders[0])
            data = order.data()

            frappe.publish_realtime(order.name, dict(
                action="Update",
                data=data["data"],
                items=data["items"]
            ))

    @property
    def orders_count(self):
        if self.type == "Production Center":
            return self.orders_count_in_production_center

        return frappe.db.count("Table Order", {
            "room" if self.type == "Room" else "table": self.name,
            "status": "Attending"
        })

    @property
    def orders_count_in_production_center(self):
        status_managed = self._status_managed
        items_group = self._items_group

        if len(status_managed) > 0 and len(items_group) > 0:
            return frappe.db.count("Order Entry Item", {
                "status": ("in", status_managed),
                "item_group": ("in", items_group),
                "parent": ("!=", "")
            })

        return 0

    def orders_list(self, name=None):
        orders = frappe.get_list("Table Order", fields="name", filters={
            "table" if name is None else "name": name if name is not None else self.name,
            "status": "Attending"
        })
        for order in orders:
            data = frappe.get_doc("Table Order", order.name).short_data()
            for field in data:
                order[field] = data[field]

        return orders

    def get_objects(self, name=None):
        tables = frappe.get_all("Restaurant Object", "name", filters={
            "room" if name is None else "name": self.name if name is None else name,
            "type": ("!=", "Room")
        })

        fields = ["name", "type", "description", "no_of_seats", "identifier", "orders_count", "css_style", "min_size", "current_user"]
        for table in tables:
            t = frappe.get_doc("Restaurant Object", table.name)
            for field in fields:
                table[field] = getattr(t, field)

            if table.type == "Production Center":
                table["status_managed"] = t._status_managed
                table["items_group"] = t._items_group

        return tables

    @property
    def min_size(self):
        return 80

    @property
    def css_style(self):
        return f'{self.style}; background-color:{self.color};'

    @property
    def identifier(self):
        return self.name  # f"{'room' if self.type == 'Room' else 'table'}_{self.name}"

    def add_object(self, t="Table"):
        import random
        objects_count = self.count_objects(t) + 1
        colors = ["#9b59b6", "#3498db", "#95a5a6", "#e74c3c", "#34495e", "#2ecc71"]
        color = colors[random.randint(0, 5)]

        table = frappe.new_doc("Restaurant Object")
        table.type = t
        table.room = self.name
        table.style = f"z-index: {objects_count + 60}; left: {(objects_count * 25 + (0 if table.type == 'Table' else 200))}px; top: {objects_count * 25}px;"
        table.color = color
        table.description = f"{t[:1]}{(objects_count + 1)}"
        table.no_of_seats = 4
        table.save()

        frappe.publish_realtime(
            "order_entry_update", self
        )
        data = self.get_objects(table.name)

        if len(data) > 0:
            frappe.publish_realtime(self.name, dict(
                action="Add",
                table=data[0]
            ))

    def count_objects(self, t):
        return frappe.db.count("Restaurant Object", filters={
            "room": self.name, "type": t
        })

    def set_status_command(self, identifier, status, last_status):
        # status = "Confirm" if status in ["Pending", "", None] else status,

        frappe.db.set_value("Order Entry Item", {"identifier": identifier}, "status", status)
        item = self.commands_food(identifier)

        self.notify_to_check_command([last_status, status], item)

    def command_data(self, command):
        item = self.commands_food(command)
        if len(item) > 0:
            return {
                "data": item[0],
            }
        return None

    def commands_food(self, identifier=None):
        status_managed = self.status_managed

        filters = {
            "status": ("in", [item.status_managed for item in status_managed]),
            "item_group": ("in", self._items_group),
            "parent": ("!=", "")
        } if identifier is None else {
            "identifier": identifier
        }

        items = []
        for entry in frappe.get_all("Order Entry Item", "*", filters=filters, order_by="creation"):
            items.append(self.get_command_data(entry, status_managed))

        return items

    def get_command_data(self, entry, status_managed):
        return dict(
            identifier=entry.identifier,
            item_group=entry.item_group,
            item_code=entry.item_code,
            item_name=entry.item_name,
            order_name=entry.parent,
            qty=entry.qty,
            rate=entry.rate,
            amount=(entry.qty * entry.rate),
            entry_name=entry.name,
            status=entry.status,
            notes=entry.notes,
            creation=frappe.format_value(entry.creation, {"fieldtype": "Datetime"}),
            process_status_data=dict(
                next_action=self.next_action(entry.status, status_managed),
                next_action_message=self._status(entry.status)["action_message"],
                color=self._status(entry.status)["color"],
                icon=self._status(entry.status)["icon"],
                status_message=self._status(entry.status)["message"]
            )
        )

    def next_action(self, status, actions):
        for _status in actions:
            if status == _status.status_managed:
                return _status.next_status

        return "Processing"

    @staticmethod
    def _status(status="Pending"):
        _status = dict(
            Pending=dict(icon="fa fa-cart-arrow-down", color="red", message="Pending", action_message="Add"),
            Attending=dict(icon="fa fa-cart-arrow-down", color="orange", message="Attending", action_message="Sent"),
            Sent=dict(icon="fa fa-paper-plane-o", color="steelblue", message="Whiting", action_message="Confirm"),
            Processing=dict(icon="fa fa-gear", color="#618685", message="Processing", action_message="Complete"),
            Completed=dict(icon="fa fa-check", color="green", message="Completed", action_message="Deliver"),
            Delivering=dict(icon="fa fa-reply", color="#ff7b25", message="Delivering", action_message="Deliver"),
            Delivered=dict(icon="fa fa-cutlery", color="green", message='Delivered', action_message="Invoice"),
            Invoiced=dict(icon="fa fa-money", color="green", message="Invoiced", action_message="Invoiced"),
        )
        return _status[status] if status in _status else _status["Pending"]

    @property
    def _status_managed(self):
        return [item.status_managed for item in self.status_managed]

    @property
    def _items_group(self):
        items_groups = []
        for group in self.production_center_group:
            lft, rgt = frappe.db.get_value('Item Group', group.item_group, ['lft', 'rgt'])

            for item in frappe.get_list("Item Group", "name", filters={
                "lft": (">=", lft),
                "rgt": ("<=", rgt)
            }):
                items_groups.append(item.name)

        return items_groups

    def save_position(self, style):
        frappe.db.set_value("Restaurant Object", self.name, "style", style)
        self._on_update()

    @property
    def _delete(self):
        name = self.name
        self.delete()

        if frappe.db.count("Restaurant Object", filters={"name": name}) == 0:
            frappe.publish_realtime(name, dict(
                action="Delete"
            ))
            return True
        else:
            return False


@frappe.whitelist()
def test(doc, method=None):
    frappe.throw(doc.name)
