// Copyright (c) 2021, Quantum Bit Core and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Settings', {
	refresh: function(frm) {
	    const permission_message = "Restaurant permissions are enabled for restricted areas, for example: a user with permission to edit an order will not be able to edit it if the order belongs to another user, this permission removes that restriction for a specific role type.";

	    frm.fields_dict.restaurant_permissions_info.$wrapper.empty().append(`
	        ${__(permission_message)}
	    `);

		const one_click_events_message = "This option changes the double click events in the main system processes to a single click."

		frm.fields_dict.double_click_events_info.$wrapper.empty().append(`
	        ${__(one_click_events_message)}
	    `);
	},

	setup: function(frm) {
		frm.set_query("print_format", function () {
			return {
				filters: [
					['Print Format', 'doc_type', '=', 'Table Order']
				]
			};
		});
	}
});
