# -*- coding: utf-8 -*-
# Copyright (c) 2021, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from restaurant_management.setup import install
from erpnext.stock.get_item_details import get_pos_profile


class RestaurantSettings(Document):
    def on_update(self):
        frappe.publish_realtime("update_settings")

    def settings_data(self):
        profile = frappe.db.get_value("User", frappe.session.user, "role_profile_name")
        restaurant_settings = frappe.get_single("Restaurant Settings")

        return dict(
            pos=self.pos_profile_data(),
            permissions=dict(
                invoice=frappe.permissions.get_doc_permissions(frappe.new_doc("Sales Invoice")),
                order=frappe.permissions.get_doc_permissions(frappe.new_doc("Table Order")),
                restaurant_object=frappe.permissions.get_doc_permissions(frappe.new_doc("Restaurant Object")),
                rooms_access=self.rooms_access()
            ),
            restrictions=restaurant_settings,
            exceptions=[item for item in restaurant_settings.restaurant_exceptions  if item.role_profile == profile],
            lang=frappe.session.data.lang,
            order_item_editor_form=self.get_order_item_editor_form(),
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
        pos_profile = get_pos_profile(frappe.defaults.get_user_default('company'))
        return pos_profile.name if pos_profile else None

    def rooms_access(self):
        pos_profile_name = self.get_current_pos_profile_name()

        if pos_profile_name is not None:
            permission_parent = frappe.db.get_value(
                "POS Profile User",
                filters={"parenttype": "POS Profile",
                         "parent": pos_profile_name, "user": frappe.session.user},
                fieldname="name"
            )

            restaurant_permissions = frappe.db.get_all("Restaurant Permission", fields=("room"),
                                                        filters={
                    "parenttype": "Restaurant Permission Manage",
                    "parent": permission_parent,
                }
            ) if permission_parent else []

            return (item.room for item in restaurant_permissions)

        return []


@frappe.whitelist()
def reinstall():
    return install.after_install()
