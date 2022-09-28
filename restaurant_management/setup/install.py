from __future__ import unicode_literals
from faulthandler import disable
import frappe
from itertools import chain

docs = {
    "POS Profile User": dict(
        restaurant_permission=dict(label="Restaurant Permission", fieldtype="Button",
                                   options="Restaurant Permission", insert_after="User", in_list_view=1, read_only=1),
        parent=dict(label="Parent", fieldtype="Data", hidden=1),
        parenttype=dict(label="Parent Type", fieldtype="Data", hidden=1),
        restaurant_permissions=dict(label="Restaurant Permissions", fieldtype="Table",
                                    options="Restaurant Permission", hidden=1, insert_after="Restaurant Permission"),
    ),
    "POS Profile": dict(
        posa_tax_inclusive=dict(
            label="Tax Inclusive", fieldtype="Check", insert_after="tax_category", default_value=1)
    ),
    "POS Invoice Item": dict(
        identifier=dict(label="Identifier", fieldtype="Data"),
    ),
    "Sales Invoice Item": dict(
        identifier=dict(label="Identifier", fieldtype="Data"),
    )
}

fields_not_needed = ['parent', 'parenttype', 'restaurant_permissions']

def after_install():
    clear_custom_fields();
    set_custom_fields()
    set_custom_scripts()

def clear_custom_fields():
    for doc in docs:
        for field_name in docs[doc]:
            if (field_name in fields_not_needed):
                test_field = frappe.get_value(
                    "Custom Field", doc + "-" + field_name)

                if test_field is not None:
                    frappe.db.sql("""DELETE FROM `tabCustom Field` WHERE name=%s""", test_field)

def set_custom_fields():
    for doc in docs:
        for field_name in docs[doc]:
            if (field_name in fields_not_needed):
                continue

            test_field = frappe.get_value(
                "Custom Field", doc + "-" + field_name)

            if test_field is None or field_name != "posa_tax_inclusive":
                CF = frappe.new_doc("Custom Field") if test_field is None else frappe.get_doc(
                    "Custom Field", test_field)

                _values = dict(chain.from_iterable(d.items() for d in (
                    docs[doc][field_name], dict(dt=doc, fieldname=field_name))))

                for key in _values:
                    CF.set(key, _values[key])

                CF.insert() if test_field is None else CF.save()


def set_custom_scripts():
    test_script = frappe.get_value("Client Script", "POS Profile-Form")
    if test_script is None:
        CS = frappe.new_doc("Client Script")
        CS.set("name", "POS Profile-Form")
    else:
        CS = frappe.get_doc("Client Script", test_script)

    CS.set("enabled", 1)
    CS.set("view", "Form")
    CS.set("dt", "POS Profile")
    CS.set("script", """
frappe.ui.form.on('POS Profile', {
    refresh(frm) {
        //refresh
	}
});

frappe.ui.form.on('POS Profile User', {
    restaurant_permission(frm, cdt, cdn) {
        if(cdn.includes('new')){
            frappe.show_alert(__("Save the record before assigning permissions"));
            return;
        }
        
        new DeskForm({
            form_name: 'Restaurant Permission Manage',
            doc_name: cdn,
            call_back: (self) => {
                self.hide();
            },
            title: __(`Room Access`),
            field_properties: {
                pos_profile_user: {
                  value: cdn  
                },
                'restaurant_permission.room': {
                    "get_query": () => {
                        return {
                            filters: [
                    			['type', '=', 'Room']
                    		]
                        }
                    }
                }
            }
        });
    }
});"""
           )
    CS.insert() if test_script is None else CS.save()
