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
            ),
            restrictions=restaurant_settings,
            exceptions=[item for item in restaurant_settings.restaurant_permissions if item.role_profile == profile],
            lang=frappe.session.data.lang
        )

    @staticmethod
    def pos_profile_data():
        pos_profile = get_pos_profile(frappe.defaults.get_user_default('company'))

        return dict(
            has_pos=pos_profile is not None,
            pos=None if pos_profile is None else frappe.get_doc("POS Profile", pos_profile.name)
        )


@frappe.whitelist()
def reinstall():
    install.after_install()
