from __future__ import unicode_literals
from frappe import _


def get_data():
    return [
        {
            "label": _("Restaurant Management"),
            "icon": "fa fa-star",
            "items": [
                {
                    "type": "doctype",
                    "name": "Restaurant Object",
                    "description": _("Restaurant Object."),
                    "onboard": 1,
                },
                {
                    "type": "doctype",
                    "name": "Table Order",
                    "description": _("Restaurant Order."),
                    "onboard": 1,
                },
                {
                    "type": "page",
                    "name": "restaurant-manage",
                    "label": _("Restaurant Manage"),
                    "icon": "fa fa-bar-chart"
                },
            ],
        }
    ]
