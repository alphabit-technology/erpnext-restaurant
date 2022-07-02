from __future__ import unicode_literals
import frappe
from erpnext.setup.utils import insert_record
from restaurant_management.setup.desk_form_fields import desk_forms_fields
from itertools import chain

def after_install():
    create_desk_forms()
    update_fields()
    set_custom_scripts()


def default_fields():
    return dict(
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
    
def to_route(txt):
    return txt.replace(' ', '-').replace('_', '-').lower()

def format_value(value):
    if value == "None":
        return None
    
    if value == "0":
        return 0

    return value

def create_desk_forms():
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
                      for d in (default_fields(), fields))))

        cf.save()


def update_fields():
    docs = {
        "POS Profile User": dict(
            restaurant_permission=dict(label="Restaurant Permission", fieldtype="Button", options="Restaurant Permission", insert_after="User"),
            parent=dict(label="Parent", fieldtype="Data", hidden=1),
            parenttype=dict(label="Parent Type", fieldtype="Data", hidden=1),
            restaurant_permissions=dict(label="Restaurant Permissions", fieldtype="Table", options="Restaurant Permission", hidden=1, insert_after="Restaurant Permission"),
        ),
    }
    for doc in docs:
        for field in docs[doc]:
            for attr in docs[doc][field]:
                frappe.db.set_value("DocField", {
                    "fieldname": field, "parentType": "DocType", "parent": doc
                }, attr, docs[doc][field][attr])


def set_custom_scripts():
    for doc in ["POS Profile"]:
        if frappe.get_value("Client Script", {"dt": doc}) is None:
            CS = frappe.new_doc("Client Script")
            CS.enabled = "1"
            CS.applicable_for = "Form"
            CS.dt = doc
            CS.script = """
frappe.ui.form.on('POS Profile', {
refresh(frm) {
        frm.fields_dict['applicable_for_users'].grid.wrapper.find('.btn-open-row').hide();
	}
});

frappe.ui.form.on('POS Profile User', {
    restaurant_permission(frm, cdt, cdn) {
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
            CS.save()
