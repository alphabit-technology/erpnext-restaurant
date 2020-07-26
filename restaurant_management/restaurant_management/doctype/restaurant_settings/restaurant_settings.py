# -*- coding: utf-8 -*-
# Copyright (c) 2020, CETI Systems and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from restaurant_management.setup import install


class RestaurantSettings(Document):
    pass


@frappe.whitelist()
def reinstall():
    install.after_install()