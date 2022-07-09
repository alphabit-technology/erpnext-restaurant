from __future__ import unicode_literals
import frappe
from erpnext.setup.utils import insert_record
from restaurant_management.setup.desk_form_fields import desk_forms_fields
from itertools import chain

def after_install():
    set_custom_fields()
    create_desk_forms()
    set_custom_scripts()

    
def to_route(txt):
    return txt.replace(' ', '-').replace('_', '-').lower()
    

def create_desk_forms():
    field_structure = dict(
        idx=0,
        fieldname=None,
        fieldtype="Data",
        label=None,
        allow_read_on_all_link_options=1,
        reqd=0,
        depends_on="",
        read_only=0,
        hidden=0,
        options=None,
        description="",
        default=""

    )

    for form in desk_forms_fields:
        form_props = desk_forms_fields[form]

        if frappe.db.count("Desk Form", {
            "route": to_route(form)
        }) == 0:
            insert_record([dict(
                doctype="Desk Form",
                doc_type=form_props["doc_type"],
                title=form,
                route=to_route(form),
                is_standard=1,
                published=1,
                login_required=1,
                allow_edit=1,
                module="Restaurant Management"
            )])

        cf = frappe.get_doc("Desk Form", {
            "route": to_route(form)
        })

        cf.desk_form_fields = []

        for fields in form_props["fields"]:
            cf.append("desk_form_fields", dict(chain.from_iterable(d.items()
                      for d in (field_structure, fields))))

        cf.save()


def set_custom_fields():
    docs = {
        "POS Profile User": dict(
            restaurant_permission=dict(label="Restaurant Permission", fieldtype="Button", options="Restaurant Permission", insert_after="User", in_list_view=1, read_only=1),
            parent=dict(label="Parent", fieldtype="Data", hidden=1),
            parenttype=dict(label="Parent Type", fieldtype="Data", hidden=1),
            restaurant_permissions=dict(label="Restaurant Permissions", fieldtype="Table", options="Restaurant Permission", hidden=1, insert_after="Restaurant Permission"),
        ),
        "POS Profile": dict(
            posa_tax_inclusive=dict(label="Tax Inclusive", fieldtype="Check", insert_after="tax_category", default_value=1)
        )
    }
    for doc in docs:
        for field_name in docs[doc]:
            test_field = frappe.get_value("Custom Field", doc + "-" + field_name)

            if test_field is None or field_name != "posa_tax_inclusive":
                CF = frappe.new_doc("Custom Field") if test_field is None else frappe.get_doc("Custom Field", test_field)

                _values = dict(chain.from_iterable(d.items() for d in (docs[doc][field_name], dict(dt=doc, fieldname=field_name))))
                
                for key in _values:
                    CF.set(key, _values[key])
                    
                CF.insert() if test_field is None else CF.save()

def set_custom_scripts():
    test_script = frappe.get_value("Client Script", "POS Profile-Form")
    CS = frappe.new_doc("Client Script") if test_script is None else frappe.get_doc("Client Script", test_script)

    CS.set("enabled", 1)
    CS.set("view", "Form")
    CS.set("dt", "POS Profile")
    CS.set("script", """
frappe.ui.form.on('POS Profile', {
    refresh(frm) {
        frm.fields_dict['applicable_for_users'].grid.wrapper.find('.btn-open-row').hide();
	}
});

frappe.ui.form.on('POS Profile User', {
    restaurant_permission(frm, cdt, cdn) {
        if(cdn.includes('new')){
            frappe.show_alert(__("Save the record before assigning permissions"));
            return;
        }
        new DeskForm({
            doctype: "POS Profile User",
            docname: cdn,
            form_name: 'restaurant-permission-manage',
            call_back: (self) => {
                self.hide();
            },
            title: __(`Add Access`),
            field_properties: {
                user: {
                    read_only: true
                },
                'restaurant_permissions.room': {
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