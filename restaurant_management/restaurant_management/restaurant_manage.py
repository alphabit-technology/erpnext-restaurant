from __future__ import unicode_literals
import frappe, json
from frappe import _


def check_exceptions(model, action, data, error_message):
    profile = frappe.db.get_value("User", frappe.session.user, "role_profile_name")
    restaurant_settings = frappe.get_single("Restaurant Settings")

    for item in restaurant_settings.restaurant_permissions:
        if item.role_profile == profile:
            if model == "Order":
                if action == "update":
                    if data.owner != frappe.session.user:
                        if item.update_order == 0:
                            frappe.throw(_(error_message))
    return True

