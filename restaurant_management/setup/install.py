from __future__ import unicode_literals
from faulthandler import disable
import frappe
from itertools import chain

custom_fields = {
    "POS Profile User": dict(
        restaurant_permission=dict(label="Restaurant Permission", fieldtype="Button",
                                   options="Restaurant Permission", insert_after="User", in_list_view=1, read_only=1),
        parent=dict(label="Parent", fieldtype="Data", hidden=1),
        parenttype=dict(label="Parent Type", fieldtype="Data", hidden=1),
        restaurant_permissions=dict(label="Restaurant Permissions", fieldtype="Table",
                                    options="Restaurant Permission", hidden=1, insert_after="Restaurant Permission")
    ),
    "POS Profile": dict(
        posa_tax_inclusive=dict(
            label="Tax Inclusive", fieldtype="Check", insert_after="tax_category", default_value=1),
        restaurant_settings=dict(
            label="Restaurant Settings", fieldtype="Section Break", insert_after="applicable_for_users"),
            crm_room=dict(label="CRM Room", fieldtype="Link", options="Restaurant Object", insert_after="restaurant_settings"),
            column_break_1=dict(fieldtype="Column Break", insert_after="crm_room"), 
            crm_table=dict(label="CRM Table", fieldtype="Link", read_only=1, options="Restaurant Object", insert_after="column_break_1")
    ),
    "POS Invoice Item": dict(
        identifier=dict(label="Identifier", fieldtype="Data"),
    ),
    "Sales Invoice Item": dict(
        identifier=dict(label="Identifier", fieldtype="Data"),
    ),
    "Address": dict(
        branch=dict(label="Branch", fieldtype="Link", options="Branch", insert_after="address_line1"),
    )
}

fields_not_needed = ['parent', 'parenttype', 'restaurant_permissions']

def after_install():
    clear_custom_fields();
    set_custom_fields()
    set_custom_scripts()

def clear_custom_fields():
    for doc in custom_fields:
        for field_name in custom_fields[doc]:
            if (field_name in fields_not_needed):
                test_field = frappe.get_value(
                    "Custom Field", doc + "-" + field_name)

                if test_field is not None:
                    frappe.db.sql("""DELETE FROM `tabCustom Field` WHERE name=%s""", test_field)

def set_custom_fields():
    for doc in custom_fields:
        for field_name in custom_fields[doc]:
            if (field_name in fields_not_needed):
                continue

            test_field = frappe.get_value(
                "Custom Field", doc + "-" + field_name)

            if test_field is None or field_name != "posa_tax_inclusive":
                CF = frappe.new_doc("Custom Field") if test_field is None else frappe.get_doc(
                    "Custom Field", test_field)

                _values = dict(chain.from_iterable(d.items() for d in (
                    custom_fields[doc][field_name], dict(dt=doc, fieldname=field_name))))

                for key in _values:
                    CF.set(key, _values[key])

                CF.insert() if test_field is None else CF.save()


def set_custom_scripts():
    custom_scripts = {
        "POS Profile": dict(
            doc="POS Profile",
            script="""
frappe.ui.form.on('POS Profile', {
    setup(frm) {
        frm.set_query('crm_room', function(doc) {
			return {
				filters: [
                    ['type', '=', 'Room']
                ]
			}
		});
    },
    crm_room: function(frm){
        frm.set_value("crm_table", "");
		if(frm.doc.crm_room){
		    frm.set_df_property("crm_table", "read_only", 0);
		    frm.set_df_property("crm_table", "reqd", 1);
		    frm.set_query('crm_table', function(doc) {
    			return {
    				filters: [
                        ['type', '=', 'Table'],
                        ['room', '=', frm.doc.crm_room]
                    ]
    			}
    		});
		}else{
		    frm.set_df_property("crm_table", "read_only", 1);
		    frm.set_df_property("crm_table", "reqd", 0);
		}
	},
    refresh(frm) {
        if(frm.doc.crm_room){
		    frm.set_df_property("crm_table", "read_only", 0);
		    frm.set_df_property("crm_table", "reqd", 1);
		}else{
		    frm.set_df_property("crm_table", "read_only", 1);
		    frm.set_df_property("crm_table", "reqd", 0);
		}
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
        ),
        "Customer": dict(
            doc="Customer",
            script= """
frappe.ui.form.on('Customer', {
    refresh(frm) {
        if(!frm.doc.__islocal) {
            frm.add_custom_button(__('Restaurant Order'), function () {
                window.crm_customer = frm.doc.name;

                frappe.set_route('restaurant-manage');
            }, __('Create'));
        }
    }
})"""
        )
    }

    for script in custom_scripts:
        set_custom_script(custom_scripts[script]["doc"], custom_scripts[script]["script"])


def set_custom_script(document, script,  apply_to="Form"):
    script_name = document + "-" + apply_to
    test_script = frappe.get_value("Client Script", script_name)
    
    if test_script is None:
        CS = frappe.new_doc("Client Script")
        CS.set("name", script_name)
    else:
        CS = frappe.get_doc("Client Script", test_script)

    CS.set("enabled", 1)
    CS.set("view", "Form")
    CS.set("dt", document)
    CS.set("script", script)

    CS.insert() if test_script is None else CS.save()
