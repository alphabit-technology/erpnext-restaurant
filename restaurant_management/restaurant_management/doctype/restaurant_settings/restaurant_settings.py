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
        profile = frappe.db.get_value("User", frappe.session.user, "role_profile_name")
        #restaurant_settings = frappe.get_single("Restaurant Settings")
        tax_template = frappe.db.get_value("Sales Taxes and Charges Template", {"company": self.company()})

        return dict(
            pos=self.pos_profile_data(),
            permissions=dict(
                invoice=frappe.permissions.get_doc_permissions(frappe.new_doc("Sales Invoice")),
                order=frappe.permissions.get_doc_permissions(frappe.new_doc("Table Order")),
                restaurant_object=frappe.permissions.get_doc_permissions(frappe.new_doc("Restaurant Object")),
                rooms_access=self.restaurant_access()
            ),
            restrictions=self,
            exceptions=[item for item in self.restaurant_exceptions if item.role_profile == profile],
            lang=frappe.session.data.lang,
            order_item_editor_form=self.get_order_item_editor_form(),
            tax_template=frappe.get_doc("Sales Taxes and Charges Template", tax_template) if tax_template else {},
            crm_settings=self.get_crm_settings(),
            allows_to_edit_item=frappe.get_list("Status Order PC", "name", filters=dict(allows_to_edit_item=1)),
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
        pos_profile = get_pos_profile(frappe.defaults.get_user_default('company'))
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

            restaurant_permissions = frappe.db.get_list("Restaurant Permission", 
                "object_name",
                filters=permissions_filter
            ) if permission_parent else []
  
            if type == 'Room':
                restaurant_permissions = frappe.get_list("Restaurant Object", 
                    ("room","name","type"),
                    filters=dict(
                        name=("in",[item.object_name for item in restaurant_permissions])
                    )
                )

                rooms_for_table = (item.room for item in restaurant_permissions if item.type != "Room")
                rooms_for_room = (item.name for item in restaurant_permissions if item.type == "Room")

                return set(rooms_for_table).union(set(rooms_for_room))

            return set((item.object_name for item in restaurant_permissions))

        return []


@frappe.whitelist()
def reinstall():
    return install.after_install()
