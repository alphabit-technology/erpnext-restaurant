from __future__ import unicode_literals
import frappe


class RestaurantManage:
    @staticmethod
    def production_center_notify(status):
        object_in_status = frappe.get_list("Status Managed Production Center", "parent", filters={
            "parentType": "Restaurant Object",
            "status_managed": ("in", status)
        })

        for item in object_in_status:
            obj = frappe.get_doc("Restaurant Object", item.parent)
            obj.send_notifications()

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
def add_room(client=None):
    frappe.publish_realtime("check_rooms", dict(
        client=client,
        current_room=RestaurantManage().add_room().name,
        rooms=RestaurantManage().get_rooms()
    ))
    #return {
    #    "current_room": RestaurantManage().add_room().name,
    #    "rooms": RestaurantManage().get_rooms()
    #}


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


@frappe.whitelist()
def get_settings_data():
    restaurant_settings = frappe.get_single("Restaurant Settings")
    return restaurant_settings.settings_data()


def pos_profile_data():
    restaurant_settings = frappe.get_single("Restaurant Settings")
    return restaurant_settings.pos_profile_data()


def set_pos_profile(doc, method=None):
    frappe.publish_realtime("pos_profile_update", pos_profile_data())


def notify_to_check_command(command_foods):
    frappe.publish_realtime("notify_to_check_order_data", dict(
        commands_foods=command_foods
    ))


def debug_data(data):
    frappe.publish_realtime("debug_data", data)
