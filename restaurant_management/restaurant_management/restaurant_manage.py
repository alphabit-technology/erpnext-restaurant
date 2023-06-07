from __future__ import unicode_literals
import frappe
from frappe import _


def check_exceptions(model, error_message):
    if frappe.session.user == "Administrator":
        return True

    if frappe.has_permission(model["name"], model["action"]):
        has_permission = True

        if model["data"].owner != frappe.session.user or model["short_name"] == "table":
            has_permission = False

            exceptions = frappe.get_single("Restaurant Settings")
            profile = frappe.db.get_value("User", frappe.session.user, "role_profile_name")

            permissions = frappe.db.get_all("Restaurant Exceptions", fields=(
                "order_write", "order_delete", "order_manage"
            ), filters={
                "role_profile": profile
            })

            if model["short_name"] == "order" and not exceptions.restricted_to_owner_order:
                has_permission = True

            if model["short_name"] == "table" and not exceptions.restricted_to_owner_table:
                has_permission = True

            for permission in permissions:
                if model["short_name"] == "order" and exceptions.restricted_to_owner_order:
                    has_permission = permission[f'{model["short_name"]}_{model["action"]}']

                if model["short_name"] == "table" and exceptions.restricted_to_owner_table:
                    has_permission = permission[f'{model["short_name"]}_{model["action"]}']

        if not has_permission:
            frappe.throw(_(error_message))
    else:
        frappe.throw(_("You do not have permissions to update " + model["short_name"]))

    return True
