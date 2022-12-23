// Copyright (c) 2022, Quantum Bit Core and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Booking', {
	setup: function (frm) {
		frm.add_fetch('customer', 'customer_name', 'customer_name');
	},
	// refresh: function(frm) {

	// }
});
