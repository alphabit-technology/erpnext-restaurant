# -*- coding: utf-8 -*-
# Copyright (c) 2021, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from restaurant_management.setup import install
from erpnext.stock.get_item_details import get_pos_profile


class RestaurantSettings(Document):
    def company(self):
        return frappe.defaults.get_user_default('company')

    def on_update(self):
        frappe.publish_realtime("update_settings")

    def user_has_admin_role(self):
        user = frappe.session.user

        if user == "Administrator":
            return (True)

        roles = frappe.get_roles(user)
        admin_roles = ["System Manager", "Restaurant Manager"]

        a_set = set(admin_roles)
        b_set = set(roles)

        if len(a_set.intersection(b_set)) > 0:
            return (True)

        return (False)

    def settings_data(self):
        company = self.company()
        profile = frappe.db.get_value(
            "User", frappe.session.user, "role_profile_name")
        #restaurant_settings = frappe.get_single("Restaurant Settings")
        tax_template = frappe.db.get_value("Sales Taxes and Charges Template", {
                                           "company": company})
        pos = self.pos_profile_data()

        if pos.get("has_pos"):
          menu = frappe.db.get_value("Restaurant Menu", pos.get("pos").restaurant_menu, "name")
          menu_items = frappe.get_all("Restaurant Menu Item", filters=dict(
              parent=menu), fields=["item"]
          )
          groups_of_items = frappe.get_all("Item", "item_group", filters=dict(
              item_code=("in", [item.item for item in menu_items]))
          )

          parent_item_groups = frappe.get_all("Item Group", "parent_item_group",
            filters=dict(name=("in", [item.item_group for item in groups_of_items]))
          )

          items_groups = [item.item_group for item in groups_of_items] + [item.parent_item_group for item in parent_item_groups]
        else :
          menu = None
          menu_items = []
          items_groups = []

        return dict(
            pos=pos,
            permissions=dict(
                invoice=frappe.permissions.get_doc_permissions(
                    frappe.new_doc("Sales Invoice")),
                order=frappe.permissions.get_doc_permissions(
                    frappe.new_doc("Table Order")),
                restaurant_object=frappe.permissions.get_doc_permissions(
                    frappe.new_doc("Restaurant Object")),
                rooms_access=self.restaurant_access()
            ),
            restrictions=self,
            exceptions=[
                item for item in self.restaurant_exceptions if item.role_profile == profile],
            lang=frappe.session.data.lang,
            order_item_editor_form=self.get_order_item_editor_form(),
            tax_template=frappe.get_doc(
                "Sales Taxes and Charges Template", tax_template) if tax_template else {},
            crm_settings=self.get_crm_settings(),
            allows_to_edit_item=frappe.get_all(
                "Status Order PC", "name", filters=dict(allows_to_edit_item=1)),
            menu=menu,
            menu_items=menu_items,
            items_groups=items_groups,
        )

    def get_crm_settings(self):
        return dict(
            crm_room=self.restaurant_access("Room", dict(is_crm=1)),
            crm_table=self.restaurant_access("Table", dict(is_crm=1)),
        )

    def pos_profile_data(self):
        pos_profile_name = self.get_current_pos_profile_name()

        return dict(
            has_pos=pos_profile_name is not None,
            pos=frappe.get_doc(
                "POS Profile", pos_profile_name) if pos_profile_name is not None else None
        )
    def get_order_item_editor_form(self):
        return frappe.get_doc("Desk Form", "order-item-editor")

    def get_current_pos_profile_name(self):
        #return self.pos_profile
        pos_profile = get_pos_profile(
            frappe.defaults.get_user_default('company'))
        return pos_profile.name if pos_profile else None

    def has_access_to_room(self, room):
        return len(self.restaurant_access("Room", dict(object_name=room))) > 0

    def restaurant_access(self, type="Room", more_filters=None):
        pos_profile_name = self.get_current_pos_profile_name()

        if pos_profile_name is not None:
            permission_parent = frappe.db.get_value("POS Profile User",
                                                    filters=dict(
                                                        parenttype="POS Profile",
                                                        parent=pos_profile_name,
                                                        user=frappe.session.user
                                                    ),
                                                    fieldname="name"
                                                    )

            permissions_filter = dict(
                parenttype="Restaurant Permission Manage",
                parent=permission_parent,
            )

            if more_filters is not None:
                permissions_filter.update(more_filters)

            restaurant_permissions = frappe.db.get_all("Restaurant Permission",
                                                        "object_name",
                                                        filters=permissions_filter
                                                        ) if permission_parent else []

            if type == 'Room':
                restaurant_permissions = frappe.get_all("Restaurant Object",
                                                         ("room", "name", "type"),
                                                         filters=dict(
                                                             name=(
                                                                 "in", [item.object_name for item in restaurant_permissions])
                                                         )
                                                         )

                rooms_for_table = (
                    item.room for item in restaurant_permissions if item.type != "Room")
                rooms_for_room = (
                    item.name for item in restaurant_permissions if item.type == "Room")

                return set(rooms_for_table).union(set(rooms_for_room))

            return set((item.object_name for item in restaurant_permissions))

        return []


@frappe.whitelist()
def reinstall():
    return install.after_install()
