// Copyright (c) 2020, CETI Systems and contributors
// For license information, please see license.txt

frappe.ui.form.on('Restaurant Settings', {
	refresh: function(frm) {
	    let text = "Restaurant permissions are enabled for restricted areas, for example: a user with permission to edit an order will not be able to edit it if the order belongs to another user, this permission removes that restriction for a specific role type.";

	    frm.fields_dict.restaurant_permissions_info.$wrapper.empty().append(`
	        ${__(text)}
	    `)

		console.log(frm.fields_dict);
        //console.log(frm);
	}
});
