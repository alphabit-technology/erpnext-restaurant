# -*- coding: utf-8 -*-
# Copyright (c) 2021, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
from datetime import date
import frappe
from frappe import _
from frappe.model.document import Document


class RestaurantObject(Document):
    @property
    def _room(self):
        return frappe.get_doc("Restaurant Object", self.room)

    def after_delete(self):
        frappe.publish_realtime(self.name, dict(
            action="Delete"
        ))

    def on_update(self):
        self._on_update()

    def _on_update(self):
        frappe.publish_realtime(self.name, dict(
            action="Update",
            data=self.get_data() if self.type == "Room" else self.get_objects(self.name)[0]
        ))

        self.synchronize()

    def synchronize(self):
        if self.type == "Production Center":
            frappe.publish_realtime(self.name, dict(
                action="Notifications",
                orders_count=self.orders_count_in_production_center,
                current_user=self.current_user
            ))
        else:
            frappe.publish_realtime(self.name, dict(
                action="Notifications",
                orders_count=self.orders_count,
                current_user=self.current_user
            ))

            if self.type != "Room":
                frappe.publish_realtime(self._room.name, dict(
                    action="Notifications",
                    orders_count=self._room.orders_count,
                    current_user=self.current_user
                ))
                
    def validate_transaction(self, user=frappe.session.user):
        if self.current_user is None or self.current_user == "Administrator" or self.orders_count == 0:
            frappe.db.set_value("Restaurant Object", self.name, "current_user", user)
            frappe.db.commit()
            self.reload()
            return True

        if self.current_user != user and self.orders_count > 0:
            from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
            if not check_exceptions(
                    dict(name="Restaurant Object", short_name="table", action="read", data=self),
                    _("The table {0} is Assigned to another User").format(self.description)
            ):
                frappe.throw(_("The table {0} is Assigned to another User").format(self.description))

    def validate_table(self):
        restaurant_settings = frappe.get_single("Restaurant Settings")
        if not restaurant_settings.multiple_pending_order and self.orders_count > 0:
            frappe.throw(_("Complete pending orders"))

    def add_order(self, client=None):
        # last_user = self.current_user
        self.validate_transaction()

        self.validate_table()

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

        order.selling_price_list = frappe.db.get_value('Price List', dict(enabled="1"))
        order.table = self.name
        order.company = company

        order.save()
        order.synchronize(dict(action="Add", client=client))

        # if last_user != frappe.session.user:
        #    self._on_update()

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
                "parent": ("!=", ""),
                "qty": (">", "0")
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

        for table in tables:
            data = frappe.get_doc("Restaurant Object", table.name).get_data()
            for prop in data:
                table[prop] = data[prop]

        return tables

    def get_data(self):
        fields = ["name", "description", "orders_count"] if self.type == "Room" \
            else ["name", "type", "description", "no_of_seats", "identifier", "orders_count",
                  "data_style", "min_size", "current_user", "color", 'shape']
        data = {}

        for field in fields:
            data[field] = getattr(self, field)

        if self.type == "Production Center":
            data["status_managed"] = self._status_managed
            data["items_group"] = self._items_group

        return data

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

        objects_count = frappe.db.count("Restaurant Object", filters={"room": self.name})
        table = frappe.new_doc("Restaurant Object")

        zIndex = objects_count + 60
        left = objects_count * 25 + (0 if t == 'Table' else 200)
        top = objects_count * 25
        colors = ["#5b1e34", "#97264f", "#1a4469", "#1579d0", "#2d401d", "#2e844e", "#505a62"]
        color = colors[random.randint(0, 6)]

        data_style = f'"x":"{left}","y":"{top}","z-index":"{zIndex}","width":"100px","height":"100px"'
        table.type = t
        table.room = self.name
        table.data_style = "{" + data_style + "}"
        table.color = color
        table.description = f"{t[:1]}{(objects_count + 1)}"
        table.no_of_seats = 4
        table.shape = 'Square'
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

    def set_status_command(self, identifier):
        last_status = frappe.db.get_value("Order Entry Item", {"identifier": identifier}, "status")
        status = self.next_status(last_status)

        frappe.db.set_value("Order Entry Item", {"identifier": identifier}, "status", status)
        self.reload()
        item = self.commands_food(identifier, last_status)
        order = frappe.get_doc("Table Order", item[0]["order_name"])

        order.synchronize(dict(items=item, status=[last_status, status]))

    def command_data(self, command):
        item = self.commands_food(command)
        return {"data": item[0]} if len(item) > 0 else None

    def commands_food(self, identifier=None, last_status=None):
        status_managed = self.status_managed

        filters = {
            "status": ("in", [item.status_managed for item in status_managed]),
            "item_group": ("in", self._items_group),
            "parent": ("!=", ""),
            "qty": (">", "0")
        } if identifier is None else {
            "identifier": identifier
        }

        items = []
        for entry in frappe.get_all("Order Entry Item", "*", filters=filters, order_by="ordered_time"):
            items.append(self.get_command_data(entry, last_status))

        return items

    def get_command_data(self, entry, las_status=None):
        return dict(
            identifier=entry.identifier,
            item_group=entry.item_group,
            item_code=entry.item_code,
            item_name=entry.item_name,
            order_name=entry.parent,
            table_description=entry.table_description,
            short_name=self.order_short_name(entry.parent),
            qty=entry.qty,
            rate=entry.rate,
            amount=(entry.qty * entry.rate),
            entry_name=entry.name,
            status=entry.status,
            last_status=las_status,
            notes=entry.notes,
            ordered_time=entry.ordered_time or frappe.utils.now_datetime(),#frappe.format_value(entry.creation, {"fieldtype": "Datetime"}),
            process_status_data=self.process_status_data(entry)
        )

    def process_status_data(self, item):
        return dict(
            next_action_message=self._status(item.status)["action_message"],
            color=self._status(item.status)["color"],
            icon=self._status(item.status)["icon"],
            status_message=self._status(item.status)["message"]
        )

    @staticmethod
    def order_short_name(order_name):
        return order_name[8:]

    def next_status(self, last_status):
        status_managed = self.status_managed
        for status in status_managed:
            if last_status == status.status_managed:
                return status.next_status

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

    @staticmethod
    def status_list():
        return ["Pending"]

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

    def set_style(self, data, shape=None):
        _data = data
        if shape and self.type == "Production Center":
            _data = "Square"

        frappe.db.set_value("Restaurant Object", self.name, "shape" if shape else 'data_style', _data)
        self._on_update()

    @property
    def _delete(self):
        self.delete()


def load_json(data):
    import json
    try:
        _data = json.loads("{}" if data is None else data)
    except ValueError as e:
        _data = []

    return _data
