/**RestaurantManagement**/
var RM = null;

frappe.pages['restaurant-manage'].on_page_load = function(wrapper) {
	frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Restaurant Manage',
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
		this.transfer_order = undefined;
		this.current_room = null;
		this.max_z_index = 50;
		this.url_manage = "restaurant_management.restaurant_management.page.restaurant_manage.restaurant_manage.";
		this.tables_container = null;
		this.rooms_container = null;
		this.busy = false;
		this.async_process = false;
		this.work_station = null;
		this.pos_profile = null;
		this.sounds = false;

		this.general_edit_button = null;
		this.add_room_button = null;

		this.client = null;
		this.request_client = null;
		this.company = frappe.defaults.get_user_default('company');
		this.loaded = false;

		const base_assets = "assets/restaurant_management/restaurant/"

		const assets = [
			'assets/erpnext/js/pos/clusterize.js',
			'assets/erpnext/css/pos.css',

			'assets/ceti/js/jshtml-class.js',
			'assets/ceti/js/num-pad-class.js',
			'assets/ceti/css/num-pad.css',
			'assets/ceti/js/ceti-modal.js',
			'assets/ceti/js/ceti-api.js',
			'assets/ceti/js/ceti-form-class.js',

			'assets/restaurant_management/js/jquery-ui.js',

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
			base_assets + 'css/order-manage-control-buttons.css',
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
			() => {
				this.prepare_dom();
				setTimeout(() => {
					this.make_rooms();
				}, 0)
			},
			() => {
				this.working("Set Configuration");
				this.get_config().then((r) => {
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
				});
			},
			() => {
				frappe.dom.unfreeze();
			},
			() => this.page.set_title(__('Restaurant Manage')),
			() => this.listeners_server(),
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
			//frappe.msgprint(__("POS Profile is required to use Point-of-Sale"));
			frappe.throw(this.not_has_pos_profile_message());
		}
	}

	not_has_pos_profile_message(){
		return __("POS Profile is required to use Point-of-Sale");
	}

	prepare_dom() {
		this.rooms_container = new JSHtml({
			tag: "div", properties: {class: "floor-selector"}
		})

		this.tables_container = new JSHtml({
			tag: "div", properties: {class: "table-container"}
		})

		let add_table = new JSHtml({
			tag: "button", properties: {class: "btn btn-info btn-flat"},
			content: `<span class="fa fa-plus"/> <small>${__("Table")}</small></span>`
		}).on("click", () => {
			event.stopPropagation();
			this.add_object("Table");
		})

		let add_production_center = new JSHtml({
			tag: "button", properties: {class: "btn btn-info btn-flat"},
			content: `<span class="fa fa-plus"/> <small>${__("P Center")}</small></span>`
		}).on("click", () => {
			event.stopPropagation();
			this.add_object("Production Center");
		})

		this.wrapper.append(`
			<div class="restaurant-manage" onmouseup="RM.unselect_all_tables();">
				${this.rooms_container.html()}
				<div class="floor-map">
					<div class="floor-map-editor pull-right" style="display: none">
						<div class="edit-bar hide">
							${add_table.html()}
							${add_production_center.html()}
						</div>
					</div>
					${this.tables_container.html()}
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
		frappe.call({
			method: this.url_manage + "get_rooms",
			always: (r) => {
				$("body").show();
				this.rooms = r.message;
				this.render_rooms();
				this.ready();
			},
		});
	}

	render_rooms(current=false){
		let room_from_url = null;
		this.rooms_container.empty();

		this.rooms.forEach((room, index, rooms) => {
			if(typeof window[room.name] == "undefined"){
				window[room.name] = new RestaurantRoom(room);
			}else{
				window[room.name].data = room;
			}
			window[room.name].render();

			if(current === false){
				if (this.current_room == null) {
					if(typeof window[this.get_room_from_url()] == "undefined"){
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

		this.general_edit_button = new JSHtml({
			tag: "div",
			properties: {class: `btn-default button general-editor-button ${this.editing ? 'active' : ''}`},
			content: `<span class="fa fa-pencil"/>`
		}).on("click", () => {
			event.stopPropagation();
			this.set_edit_status();
		})

		this.add_room_button = new JSHtml({
			tag: "div",
			properties: {
				class: `btn-default button general-editor-button ${this.editing ? 'active' : ''}`,
				style: `display: ${this.editing ? 'block' : 'none'}`
			},
			content: `<span class="fa fa-plus"/>`
		}).on("click", () => {
			event.stopPropagation();
			this.add_object("Room");
		})

		this.rooms_container.prepend(
			this.general_edit_button.html()
		)

		$(".floor-map-editor").show();

		setTimeout(() => {
			if(this.current_room != null)
				this.current_room.hide_tables();

			this.current_room = window[room_from_url];

			if (this.current_room != null) {
				this.current_room.select();
			}
		}, 0)

		this.config_button = new JSHtml({
			tag: "div",
			properties: {class: `btn-default button general-editor-button ${this.editing ? 'active' : ''}`},
			content: `<span class="fa fa-cog"/>`
		}).on("click", () => {
			event.stopPropagation();
		})

		this.rooms_container.append(
			this.add_room_button.html() +
			this.config_button.html()
		);

		setTimeout(() =>{
			if(!this.permissions.restaurant_object.write){
				this.general_edit_button.disable().hide();
			}
		}, 0)
	}

	get_config() {
		return frappe.xcall(this.url_manage + "get_config", {})
	}

	in_rooms(f){
		this.rooms.forEach((room, index, rooms) => {
			if (typeof window[room.name] != "undefined") {
				f(window[room.name])
			}
		})
	}

	listeners_server(){
		frappe.realtime.on("notify_to_check_command", (data) => {
			data.commands_food.forEach((command_food) => {
				data.productions_center.forEach((production_center) => {
					if (typeof window["process_manage_" + production_center] != "undefined") {
						window["process_manage_" + production_center].check_item(command_food);
					}
				})
				data.orders.forEach((order) => {
					if (typeof window[order] != "undefined") {
						window[order].check_item(command_food);
					}
				})
			})
		})

		frappe.realtime.on("pos_profile_update", (data) => {
			if(data && data.has_pos){
				this.pos_profile = data.pos;
			}else{
				this.pos_profile = null;
				this.raise_exception_for_pos_profile();
			}
		})
	}

	add_object(t){
		if(t === "Room"){
			this.add_room();
		}else if(this.current_room != null){
			this.current_room.add_object(t);
		}
	}

	add_room(t){
		this.working("Add Room");
		frappe.call({
			method: this.url_manage + "add_room",
			always: (r) => {
				this.ready();
				this.rooms = r.message.rooms;
				this.render_rooms(r.message.current_room);
			},
		});
	}

	set_edit_status(){
		if(!this.permissions.restaurant_object.write) return;
		if(this.editing){
			this.editing = false;
			this.general_edit_button.remove_class("active");
			this.add_room_button.remove_class("active").hide();

			$(".floor-selector").removeClass("active");
			$(".floor-map").removeClass("active");
			$(".edit-bar").addClass("hide");
			this.unselect_all_tables();
		}else{
			this.editing = true;
			this.general_edit_button.add_class("active");
			this.add_room_button.add_class("active").show();

			$(".floor-selector").addClass("active");
			$(".floor-map").addClass("active");
			$(".edit-bar").removeClass("hide");
		}
	}

	get_room_from_url(){
		return frappe.urllib.get_arg("restaurant_room");
	}

	unselect_all_tables(){
		if(this.current_room != null){
			this.current_room.unselect_all_tables();
		}
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
				}
			</style>`
		)
	}

	delete_current_room(){
		this.current_room = null;
		window.location.href = "/desk#restaurant-manage";
	}

	working(text, busy=true, async_process=false){
		this.busy = busy;
		this.async_process = async_process;
		this.wrapper.find(".restaurant-manage-status").empty().append(__(text));
	}

	ready(message=false, sound=false){
		this.busy = false;
		if(typeof RM.transfer_order != "undefined"){
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
			})
			return true;
		}
		return false;
	}

	notification(indicator="red", message=""){
		frappe.show_alert({
			indicator: indicator,
			message: __(message)
		})
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

	uuid() {
		let id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
			var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
			return v.toString(16);
		});

		return "obj-" + id;
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
				})
			}

			if (record == null) {
				if(r === false){
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

			if (model === 'pos') {
				if (r) r = this.pos_profile["allow_" + action] === 1;
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
}