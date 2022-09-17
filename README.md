<div align = "center">
    <img src = "https://frappecloud.com/files/pos-restaurant.webp" height = "128">
    <h2>POS Restaurant</h2>
</div>

___
> ### POS Restaurant includes the following functionalities:

1. Customized Permission Management based on ERPNext user roles.
2. Custom permissions in the POS profile assigned to rooms.
3. Management of personalized permits based on the activity of the restaurant.
4. Dynamic management of the restaurant areas.
5. Restaurant rooms, tables and production center.
6. Individual order management by table and user.
7. Process management based on Restaurant Production Center.
8. Real time based on the user's activity when the restaurant areas are modified or when the user interacts with it.
9. Compatible with Dark Theme.

___
### ERPNext Restaurant Management requires
1. [Frappe Framework](https://github.com/quantumbitcore/frappe_helper.git)
2. [ERPNext](https://github.com/frappe/erpnext.git)
3. [Frappe Helper](https://github.com/quantumbitcore/frappe_helper.git)<br>
    Frappe Helper is another experimental application, in order to be reused by other applications.

___
### How to Install

#### Self Host:
1. `bench get-app https://github.com/quantumbitcore/erpnext-restaurant.git`
2. `bench setup requirements`
3. `bench build --app restaurant_management`
4. `bench restart`
5. `bench --site [site.name] install-app restaurant_management`
6. `bench --site [site.name] migrate`

#### Frappe Cloud:
>Available in your hosting on FrappeCloud [here](https://frappecloud.com/marketplace/apps/restaurant_management)

___
### How to Use
> See the documentation [here](https://github.com/quantumbitcore/erpnext-restaurant/wiki)

___
### Compatibility
> V13, V14

___
ERPNext Restaurant Management is based on [Frappe Framework](https://github.com/frappe/frappe).

___

### License
> GNU / General Public License (see [license.txt](license.txt))

> The POS Restaurant code is licensed under the GNU General Public License (v3).
