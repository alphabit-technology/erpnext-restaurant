# -*- coding: utf-8 -*-
from __future__ import unicode_literals

from . import __version__ as app_version

app_name = "restaurant_management"
app_title = "Restaurant"
app_publisher = "Quantum Bit Core"
app_description = "Restaurant"
app_icon = "octicon octicon-file-directory"
app_color = "grey"
app_email = "qubitcore.io@gmail.com"
app_license = "MIT"
source_link = "https://github.com/joepa37/restaurant_management"

doc_events = {
    "POS Profile": {
        "on_create": "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.set_settings_data",
        "on_update": "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.set_settings_data"
    },
    "POS Profile User": {
        "on_create": "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.set_settings_data",
        "on_update": "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.set_settings_data"
    },
}

after_migrate = "restaurant_management.setup.install.after_install"
after_install = "restaurant_management.setup.install.after_install"

# Includes in <head>
# ------------------

# include js, css files in header of desk.html
# app_include_css = "/assets/{app_name}/css/{app_name}.css"

app_include_js = [
    '/assets/restaurant_management/js/clusterize.min.js',
    '/assets/restaurant_management/js/interact.min.js',
    '/assets/restaurant_management/js/drag.js',
    '/assets/restaurant_management/js/RM.helper.js',
    '/assets/restaurant_management/js/object-manage.js'
]

# include js, css files in header of web template
# web_include_css = "/assets/{app_name}/css/{app_name}.css"
# web_include_js = "/assets/{app_name}/js/{app_name}.js"

# include js, css files in header of web form
# webform_include_js = {"doctype": "public/js/doctype.js"}
# webform_include_css = {"doctype": "public/css/doctype.css"}

# include js in page
# page_js = {"page" : "public/js/file.js"}

# include js in doctype views
# doctype_js = {{"doctype" : "public/js/doctype.js"}}
# doctype_list_js = {{"doctype" : "public/js/doctype_list.js"}}
# doctype_tree_js = {{"doctype" : "public/js/doctype_tree.js"}}
# doctype_calendar_js = {{"doctype" : "public/js/doctype_calendar.js"}}

# Home Pages
# ----------

# application home page (will override Website Settings)
# home_page = "login"

# website user home page (by Role)
# role_home_page = {{
#	"Role": "home_page"
# }}

# Website user home page (by function)
# get_website_user_home_page = "{app_name}.utils.get_home_page"

# Generators
# ----------

# automatically create page for each record of this doctype
# website_generators = ["Web Page"]

# Installation
# ------------

# before_install = "{app_name}.install.before_install"
# after_install = "{app_name}.install.after_install"

# Desk Notifications
# ------------------
# See frappe.core.notifications.get_notification_config

# notification_config = "{app_name}.notifications.get_notification_config"

# Permissions
# -----------
# Permissions evaluated in scripted ways

# permission_query_conditions = {{
# 	"Event": "frappe.desk.doctype.event.event.get_permission_query_conditions",
# }}
#
# has_permission = {{
# 	"Event": "frappe.desk.doctype.event.event.has_permission",
# }}

# Document Events
# ---------------
# Hook on document methods and events

# doc_events = {{
# 	"*": {{
# 		"on_update": "method",
# 		"on_cancel": "method",
# 		"on_trash": "method"
#	}}
# }}

# Scheduled Tasks
# ---------------

# scheduler_events = {{
# 	"all": [
# 		"{app_name}.tasks.all"
# 	],
# 	"daily": [
# 		"{app_name}.tasks.daily"
# 	],
# 	"hourly": [
# 		"{app_name}.tasks.hourly"
# 	],
# 	"weekly": [
# 		"{app_name}.tasks.weekly"
# 	]
# 	"monthly": [
# 		"{app_name}.tasks.monthly"
# 	]
# }}

# Testing
# -------

# before_tests = "{app_name}.install.before_tests"

# Overriding Methods
# ------------------------------
#
# override_whitelisted_methods = {{
# 	"frappe.desk.doctype.event.event.get_events": "{app_name}.event.get_events"
# }}
#
# each overriding function accepts a `data` argument;
# generated from the base implementation of the doctype dashboard,
# along with any modifications made in other Frappe apps
# override_doctype_dashboards = {{
# 	"Task": "{app_name}.task.get_dashboard_data"
# }}

# exempt linked doctypes from being automatically cancelled
#
# auto_cancel_exempted_doctypes = ["Auto Repeat"]
