from __future__ import unicode_literals
import frappe
from erpnext.setup.utils import insert_record
from restaurant_management.setup.desk_form_fields import fields


def to_route(txt):
    return txt.replace(' ', '-').replace('_', '-').lower()


def after_install():
    forms = {
        "Restaurant Room": dict(doc_type='Restaurant Object'),
        "Restaurant Table": dict(doc_type='Restaurant Object'),
        "Restaurant Production Center": dict(doc_type='Restaurant Object'),
        "Restaurant Order": dict(doc_type='Table Order'),
        "Order Item Note": dict(doc_type='Order Entry Item'),
        # "Customer Edit": dict(doc_type='Customer'),
        "Payment Order": dict(doc_type='Table Order'),
    }

    for form in forms:
        if frappe.db.count("Desk Form", {
            "route": to_route(form)
        }) == 0:
            insert_record([dict(
                doctype="Desk Form",
                doc_type=forms[form]["doc_type"],
                title=form,
                route=to_route(form),
                is_standard=1,
                published=1,
                login_required=1,
                allow_edit=1,
                module="Restaurant Management"
            )])

    for form in forms:
        cf = frappe.get_doc("Desk Form", {
            "route": to_route(form)
        })
        cf.desk_form_fields = []
        for f in fields:
            field = f
            if field["parent"] == to_route(form):
                cf.append("desk_form_fields", dict(
                    idx=field["idx"],
                    fieldname=field["fieldname"],
                    fieldtype=field["fieldtype"],
                    label=field["label"],
                    allow_read_on_all_link_options=1,
                    reqd=field["reqd"],
                    depends_on=field["depends_on"],
                    read_only=field["read_only"],
                    hidden=field["hidden"],
                    options=field["options"],
                    description=field["description"],
                    default=field["default"]
                ))

        cf.save()