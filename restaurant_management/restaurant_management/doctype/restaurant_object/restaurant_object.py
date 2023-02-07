# -*- coding: utf-8 -*-
# Copyright (c) 2021, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
from datetime import date
import frappe
from frappe import _
import random
from frappe.model.document import Document
import random
import string
from frappe.utils import get_datetime
from datetime import timedelta


class RestaurantObject(Document):
    @property
    def _room(self):
        return frappe.get_doc("Restaurant Object", self.room)

    def before_save(self):
        if self.is_new() or (self.type == "Room" and self.company is None):
            self.company = frappe.defaults.get_user_default('company')

    def after_delete(self):
        frappe.publish_realtime(self.name, dict(
            action="Delete"
        ))

    def on_update(self):
        if self.customer:
            current_reservation = self.current_reservation("customer")
            
            if current_reservation and current_reservation != self.customer and self.type == "Table" and self.orders_count > 0:
                frappe.throw(_("You can't set {0} because there is an active reservation for {1}").format(self.customer, current_reservation))

            frappe.msgprint(_("The table {0} is assigned to {1}").format(
                self.description, self.customer), indicator='green', alert=True)

        self._on_update()

    def _on_update(self):
        data = self.get_data() if self.type == "Room" else self.get_objects(self.name)
        frappe.publish_realtime(self.name, dict(
            action="Update",
            data=data if self.type == "Room" else data["tables"][0] if len(
                data["tables"]) > 0 else None
            )
        )

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

    def can_access(self):
        settings = frappe.get_single("Restaurant Settings")

        if settings.user_has_admin_role() or self.name in settings.restaurant_access(self.type):
            return True

        return False

    def validate_transaction(self, user=frappe.session.user, from_crm=None):
        if not self.can_access():
            frappe.throw(_("You don't have access to this table"))

        orders_count = self.orders_count
        if self.current_user is None or self.current_user == "Administrator" or orders_count == 0:
            frappe.db.set_value("Restaurant Object",
                                self.name, "current_user", user)
            frappe.db.commit()
            self.reload()
            return True

        if self.current_user != user and orders_count > 0:
            from restaurant_management.restaurant_management.restaurant_manage import check_exceptions
            if not check_exceptions(
                    dict(name="Restaurant Object", short_name="table",
                         action="read", data=self),
                    _("The table {0} is Assigned to another User").format(
                        self.description)
            ):
                frappe.throw(
                    _("The table {0} is Assigned to another User").format(self.description))

    def validate_table(self, from_crm=None):
        restaurant_settings = frappe.get_single("Restaurant Settings")
        if from_crm is None and not restaurant_settings.multiple_pending_order and self.orders_count > 0:
            frappe.throw(_("Complete pending orders"))

    def add_order(self, client=None, from_crm=None):
        # last_user = self.current_user
        self.validate_transaction(frappe.session.user, from_crm)

        if self.customer is None:
            frappe.throw(_("You must set a customer to this table"))

        self.validate_table(from_crm)

        from erpnext.stock.get_item_details import get_pos_profile
        # from erpnext.controllers.accounts_controller import get_default_taxes_and_charges

        company = frappe.defaults.get_user_default('company')
        pos_profile = get_pos_profile(company)

        order = frappe.new_doc("Table Order")
        order.customer = self.customer
        if pos_profile:
            order.pos_profile = None if pos_profile is None else pos_profile.name
            order.customer = frappe.db.get_value(
                'POS Profile', pos_profile.name, 'customer')
            taxes_and_charges = frappe.db.get_value(
                'POS Profile', pos_profile.name, 'taxes_and_charges')
            # if taxes_and_charges is None:
            #    taxes = get_default_taxes_and_charges("Sales Taxes and Charges Template", company=company)
            #    taxes_and_charges = taxes.get("taxes_and_charges")

            order.taxes_and_charges = taxes_and_charges
        else:
            frappe.throw(_("POS Profile is required to use Point-of-Sale"))

        order.selling_price_list = frappe.db.get_value(
            'Price List', dict(enabled="1"))
        order.table = self.name
        # order.company = company
        order.customer = from_crm
        if from_crm is not None:
            order.is_delivery = 1

        order.save()
        order.synchronize(dict(action="Add", client=client))
        return order

        # if last_user != frappe.session.user:
        #    self._on_update()

    def get_objects(self, name=None):
        settings = frappe.get_single("Restaurant Settings")

        filters = {
            "company": frappe.defaults.get_user_default('company'),
            "type": ("!=", "Room")
        }

        if name is None:
            filters["room"] = self.name

            if not settings.user_has_admin_role() and not settings.has_access_to_room(self.name):
                filters["name"] = ("in", settings.restaurant_access("Table"))
        else:
            filters["name"] = name

        tables = frappe.get_all("Restaurant Object", "name", filters=filters)

        for table in tables:
            data = frappe.get_doc("Restaurant Object", table.name).get_data()
            for prop in data:
                table[prop] = data[prop]

        return dict(tables=tables, orders_count=self.orders_count)

    @property
    def orders_count(self):
        if self.type == "Production Center":
            return self.orders_count_in_production_center

        filters = {
            "company": self.company,
            "show_in_pos": 1,
            "status": ["not in", ["Cancelled", "Invoiced", "Opened"]],
        }

        if self.type == "Room":
            settings = frappe.get_single("Restaurant Settings")
            filters["room"] = self.name

            if not settings.user_has_admin_role() and not settings.has_access_to_room(self.name):
                filters["table"] = ("in", settings.restaurant_access("Table"))
        else:
            filters["table"] = self.name

        return frappe.db.count("Table Order", filters)

    @property
    def orders_count_in_production_center(self):
        filters = self.get_command_filters()
        if self.group_items_by_order == 1:
            return len(frappe.db.get_all(
                "Order Entry Item",
                fields="name",
                filters=filters,
                group_by="parent"
            ))
        else:
            return frappe.db.count("Order Entry Item", filters)

    def orders_list(self, name=None, customer=None):
        if customer is not None and frappe.db.count("Table Order", {
            "table": self.name,
            "customer": customer,
            "show_in_pos": 1,
            "status": ("not in", ["Cancelled", "Invoiced"])
        }) == 0:
            self.add_order(None, customer)
            self.reload()

        orders = frappe.get_list("Table Order", fields=["name", "customer"], filters={
            "table" if name is None else "name": name if name is not None else self.name,
            "show_in_pos": 1,
            "status": ("not in", ["Cancelled", "Invoiced"])
        })

        current_order = None

        for order in orders:
            data = frappe.get_doc("Table Order", order.name).short_data()
            current_order = order.name if customer is not None and order.customer == customer else current_order

            for field in data:
                order[field] = data[field]

        return dict(
            orders=orders,
            order=current_order
        )

    def get_data(self):
        if self.type == "Room":
            fields = "name,description,orders_count"
        else:
            fields = "name,type,description,no_of_seats,identifier,orders_count,data_style,group_items_by_order,min_size,current_user,color,shape,restricted_to_rooms,restricted_to_tables,restricted_to_branches,customer"
        
        data = {}

        for field in fields.split(","):
            data[field] = getattr(self, field)

        if self.type == "Production Center":
            data["status_managed"] = self._status_managed
            data["items_group"] = self._items_group
            data["restricted_rooms"] = self.restricted_rooms
            data["restricted_tables"] = self.restricted_tables
            data["restricted_branches"] = self.restricted_branches
        else:
            data["status"] = self.status

        return data

    @ property
    def min_size(self):
        return 80

    @ property
    def css_style(self):
        return f'{self.style}; background-color:{self.color};'

    @ property
    def identifier(self):
        # f"{'room' if self.type == 'Room' else 'table'}_{self.name}"
        return self.name

    def add_object(self, t="Table"):
        import random

        objects_count = frappe.db.count(
            "Restaurant Object", filters={"room": self.name})

        table = frappe.new_doc("Restaurant Object")

        zIndex = objects_count + 60
        left = objects_count * 25 + (0 if t == 'Table' else 200)
        top = objects_count * 25
        colors = ["#5b1e34", "#97264f", "#1a4469",
                  "#1579d0", "#2d401d", "#2e844e", "#505a62"]
        color = colors[random.randint(0, 6)]

        name = f"{t[:1]}-{random.randint(random.randint(1, 100), random.randint(100, 1000))}"

        data_style = f'"x":"{left}","y":"{top}","z-index":"{zIndex}","width":"150px","height":"100px"'
        table.type = t
        table.room = self.name
        table.data_style = "{" + data_style + "}"
        table.color = color
        #table.name = name
        table.description = name
        table.no_of_seats = 4
        table.shape = 'Square'
        table.save()

        frappe.publish_realtime(
            "order_entry_update", self
        )

        data = self.get_objects(table.name)

        if len(data["tables"]) > 0:
            frappe.publish_realtime(self.name, dict(
                action="Add",
                table=data["tables"][0]
            ))

    def count_objects(self, t):
        return frappe.db.count("Restaurant Object", filters={
            "room": self.name, "type": t
        })

    def set_status_command(self, identifier):
        if self.group_items_by_order == 1:
            last_status = frappe.db.get_value(
                "Table Order", {"name": identifier}, "status")
        else:
            last_status = frappe.db.get_value(
                "Order Entry Item", {"identifier": identifier}, "status")

        status = self.next_status(last_status)

        order = frappe.get_doc("Table Order", identifier if self.group_items_by_order else frappe.db.get_value(
            "Order Entry Item", {"identifier": identifier}, "parent"))

        if order.show_in_pos == 1:
            order.status = status

        if self.group_items_by_order == 1:
            frappe.db.set_value("Table Order", {
                "name": identifier}, "status", status)
        else:
            frappe.db.set_value("Order Entry Item", {
                "identifier": identifier}, "status", status)

        order.reload()
        items = None
        if self.group_items_by_order != 1:
            items = self.commands_food(identifier, last_status)

        order.synchronize(dict(items=items, status=[last_status, status]))

    def command_data(self, command):
        item = self.commands_food(command)
        return {"data": item[0]} if len(item) > 0 else None

    def get_command_filters(self, identifier=None):
        random_string = ''.join(random.choice(
            string.ascii_uppercase + string.digits) for _ in range(100))

        if identifier is None:
            status_managed = self._status_managed
            items_group = self._items_group

            filters = {
                "parenttype": "Table Order",
                "item_group": ("in", items_group if len(items_group) > 0 else [random_string]),
                "qty": (">", "0")
            }

            parent_filter = {
                "company": self.company,
            }

            if self.group_items_by_order == 1:
                parent_filter["status"] = ("in", status_managed if len(
                    status_managed) > 0 else [random_string])
            else:
                filters["status"] = ("in", status_managed if len(
                    status_managed) > 0 else [""])
            ###
            #   @property type: tope: Room, Table
            #   @property parent: Type = Room //For restricted to Parent Room
            ###
            def make_filter(type, parent=None):
                if parent is not None:
                    parent_filter[type.lower()] = parent
                else:
                    restricted_filters = dict(
                        parenttype="Restaurant Object",
                        parent=self.name,
                        type=type
                    )

                    restricted = frappe.get_all(
                        "Order Origin", filters=restricted_filters, pluck="origin")

                    parent_filter[type.lower()] = (
                        "in", restricted if len(restricted) > 0 else [random_string])

            if self.restricted_to_branches == 1:
                branches = [item.branch for item in self.restricted_branches]
                parent_filter["branch"] = ("in", branches if len(
                    branches) > 0 else [random_string])

            if self.restricted_to_parent_room == 1:
                make_filter("Room", self.room)
            else:
                if self.restricted_to_rooms == 1:
                    make_filter("Room")
                elif self.restricted_to_tables == 1:
                    make_filter("Table")

            orders = frappe.get_all("Table Order", parent_filter, pluck="name")

            filters["parent"] = ("in", orders if len(
                orders) > 0 else [random_string])

            return filters
        else:
            return {
                "identifier": identifier
            }

    def commands_food(self, identifier=None, last_status=None):
        filters = self.get_command_filters(identifier)

        items = []
        groups = {}

        for entry in frappe.get_all("Order Entry Item", "*", filters=filters, order_by="ordered_time"):
            items.append(self.get_command_data(entry, last_status))

        for item in items:
            if item["order_name"] not in groups:
                groups[item["order_name"]] = dict(items=[])

            groups[item["order_name"]]["items"].append(item)

            if self.group_items_by_order != 1:
                groups[item["order_name"]].update(dict(data=item))

        if self.group_items_by_order == 1:
            for group in groups:
                order = frappe.get_doc("Table Order", group)
                groups[group].update(dict(data=order.short_data()["data"]))

        return groups

    def get_command_data(self, entry, las_status=None, key_name="identifier"):
        short_name = self.order_short_name(entry.parent)
        return dict(
            identifier=entry.identifier,
            item_group=entry.item_group,
            item_code=entry.item_code,
            item_name=entry.item_name,
            order_name=entry.identifier if self.group_items_by_order != 1 else entry.parent,
            order=short_name,
            room=entry.room,
            branch=entry.branch,
            table=entry.table,
            table_description=entry.table_description if entry.table_description is not None else entry.table,
            room_description=entry.room_description if entry.room_description is not None else entry.room,
            short_name=short_name,
            qty=entry.qty,
            rate=entry.rate,
            amount=(entry.qty * entry.rate),
            entry_name=entry.name,
            name=entry.identifier,
            status=entry.status,
            last_status=las_status,
            notes=entry.notes,
            # frappe.format_value(entry.creation, {"fieldtype": "Datetime"}),
            ordered_time=entry.ordered_time or frappe.utils.now_datetime(),
            process_status_data=self.process_status_data(entry)
        )

    def process_status_data(self, item):
        return dict(
            next_action_message=self._status(item.status).action_message,
            color=self._status(item.status).color,
            icon=self._status(item.status).icon,
            status_message=self._status(item.status).message
        )

    @ staticmethod
    def order_short_name(order_name):
        return order_name[8:]

    def next_status(self, last_status):
        status_managed = self.status_managed
        for status in status_managed:
            if last_status == status.status_managed:
                return status.next_status

        frappe.throw(_("Invalid action, the process is complete"))

    @ staticmethod
    def _status(status="Pending"):
        return frappe.get_doc("Status Order PC", status)

    @ staticmethod
    def status_list():
        return ["Pending"]

    @ property
    def _status_managed(self):
        return [item.status_managed for item in self.status_managed]

    @ property
    def _items_group(self):
        items_groups = []
        for group in self.production_center_group:
            lft, rgt = frappe.db.get_value(
                'Item Group', group.item_group, ['lft', 'rgt'])

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

        frappe.db.set_value("Restaurant Object", self.name,
                            "shape" if shape else 'data_style', _data)
        self._on_update()

    @ property
    def _delete(self):
        self.delete()

    def is_enabled_to_reservation(self, reservation=None):
        if reservation is not None:
            reservations = frappe.db.count("Restaurant Booking", filters=dict(
                table=self.name,
                status=("in", ("Open", "Waitlisted")),
                reservation_end_time=(">", get_datetime(get_datetime(reservation.reservation_time) - timedelta(minutes=30))),
                reservation_time=("<", get_datetime(get_datetime(
                    reservation.reservation_end_time) + timedelta(minutes=30))),
                name=("!=", reservation.name)
            )) == 0

            if reservations == 0:
                return True

            orders = frappe.get_list("Table Order", fields=["customer","creation"], filters={
                "table": self.name,
                "show_in_pos": 1,
                "status": ("not in", ["Cancelled", "Invoiced"])
            })

            if self.orders_count > 0:
                if len(orders) > 0:
                    orders = sorted(orders, key=lambda x: x["creation"])
                    last_order = orders[-1]

                    if last_order:
                        order_creation = get_datetime(last_order.creation)
                        reservation_time = get_datetime(get_datetime(reservation.reservation_time) - timedelta(minutes=30))
                        reservation_end_time = get_datetime(get_datetime(reservation.reservation_end_time) + timedelta(minutes=30))

                        if order_creation > reservation_time and order_creation < reservation_end_time:
                            frappe.throw(_("You can't set {0} in table {1} because there is an active order for {2} for reservation time").format(reservation.customer, self.description, last_order.customer))
            return True
        else:
            return frappe.db.count("Restaurant Booking", filters=dict(
                table=self.name,
                status=("in", ("Open", "Waitlisted")),
                reservation_time=(">", get_datetime(get_datetime() - timedelta(minutes=30)))
            )) == 0
    
    def current_reservation(self, field):        
        return frappe.db.get_value("Restaurant Booking", dict(
            table=self.name,
            status=("in", ("Open", "Waitlisted")),
            reservation_time=("<=", get_datetime(get_datetime() + timedelta(minutes=30))),
            reservation_end_time=(">=", get_datetime(get_datetime() - timedelta(minutes=30)))
        ), field or "name")

    @ property
    def status(self):
        return "Available" if self.is_enabled_to_reservation() else "Reserved"

def load_json(data):
    import json
    try:
        _data = json.loads("{}" if data is None else data)
    except ValueError as e:
        _data = []

    return _data
