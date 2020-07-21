from __future__ import unicode_literals
import frappe, json


@frappe.whitelist(allow_guest=True)
def restaurant():
    return {"test": "test"}