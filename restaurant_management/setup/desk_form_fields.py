from dataclasses import field


desk_forms_fields = {
    "Payment Order": dict(
        doc_type='Table Order',
        fields=[
            dict(fieldtype="Link", label="Customer", options="Customer", fieldname="customer"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="HTML", label="Dinners Number", fieldname="dinners"),
            dict(fieldtype="Section Break"),
            dict(fieldtype="HTML", label="Payment Methods"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="HTML", label="Num Pad"),
            dict(fieldtype="Section Break"),
            dict(fieldtype="Currency", label="Total Payment", read_only=1),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Currency", label="Change Amount", read_only=1),
            dict(fieldtype="Section Break"),
            dict(fieldtype="Currency", label="Amount", read_only=1, reqd=1, fieldname="amount"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="HTML", label="Payment Button"),
        ]
    ),
    "Order Item Note": dict(
        doc_type='Order Entry Item',
        fields=[
            dict(fieldtype="Text", label="Notes", fieldname="notes"),
        ]
    ),
    "Restaurant Order Customer": dict(
        doc_type='Table Order',
        fields=[
            dict(fieldtype="Link", label="Customer", options="Customer", fieldname="customer"),
        ]
    ),
    "Restaurant Order Dinners": dict(
        doc_type='Table Order',
        fields=[
            dict(fieldtype="Int", label="Dinners", fieldname="dinners"),
        ]
    ),
    "Restaurant Permission Manage": dict(
        doc_type='POS Profile User',
        fields=[
            dict(read_only=1, label="POS Profile", fieldname="parent"),
            dict(read_only=1, hidden=1, label="POS Profile", fieldname="parenttype"),
            dict(fieldtype="Column Break"),
            dict(label="User", options="User", fieldname="user"),
            dict(fieldtype="Section Break"),
            dict(fieldtype="Table", fieldname="restaurant_permissions", label="Restaurant Permission", options="Restaurant Permission")
        ]
    ),
    "Restaurant Table": dict(
        doc_type='Restaurant Object',
        fields=[
            dict(fieldtype="Read Only", label="Type", fieldname="type"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Read Only", label="Room", fieldname="room"),
            dict(fieldtype="Section Break"),

            dict(fieldtype="Int", label="No of Seats", fieldname="no_of_seats"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Int", label="Minimum Seating", fieldname="minimum_seating"),
            dict(fieldtype="Section Break"),
            dict(label="Description", fieldname="description"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Color", label="Color", fieldname="color"),
        ]
    ),
    "Restaurant Room": dict(
        doc_type='Restaurant Object',
        fields=[
            dict(fieldtype="Link", label="Restaurant", options="Restaurant", fieldname="restaurant"),
            dict(fieldtype="Section Break"),
            dict(fieldtype="Select", label="Type", fieldname='type', options="Dine In\nTake Away\nDelivery\nTake Away Delivery"),
            dict(fieldtype="Section Break"),
            dict(label="Description", fieldname="description"),
        ]
    ),
    "Restaurant Production Center": dict(
        doc_type='Restaurant Object',
        fields=[
            dict(fieldtype="Read Only", label="Type", fieldname="type"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Read Only", label="Room", fieldname="room"),
            dict(fieldtype="Section Break"),

            dict(label="Description", fieldname="description"),
            dict(fieldtype="Column Break"),
            dict(fieldtype="Color", label="Color", fieldname="color"),

            dict(fieldtype="Section Break"),
            dict(fieldtype="Table", label="Status Managed",
                options="Status Managed Production Center", fieldname="status_managed"),
            dict(fieldtype="Section Break"),
            dict(fieldtype="Table", label="Item Group",
                fieldname="production_center_group", options="Production Center Group")
        ]
    ),
}