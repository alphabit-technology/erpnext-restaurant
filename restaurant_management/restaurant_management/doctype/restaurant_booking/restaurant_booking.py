# -*- coding: utf-8 -*-
# Copyright (c) 2022, Quantum Bit Core and contributors
# For license information, please see license.txt

from __future__ import unicode_literals
import frappe
from frappe.model.document import Document
from datetime import timedelta
from frappe.utils import cint, flt, get_datetime, datetime, date_diff, today

class RestaurantBooking(Document):
	def set_reservation_end_time(self):
		if not self.reservation_end_time:
			self.reservation_end_time = get_datetime(
				self.reservation_time) + timedelta(hours=1)

	def validate(self):
		self.set_reservation_end_time()

		reservation_time = self.reservation_time or today()
		day_dif = date_diff(reservation_time, today())

		frappe.publish_realtime("debug", dict(testdays=day_dif))

		self.status = "Open" if day_dif > 0 else "Waitlisted"

		if self.table:
			if self.status in ["Canceled", "No Show"]:
				frappe.throw("This reservation is not available")
			else:
				table = frappe.get_doc("Restaurant Object", self.table)

				if not table.is_enabled_to_reservation(self):
					frappe.throw("Table is not available")

	def on_update(self):
		if self.table:
			table = frappe.get_doc("Restaurant Object", self.table)
			table._on_update()

		old_version = self.get_doc_before_save()
		if old_version and old_version.table and old_version.table != self.table:
			old_table = frappe.get_doc("Restaurant Object", old_version.table)
			old_table._on_update()

	def onload(self):
		if not self.is_new() and self.status == "Open":
			if get_datetime(self.reservation_end_time) < get_datetime():
				frappe.db.set_value("Restaurant Booking", self.name, "status", "No Show")
				self.reload()
