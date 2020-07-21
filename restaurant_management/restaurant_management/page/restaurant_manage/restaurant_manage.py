from __future__ import unicode_literals
import frappe, json
from frappe import _


class RestaurantManage:
    @staticmethod
    def get_rooms():
        rooms = frappe.get_list("Restaurant Object", "name, description", filters={
            "type": "Room"
        })

        for room in rooms:
            t = frappe.get_doc("Restaurant Object", room.name)
            room["orders_count"] = t.orders_count

        return rooms

    @staticmethod
    def add_room():
        room = frappe.new_doc("Restaurant Object")
        room.type = "Room"
        room.description = f"Room {(RestaurantManage().count_roms() + 1)}"
        room.save()
        return room

    @staticmethod
    def count_roms():
        return frappe.db.count("Restaurant Object", filters={"type": "Room"})

    @staticmethod
    def listener(data):
        for d in data:
            if len(data[d]["data"]) == 0:
                return data

            if d == "Table":
                cond = "and `table` in (%s)" % (', '.join([f"'{row}'" for row in data[d]["data"]]))

                oc = frappe.db.sql(f"""
                        SELECT `table` as name, count(`table`) as count
                        FROM `tabTable Order`
                        WHERE status = 'Attending' {cond}
                        GROUP by `table`
                        """, as_dict=True)

                for o in oc:
                    data[d]["data"][o.name]["count"] = o.count

            if d == "Room":
                cond = "and `room` in (%s)" % (', '.join([f"'{row}'" for row in data[d]["data"]]))

                oc = frappe.db.sql(f"""
                        SELECT `room` as name, count(`room`) as count
                        FROM `tabTable Order`
                        WHERE status = 'Attending' {cond}
                        GROUP by `room`
                        """, as_dict=True)

                for o in oc:
                    data[d]["data"][o.name]["count"] = o.count

            if d == "Production Center":
                for pc in data[d]["data"]:
                    production_center = frappe.get_doc("Restaurant Object", pc)

                    data[d]["data"][pc]["count"] = production_center.orders_count_in_production_center

            if d == "Process":
                production_center = frappe.get_doc("Restaurant Object", data[d]["data"])
                status_managed = production_center.status_managed

                filters = {
                    "status": ("in", [item.status_managed for item in status_managed]),
                    "item_group": ("in", production_center._items_group),
                    "parent": ("!=", "")
                }

                data = dict(Process=frappe.get_all("Order Entry Item", "identifier,status", filters=filters))

        return data


@frappe.whitelist()
def get_rooms():
    return RestaurantManage().get_rooms()


@frappe.whitelist()
def add_room():
    return {
        "current_room": RestaurantManage().add_room().name,
        "rooms": RestaurantManage().get_rooms()
    }


@frappe.whitelist(allow_guest=True)
def get_work_station():
    work_stations = frappe.get_list("Work Station")
    work_station = frappe.get_doc("Work Station", work_stations[0].name)
    return {
        "work_station": work_station,
        "pos_profile": frappe.get_doc("POS Profile", work_station.pos_profile)
    }


@frappe.whitelist()
def listeners(args):
    import json
    return RestaurantManage().listener(json.loads(args))
    # return json.loads(args)


@frappe.whitelist()
def get_config():
    profile = frappe.db.get_value("User", frappe.session.user, "role_profile_name")
    restaurant_settings = frappe.get_single("Restaurant Settings")
    return dict(
        pos=pos_profile_data(),
        permissions=dict(
            # pay=frappe.has_permission("Sales Invoice", 'create'),
            invoice=frappe.permissions.get_doc_permissions(frappe.new_doc("Sales Invoice")),
            order=frappe.permissions.get_doc_permissions(frappe.new_doc("Table Order")),
            restaurant_object=frappe.permissions.get_doc_permissions(frappe.new_doc("Restaurant Object")),
        ),
        restrictions=frappe.get_single("Restaurant Settings"),
        exceptions=[item for item in restaurant_settings.restaurant_permissions if item.role_profile == profile],
        geo_data=frappe.session,
        test_data=frappe.get_doc("User", frappe.session.user)
    )


def pos_profile_data():
    from erpnext.stock.get_item_details import get_pos_profile
    pos_profile = get_pos_profile(frappe.defaults.get_user_default('company'))

    return dict(
        has_pos=pos_profile is not None,
        pos=None if pos_profile is None else frappe.get_doc("POS Profile", pos_profile.name)
    )


def set_pos_profile(doc, method=None):
    frappe.publish_realtime("pos_profile_update", pos_profile_data())
