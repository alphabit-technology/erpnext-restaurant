// Copyright (c) 2021, Quantum Bit Core and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Settings', {
	refresh: function(frm) {
	    let text = "Restaurant permissions are enabled for restricted areas, for example: a user with permission to edit an order will not be able to edit it if the order belongs to another user, this permission removes that restriction for a specific role type.";

	    frm.fields_dict.restaurant_permissions_info.$wrapper.empty().append(`
	        ${__(text)}
	    `)

		frm.add_custom_button(__('Reinstall'), () => {
	        frappe.call({
				method: "restaurant_management.restaurant_management.doctype.restaurant_settings.restaurant_settings.reinstall",
				always: function(r) {
					frappe.msgprint(__("Completed"));
				}
			});
		});
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
