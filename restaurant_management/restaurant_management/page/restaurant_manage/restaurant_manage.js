/**RestaurantManagement**/
var RM = null;
const [TRANSFER, UPDATE, DELETE, INVOICED, ADD, QUEUE, SPLIT] = ["Transfer", "Update", "Delete", "Invoiced", "Add", "queue", "Split"];

frappe.pages['restaurant-manage'].on_page_load = function(wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: '',
		single_column: true
	});

	$("body").hide();

	frappe.db.get_value('POS Settings', {name: 'POS Settings'}, 'is_online', (r) => {
		if (r && !cint(r.use_pos_in_offline_mode)) {
			RM = new RestaurantManage(wrapper);
		}
	});
}

frappe.pages['restaurant-manage'].refresh = function(wrapper) {
	if(RM != null){
		RM.test_pos();
	}
}

RestaurantManage = class RestaurantManage {
	constructor(wrapper) {
		this.base_wrapper = wrapper;
		this.wrapper = $(wrapper).find('.layout-main-section');
		this.page = wrapper.page;
		this.editing = false;
		this.transfer_order = null;
		this.current_room = null;
		this.url_manage = "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.";
		this.busy = false;
		this.async_process = false;
		this.pos_profile = null;
		this.sounds = false;
		this.client = this.uuid();
		this.request_client = null;
		this.company = frappe.defaults.get_user_default('company');
		this.loaded = false;
		this.store = {
			items: []
		}
		this.components = [];
		this.objects = [];

		const base_assets = "assets/restaurant_management/restaurant/"

		const assets = [
			"assets/frappe/js/lib/clusterize.min.js",

			base_assets + 'js/restaurant-room-class.js',
			base_assets + 'js/restaurant-object-class.js',

			base_assets + 'js/order-manage-class.js',
			base_assets + 'js/product-item-class.js',
			base_assets + 'js/order-item-class.js',

			base_assets + 'js/process-manage-class.js',
			base_assets + 'js/food-command-class.js',
			base_assets + 'js/table-order-class.js',
			base_assets + 'js/pay-form-class.js',

			base_assets + 'css/restaurant-room.css',
			base_assets + 'css/action-buttons.css',
			base_assets + 'css/editor-order.css',
			base_assets + 'css/food-command.css',
			base_assets + 'css/order-buttons.css',
			base_assets + 'css/order-items.css',
			base_assets + 'css/order-items-container.css',
			base_assets + 'css/order-manage.css',
			base_assets + 'css/process-manage.css',
			base_assets + 'css/product-list.css',
			base_assets + 'css/restaurant-object.css'
		];

		frappe.require(assets, () => {
			this.make();
		});
	}

	make() {
		return frappe.run_serially([
			() => frappe.dom.freeze(),
			() => this.prepare_dom(),
			() => {
				this.working("Set settings");
				this.get_settings_data().then(() => {
					this.make_rooms().then(() => {
						setTimeout(() => {
							this.check_permissions_status();
						}, 100);
					});
				});
			},
			() => {
				frappe.dom.unfreeze();
			},
			() => this.page.set_title(__('Restaurant Manage')),
			() => this.init_synchronize(),
			() => this.page.$title_area.hide(),
		]);
	}

	test_pos(){
		if(this.loaded && this.pos_profile == null){
			this.raise_exception_for_pos_profile();
		}
	}

	raise_exception_for_pos_profile() {
		if($(this.base_wrapper).is(":visible")){
			setTimeout(() => frappe.set_route('List', 'POS Profile'), 2000);
			frappe.throw(this.not_has_pos_profile_message());
		}
	}

	not_has_pos_profile_message(){
		return __("POS Profile is required to use Point-of-Sale");
	}

	prepare_dom() {
		this.rooms_container = new JSHtml({
			tag: "div",
			properties: {
				style: "display: flex; width: 100%"
			}
		});

		this.floor_map = new JSHtml({
			tag: "div", properties: {class: "table-container-scroll"}
		}).on("click", () => {
			RM.unselect_all_tables();
		});

		this.components['add_table'] = new JSHtml({
			tag: "button", properties: {class: "btn btn-default btn-flat"},
			content: `<span class="fa fa-plus"/> ${__("Table")}</span>`
		}).on("click", () => {
			this.add_object("Table");
		});

		this.components['add_production_center'] = new JSHtml({
			tag: "button", properties: {class: "btn btn-default btn-flat"},
			content: `<span class="fa fa-plus"/> ${__("P Center")}</span>`
		}).on("click", () => {
			this.add_object("Production Center");
		});

		this.components['edit_room'] = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-flat"},
			content: `<span class="fa fa-pencil"/> ${__("Edit")}</span>`
		}).on("click", () => {
			if(this.current_room != null) this.current_room.edit();
		});

		this.components['delete_room'] = new JSHtml({
			tag: "button",
			properties: {class: "btn btn-default btn-flat"},
			content: `<span class="fa fa-trash"/> {{text}}</span>`,
			text:__('Delete')
		}).on("click", () => {
			if(this.current_room != null) this.current_room.delete();
		}, DOUBLE_CLICK);

		this.general_edit_button = new JSHtml({
			tag: "div",
			properties: {
				class: 'btn-default button general-editor-button'
			},
			content: `<span class="fa fa-pencil"/>`
		}).on("click", () => {
			this.set_edit_status();
		});

		this.add_room_button = new JSHtml({
			tag: "div",
			properties: {
				class: 'btn-default button general-editor-button add-room'
			},
			content: `<span class="fa fa-plus"/>`
		}).on("click", () => {
			this.add_object("Room");
		});

		this.config_button = new JSHtml({
			tag: "div",
			properties: {
				class: `btn-default button general-editor-button setting`,
				//style: 'display: none'
			},
			content: `<span class="fa fa-cog"/>`
		}).on("click", () => {

		});

		this.wrapper.append(`
			<div class="restaurant-manage">
				<div class="floor-selector">
					${this.general_edit_button.html()}
					${this.rooms_container.html()}
					${this.add_room_button.html()}
					${this.config_button.html()}
				</div>
				<div class="floor-map">
					<div class="floor-map-editor left">
						${this.components['add_table'].html()}
						${this.components['add_production_center'].html()}
					</div>
					<div class="floor-map-editor right">
						${this.components['edit_room'].html()}
						${this.components['delete_room'].html()}
					</div>
					${this.floor_map.html()}
				</div>
			</div>
			<div class="sidebar-footer">
				<div class="non-selectable">
					<span class="restaurant-manage-status">${__("Ready")}</span>
					<span class="pos-profile">${__("POS Profile")}</span>
				</div>
			</div>
			<div id="customize-alert-message"></div>
		`);

		this.pull_alert("left");
	}

	make_rooms(){
		this.working("Loading Rooms");
		return new Promise(res => {
			frappe.call({
				method: this.url_manage + "get_rooms"
			}).then(r => {
				$("body").show();
				this.rooms = r.message;
				this.render_rooms();
				this.ready();
				res();
			});
		});
	}

	set_current_room(room){
		this.current_room = room;
		this.test_components();
	}

	render_rooms(current=false){
		let room_from_url = null;
		this.rooms.forEach((room, index, rooms) => {
			if(RM.object(room.name) == null){
				RM.object(room.name, new RestaurantRoom(room))
			}else{
				RM.object(room.name).data = room;
			}

			if(current === false){
				if (this.current_room == null) {
					if(RM.object(this.get_room_from_url()) == null){
						room_from_url = rooms[0].name;
					}else{
						room_from_url = this.get_room_from_url();
					}
				}else{
					room_from_url = this.current_room.data.name;
				}
			}else{
				room_from_url = current;
			}
		});

		setTimeout(() => {
			this.current_room = RM.object(room_from_url);
			if (this.current_room != null) {
				this.current_room.select();
			}
		}, 0);
	}

	get_settings_data() {
		return new Promise(res => {
			frappe.xcall(this.url_manage + "get_settings_data", {}).then((r) => {
				this.set_settings_data(r);
				res();
			});
		});
	}

	set_settings_data(r){
		this.loaded = true;

		this.permissions = r.permissions;
		this.exceptions = r.exceptions;
		this.restrictions = r.restrictions;

		if(r.pos.has_pos){
			this.pos_profile = r.pos.pos;
			this.wrapper.find(".pos-profile").empty().append(this.pos_profile.name);
		}else{
			this.pos_profile = null;
			this.raise_exception_for_pos_profile();
		}
		this.ready();
	}

	in_rooms(f){
		this.rooms.forEach((room, index, rooms) => {
			if (RM.object(room.name) != null) {
				f(RM.object(room.name), index, rooms)
			}
		});
	}

	object(name, object=null){
		let obj = this.objects[name];
		if(typeof obj == "undefined" && object != null){
			this.objects[name] = object;
		}
		return typeof this.objects[name] != "undefined" ? this.objects[name] : null;
	}

	init_synchronize(){
		frappe.realtime.on("debug_data", (data) => {
			console.log(data);
		});

		let check_items_in_process_manage = (items, item_removed=null) =>{
			this.in_rooms((room) => {
				room.in_tables((obj) => {
					if(obj.process_manage != null){
						obj.process_manage.check_items(items);
						if(item_removed){
							obj.process_manage.remove_item(item_removed);
						}
					}
				});
			});
		}

		frappe.realtime.on("synchronize_order_data", (r) => {
			let data = r.data;
			let order = data.order;

			this.request_client = r.client;
			check_items_in_process_manage(data.items, r.item_removed);

			let table = RM.object(order.data.table);
			if(this.current_room == null || table == null) return;

			if(r.action === TRANSFER){
				let last_table = RM.object(order.data.last_table);
				if(last_table != null && last_table.order_manage != null){
					last_table.order_manage.check_data(r)
				}

				this.transfer_order = null;

				if (table.order_manage == null) {
					if (this.client === r.client) {
						setTimeout(() => {
							table.order_manage = new OrderManage({
								identifier: RM.OMName(table.data.name),
								table: table,
								current_order_identifier: order.data.name
							});
							RM.object(table.order_manage.identifier, table.order_manage);
						});
					}
				} else {
					setTimeout(() => {
						table.order_manage.check_data(r);
						if(table.room.data.name === RM.current_room.data.name && RM.client === r.client) {
							table.order_manage.show();
						}
					});
				}
			}else{
				if (table.order_manage != null) {
					setTimeout(() => {
						table.order_manage.check_data(r);
					});
				}
			}
		});

		frappe.realtime.on("update_settings", () => {
			this.get_settings_data().then(() => {
				this.check_permissions_status();
			});
		});

		frappe.realtime.on("check_rooms", (r) => {
			this.rooms = r.rooms;
			this.render_rooms(r.client === RM.client ? r.current_room : false);
		});

		frappe.realtime.on("pos_profile_update", (r) => {
			if(r && r.has_pos){
				this.pos_profile = r.pos;
			}else{
				this.pos_profile = null;
				this.raise_exception_for_pos_profile();
			}
		});
	}

	check_permissions_status(){
		this.in_rooms((room) => {
			room.in_tables((Table) => {
				if(Table.order_manage != null){
					Table.order_manage.check_permissions_status();
				}
				Table.set_orders_count();
			}, "Table");
		});

		if(!this.permissions.restaurant_object.write){
			this.general_edit_button.disable().hide();
		}
	}

	add_object(t){
		if(t === "Room"){
			this.add_room();
		}else if(this.current_room != null){
			this.current_room.add_object(t);
		}
	}

	add_room(){
		this.working("Add Room");
		frappe.call({
			method: this.url_manage + "add_room",
			args: {client: RM.client},
			always: () => {
				this.ready();
			},
		});
	}

	set_edit_status(){
		if(!this.permissions.restaurant_object.write) return;
		if(this.editing){
			this.editing = false;
			$(".restaurant-manage").removeClass("editing");
			this.unselect_all_tables();
		}else{
			this.editing = true;
			$(".restaurant-manage").addClass("editing");
			Object.keys(this.components).forEach(k => {
				this.components[k].hide();
			});
			this.test_components();
		}
	}

	test_components(){
		Object.keys(this.components).forEach(k => {
			if(this.current_room == null){
				this.components[k].hide();
			} else {
				this.components[k].show();
			}
		});
	}

	get_room_from_url(){
		return frappe.urllib.get_arg("restaurant_room");
	}

	unselect_all_tables(){
		this.in_rooms((room) => {
			room.unselect_all_tables();
		});
	}

	pull_alert(position="right", max_width="calc(100% - 410px)"){
		$("#customize-alert-message").empty().append(`
			<style>
				#alert-container{
					${position}: 10px !important;
					max-width: ${max_width} !important;
					-moz-user-select: none;
					-webkit-user-select: none;
					-ms-user-select: none;
					user-select: none;
					z-index: 999999999999999999999;
				}
			</style>`
		)
	}

	delete_current_room(){
		this.current_room = null;
		frappe.set_route(`/restaurant-manage?restaurant_room=?`);
		this.test_components();
	}

	working(text, busy=true, async_process=false){
		this.busy = busy;
		this.async_process = async_process;
		this.wrapper.find(".restaurant-manage-status").empty().append(__(text));
	}

	ready(message=false, sound=false){
		this.busy = false;
		if(RM.transfer_order != null){
			this.working("Transferring Order");
		}else{
			this.wrapper.find(".restaurant-manage-status").empty().append(__("Ready"))
		}

		if(message !== false){
			frappe.show_alert(message);
		}

		if(sound !== false){
			setTimeout(`window['RM'].sound_${sound}()`, 0)
		}
	}

	busy_message(){
		if(this.busy){
			frappe.show_alert({
				indicator: 'red',
				message: __("Please wait for an operation to complete")
			});
			return true;
		}
		return false;
	}

	notification(indicator="red", message=""){
		frappe.show_alert({
			indicator: indicator,
			message: __(message)
		});
	}

	format_currency(value){
		let val = isNaN(parseFloat(value)) ? 0 : parseFloat(value);
		return format_currency(parseFloat(val), this.pos_profile.currency);
	}

	sound_delete(message=false){
		if(this.sounds) $("#sound-delete").trigger('play');
		if(message !== false){
			frappe.show_alert(message);
		}
	}
	sound_submit(message=false){
		if(this.sounds) $("#sound-submit").trigger('play');

		if(message !== false){
			frappe.show_alert(message);
		}
	}
	sound_success(message=false){
		if(this.sounds) $("#sound-submit").trigger('play');

		if(message !== false){
			frappe.show_alert(message);
		}
	}

	uuid(prefix='obj') {
		let id = 'xxxx-xx-4xx-yxx-xxxxx'.replace(/[xy]/g, function (c) {
			let r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

		return prefix + "_" + id;
	}

	check_permissions(model=null, record=null, action){
		if(frappe.session.user === "Administrator") return true;

		let r = false;

		if(model != null){
			let model_in_permissions = this.permissions[model];
			if(typeof model_in_permissions != "undefined" && typeof model_in_permissions[action] !== "undefined"){
				r = this.permissions[model][action];
			}

			let exception = () => {
				r = false;
				this.exceptions.map(e => {
					r = e[model + "_" + action] === 1;
				});
			}

			if (record == null) {
				if(!r){
					exception();
				}
			} else {
				if (record.data.owner !== frappe.session.user) {
					if(model === "order" && this.restrictions.restricted_to_owner_order) {
						exception();
					}
					if(model === "table" && this.restrictions.restricted_to_owner_table) {
						exception();
					}
				}
			}

			if (model === 'pos' && r) {
				r = this.pos_profile["allow_" + action] === 1;
			}
		}

		return r;
	}

	can_pay(){
		return this.check_permissions("invoice", null, "create");
	}

	can_open_order_manage(table){
		if(frappe.session.user === "Administrator" || this.can_pay()) return true;

		if(table.data.current_user !== frappe.session.user && table.data.orders_count > 0){
			if(this.restrictions.restricted_to_owner_table){
				return this.check_permissions("order", null, "manage");
			}
		}

		return true;
	}

	PMName(process_manage){return "process_manage" + process_manage;}
	OMName(order_manage){return "order_manage" + order_manage;}
}