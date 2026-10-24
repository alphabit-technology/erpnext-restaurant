//LAST Modified 18-08-2026

//import PrintHelper from '../../../../../angola_erp/angola_erp/public/js/print_helper';

class TableOrder {
	constructor(options) {
		Object.assign(this, options);

		this.items = [];
		this.edit_form = null;
		this.divide_account_modal = null;
		this.pay_form = null;
		this.current_item = null;
		this.button = null;
		this.item_pending_to_send_status = ["Adding", null, undefined, ""];
		this.make();

		RM.object(this.data.name, this);
		window.test_order = this;
	}


	make_invoice() {
		//this.invoice = new Invoice(this.data);
	}

	reset_data(data, action) {
		console.log('TABLE ORDER - RESET DATAAAAA');
		this.data = data.order.data;
		if (this.data.show_in_pos !== 1) {
			this.remove();
			return;
		}

		this.check_items({
			items: data.items,
			current: this.current_item,
			action: action
		});

		if (this.order_manage.is_same_order(this)) {
			this.render();
		} else {
			this.show_items_count();
		}
	}

	remove() {
		this.order_manage.delete_order(this.data.name);
	}

	make() {
		setTimeout(() => {
			if (this.button) this.button.remove();
			let font_color = "";

			if (!RM.check_permissions("order", this, "write")) {
				font_color = `color: ${RM.restrictions.color};`;
			}

			this.container = frappe.jshtml({
				tag: "div",
				properties: { style: "display: none;", class: `order-entry-container` },
				wrapper: this.order_manage.order_entry_container
			});

			this.button = frappe.jshtml({
				tag: "button",
				properties: {
					class: "btn btn-app btn-lg btn-order",
					style: `${font_color}; background-color: var(--fill_color)`
				},
				content: this.content,
				text: this.data.items_count,
				wrapper: this.order_manage.order_container,
			}).on("click", () => {
				if (RM.busy_message()) {
					return;
				}
				this.select();
			});
		}, 0);
	}

	get content() {
		const background_color = `background-color: ${RM.check_permissions("order", this, "write") ? '' : RM.restrictions.color};`;
		return `<span class='badge badge-tag' style="${background_color}">{{text}}</span>${this.data.short_name}`;
	}

	hide_items() {
		this.in_items((item) => {
			item.hide();
		});
	}

	delete_items() {
		this.in_items((item, key) => {
			item.remove();
			delete this.items[key];
		});
	}

	select(via_click = true, toggle = true) {
		if (this.data.show_in_pos !== 1) return;
		this.order_manage.current_order = this;

		setTimeout(() => {
			this.order_manage.current_order_identifier = this.data.name;
			this.button.toggle_common('btn-order', 'selected');
			this.container.toggle_common('order-entry-container', 'active');

			this.container.show();

			if (via_click) {
				if (!this.data.customer) {
					this.order_manage.components.customer.highlight();
					this.set_customer();
				}
				this.get_items();
			} else {
				this.order_manage.order_status_message("from select order");
				this.order_manage.check_buttons_status();
			}

			if (this.data.customer) {
				this.make_invoice();
			}

			if (RM.crm_customer) {
				this.pay();
			} else {
				toggle && this.order_manage.toggle_main_section("items");
			}

			RM.crm_customer = null;
		}, 0);

		return this;
	}

	in_items(f) {
		let index = 0;
		Object.keys(this.items).forEach((k) => {
			f(this.get_item(k), k, index);
			index++;
		});
	}

	has_queue_items() {
		let has = false;
		this.in_items(item => {
			if (this.item_pending_to_send_status.includes(item.data.status)) {
				has = true;
			}
		});
		return has;
	}

	push_item(new_item) {
		//FIX 31-12-2024
		console.log('TABLE ORDER CLASS - PUSH ITEM');
		if (!this.data.customer) {
			this.order_manage.components.customer.highlight();
			frappe.throw(__("Please set a Customer"));
		}

		let test_item = null;
		this.in_items(item => {
			if (item.data.item_code === new_item.item_code) {
				if (RM.allows_to_edit_item.includes(item.data.status)) {
					item.data.qty += new_item.qty;
					item.data.rate = new_item.rate;
					item.data.price_list_rate = new_item.price_list_rate;
					item.data.is_customizable = new_item.is_customizable;
					item.data.sub_items = new_item.sub_items;
					item.data.item_tax_rate = new_item.item_tax_rate;
					item.data.status = "Pending";
					item.calculate();
					test_item = item;
				}
			}
		});

		test_item = test_item || this.add_locale_item(new_item);
		if (test_item != null) {
			test_item.update();
			test_item.select(true);
		}
		//FIX 31-05-2025
		//this.select();
		//this.get_items();
		//this.select(true,true);
	}

	add_locale_item(item) {
		const identifier = item.identifier;
		this.items[identifier] = new OrderItem({
			identifier: identifier,
			order: this,
			data: Object.assign({ identifier: identifier }, item)
		});

		return this.get_item(identifier);
	}

	render() {
		this.show_items_count();
		this.aggregate();
	}

	aggregate(locale = false) {
		if (this.order_manage.is_same_order(this)) {
			let amount = flt(this.data.amount || 0);
			let tax = flt(this.data.tax || 0);

			if (locale) {
				tax = 0;
				amount = 0;
				this.in_items(item => {
					tax += flt(item.data.tax_amount || 0);
					amount += flt(item.data.amount || 0);
				});

				if (this.data.is_delivery === 1 && this.data.delivery_branch !== 1) {
					tax += flt(this.data.charge_amount || 0);
					amount += flt(this.data.charge_amount || 0);
				}
			}

			this.data.tax = tax;
			this.data.amount = amount;

			this.order_manage.components.Tax.val(`${__("Taxes & Charges")}: ${RM.format_currency(tax)}`);
			this.order_manage.components.Total.val(`${__("Total")}: ${RM.format_currency(amount)}`);

			if (this.pay_form) {
				this.pay_form.set_value("amount", amount);
			}
		}
	}

	check_items(options = {}) {
		const action = options.action || null;
		const current = options.current || this.current_item;

		const items = Object.values(options || {}).reduce((acc, item) => {
			acc.push(...(item && Array.isArray(item.items) ? item.items : []));
			return acc;
		}, []);

		let test_item = null, current_item = null;

		items.forEach((item, index) => {
			test_item = this.get_item(item.identifier) || this.add_locale_item(item);
			if (test_item) {
				test_item.data = item;
				test_item.update(false);

				if (test_item.data.qty > 0) {
					test_item.order = this;
					if (index === items.length - 1 && this.current_item == null) current_item = test_item;
				}
			}
		});

		if ([QUEUE, SPLIT, null].includes(action)) {
			this.debug_items(items);
		}

		if (current != null) current_item = this.get_item(current.data.identifier);

		if (this.order_manage.is_same_order(this)) {
			this.order_manage.order_status_message("from check item");
			setTimeout(() => {
				this.order_manage.check_buttons_status();

				if (current_item == null) {
					if (this.items_count) {
						this.select_first_item();
					} else {
						this.order_manage.check_item_editor_status();
					}
				} else {
					current_item.select(action == null);
				}
			}, 0);
		}
	}

	debug_items(items) {
		const test_items = items.map(item => item.identifier);

		Object.keys(this.items).filter(x => !test_items.includes(x)).forEach((r) => {
			this.delete_item(r);
		});
	}

	get_item(identifier) {
		return this.items[identifier] || null;
	}

	get items_count() {
		return Object.keys(this.items).length;
	}

	items_data() {
		return Object.keys(this.items).map((key) => this.items[key].data);
	}

	scroller() {
		const order_entry_container = this.order_manage.order_entry_container;

		const container_height = order_entry_container.offsetHeight;
		const row_height = (container_height / this.items_count);
		const position_row = (this.find_item_position(this.current_item) * row_height);

		const container = $(this.order_manage.container).find('.panel-order-items')[0];
		container.scrollTo({ top: position_row, behavior: 'smooth' });
	}

	find_item_position(test_item) {
		return Object.keys(this.items).indexOf(test_item.data.identifier);
	}

	get_items() {
		console.log('TABLE ORDER - GET ITEMS.....');

		RM.working(__("Loading items in") + ": " + this.data.name);
		frappeHelper.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "get_items",
			always: (r) => {
				RM.ready();
				if (typeof r.message != "undefined") {
					this.data = r.message.order.data;
					console.log('TABLE ORDER GETITEMS - DATA RETURN')
					console.log(this.data)
					this.render();
					this.check_items({ items: r.message.items });
				}
			},
		});
	}

	delete() {
		if (RM.busy_message()) {
			return;
		}

		RM.working("Deleting Order");
		frappeHelper.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "_delete",
			always: () => {
				RM.ready();
			},
		});
	}

	show_items_count() {
		this.button.val(this.data.items_count);
		this.order_manage.cart_count && this.order_manage.cart_count.text(this.data.items_count);
	}

	divide() {
		if (this.divide_account_modal == null) {
			this.divide_account_modal = new DeskModal({
				model: "Table Order",
				model_name: this.data.name,
				action: "divide_template",
				/*"full_page": true,*/
				from_server: true,
				customize: true,
				adjust_height: 25,
				set_buttons: true,
				callback: () => {
					this.make_divide_account();
				}
			});
		} else {
			this.divide_account_modal.set_buttons = false;
			this.divide_account_modal.show();
			this.divide_account_modal.reload(() => {
				this.make_divide_account(false);
			});
		}
	}

	transfer() {
		RM.working("Transferring Order");
		RM.transfer_order = this;
		this.order_manage.close();
	}

	make_divide_account() {
		if (this.divide_account_modal.set_buttons) {
			RMHelper.return_main_button(
				`${this.data.name} (${__("Divide Account")})`,
				() => this.divide_account_modal.hide(),
				this.divide_account_modal.title_container
			);

			RMHelper.default_button(
				'Divide',
				'ok',
				() => this._divide(),
				DOUBLE_CLICK,
				this.divide_account_modal.buttons_container
			).show();
		}

		Object.keys(this.items).forEach((index) => {
			const item = this.items[index];

			item.in_current_order = item.data.qty;
			item.in_new_order = 0;

			const item_base_name = `${this.data.name}-${item.data.entry_name}`;

			const adds = document.getElementsByClassName(`${item_base_name}-add-item`);

			Object.keys(adds).forEach((key) => {
				let add = adds[key];
				add.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();

					if (item.in_current_order > 0) {
						item.in_current_order--;
						item.in_new_order++;

						this.set_values_in_divide_modal(
							item_base_name,
							{
								"from_qty": item.in_current_order,
								"to_qty": item.in_new_order,
								"rate": item.data.rate,
							}
						);
					}
				});
			});

			const all_minus = document.getElementsByClassName(`${item_base_name}-minus-item`);

			Object.keys(all_minus).forEach((key) => {
				const minus = all_minus[key];
				minus.addEventListener("click", (event) => {
					event.preventDefault();
					event.stopPropagation();
					if (item.in_new_order > 0) {
						item.in_current_order++;
						item.in_new_order--;

						this.set_values_in_divide_modal(
							item_base_name,
							{
								"from_qty": item.in_current_order,
								"to_qty": item.in_new_order,
								"rate": item.data.rate,
							}
						);
					}
				});
			});
		});
	}

	set_values_in_divide_modal(base_name, data = {}) {
		$(`.${base_name}-from-qty`).empty().append(data.from_qty);
		$(`.${base_name}-to-qty`).empty().append(data.to_qty);

		$(`.${base_name}-from-total`).empty().append(
			RM.format_currency(parseFloat(data.from_qty) * parseFloat(data.rate))
		);
		$(`.${base_name}-to-total`).empty().append(
			RM.format_currency(parseFloat(data.to_qty) * parseFloat(data.rate))
		);

		this.aggregate_in_divide_modal();
	}

	aggregate_in_divide_modal() {
		let total_left = 0, total_right = 0;
		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];

			total_left += (item.in_current_order * item.data.rate);
			total_right += (item.in_new_order * item.data.rate);

			$(`.${this.data.table}_${this.data.name}-grand-total-left`).empty().append(
				RM.format_currency(total_left)
			);

			$(`.${this.data.table}_${this.data.name}-grand-total-right`).empty().append(
				RM.format_currency(total_right)
			);
		});
	}

	_divide() {
		const update_data = {};

		if (RM.busy_message()) return;

		Object.keys(this.items).forEach((index) => {
			let item = this.items[index];

			if (item.in_new_order > 0) {
				update_data[item.data.identifier] = {
					'name': item.data.entry_name,
					'qty': item.in_new_order,
					'identifier': "entry_" + RM.uuid()
				};
			}
		});

		if (Object.keys(update_data).length) {
			RM.working("Dividing Account");
			frappeHelper.api.call({
				model: "Table Order",
				name: this.data.name,
				method: "divide",
				args: { "items": update_data, client: RM.client },
				always: (r) => {
					RM.ready();
					if (typeof r.message != "undefined") {
						this.divide_account_modal.hide();
					}
				}
			});
		} else {
			frappe.msgprint(__('You have not selected products'))
		}
	}

	order() {
		//FIX 24-12-2024;
		console.log('table order - ORDER');
		console.log ('ORDERED =>>>>>> ', this.data.name);

		if (RM.busy_message() || this.data.products_not_ordered <= 0) {
			return;
		}

		RM.working("Send order to Prepare");

		frappeHelper.api.call({
			model: "Table Order",
			name: this.data.name,
			method: "send",
			always: (r) => {
				this.order_manage.components.Order.remove_class("btn-warning");
				RM.ready(false, "success");
				this.data = r.message.order.data;
				this.render();
				this.check_items({ items: r.message.items });

				console.log('AO RETORNAR....');
				console.log('data ', this.data);

				//use Print NODE
				if (this.data.status == "Attending") {
					//FIX 02-05-2025
					locals['Table Order'] = this.data;
					frappe.model.get_value('Restaurant Settings',{'name': 'Restaurant Settings'}, 'ngrok_or_pinggy_address',
						function(d) {
							console.log('TEM VALOR DO NGROK');
							console.log(d)
							const apiBaseUrl = d.ngrok_or_pinggy_address;
	
							//Moved inside here
			
							//TESTE using ESC/POS
							frappe.call({
								method: "angola_erp.util.angola.generate_barkit_escpos_print",
								args: {
									server_url: apiBaseUrl,
									doctype: 'Table Order',
									docname: locals['Table Order'].name //FIX 02-06-2025 this.data.name
								},
								callback: function(response) {
									if (response.message) {
										console.log('response ESCPOS and Print')
										console.log(response.message)                
									}
								}
							})
						});

				}

			},
		});
	}

	get delivery_charges() {
		return flt(this.data.charge_amount || 0);
	}

	get amount() {
		return flt(this.data.amount || 0);
	}

	get total_money() {
		return RM.format_currency(this.amount);
	}

	validate_items() {
		let valid = false;
		Object.keys(this.items).forEach((index) => {
			const item_in_order = this.items[index];
		});

		return valid;
	}

	async pay() {
		if (RM.busy && !RM.crm_customer) return;

		if (RM.pos_profile == null) {
			frappe.msgprint(RM.not_has_pos_profile_message());
		} else if (RM.pos_profile.payments.length === 0) {
			frappe.msgprint(__("There are no configured payment methods"));
		} else {
			this.validate_items();

			if (this.pay_form == null) {
				//this.order_manage.invoice_wrapper.JQ().empty();

				this.pay_form = new PayForm({
					order: this,
					//location: this.order_manage.invoice_wrapper.JQ()
				});
			} else {
				//await this.pay_form.reload(null, true);
				this.pay_form.show();
			}

			//this.order_manage.toggle_main_section();
		}
	}

	async OLD_baseURL() {
		frappe.model.get_value('Restaurant Settings',{'name': 'Restaurant Settings'}, 'ngrok_or_pinggy_address',
			function(d) {
				console.log('TEM VALOR DO NGROK!!!!');
				console.log(d)
				return d.ngrok_or_pinggy_address;
			}
		)
	}

	async baseURL() {
			return new Promise((resolve, reject) => {
					frappe.model.get_value('Restaurant Settings', {'name': 'Restaurant Settings'}, 'ngrok_or_pinggy_address',
							function(d) {
									if (d && d.ngrok_or_pinggy_address) {
											console.log('Got ngrok address:', d);
											resolve(d.ngrok_or_pinggy_address);
									} else {
											//reject(new Error('No ngrok/pinggy address found'));
											console.log('No ngrok/pinggy address found, returning empty string');
											resolve('');
									}
							}
					);
			});
	}

	//FIX 19-10-2026; Get Print format
	async default_Printformat() {
			return new Promise((resolve, reject) => {
					frappe.model.get_value('Restaurant Settings', {'name': 'Restaurant Settings'}, 'print_format',
							function(d) {
									if (d && d.print_format) {
											console.log('Got Print format:', d);
											resolve(d.print_format);
									} else {
											//reject(new Error('No ngrok/pinggy address found'));
											console.log('No Print format found, returning default string');
											resolve('Order Account');
									}
							}
					);
			});
	}

	// Fixed print_account method
	async print_account() {
		try {
			console.log('print account....');
			const baseUrl = await this.baseURL();
			//FIX 19-10-2026
			const defaultPrintFormat = await this.default_Printformat();

			const docname = this.data.name;

			

			const title = this.data.name + " (" + __("Account") + ")";
			const order_manage = this.order_manage;
			const props = {
				model: "Table Order",
				model_name: this.data.name,
				from_server: true,
				args: {
					format: defaultPrintFormat,
					_lang: RM.lang,
					no_letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 1,
					letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 'No%20Letterhead'
				},
				set_buttons: true,
				is_pdf: true,
				customize: true,
				title: title
			}
			console.log('print account....');
			
			var order_print = "";
			var ficha_tec = "";
			var orderprint  = "";

			console.log('Base URL:', baseUrl);
			console.log('Docname:', docname);
			
			// Use a wrapper function to handle the callback properly
			await new Promise((resolve, reject) => {
				frappe.model.with_doc('Table Order', docname, function() {
					try {
						// Get all keys from locals['Table Order']
						const keys = Object.keys(locals['Table Order']);
						console.log('Keys:', keys);
						
						if (keys.length === 0) {
							reject(new Error('No Table Order document found in locals'));
							return;
						}
						
						// Get the last key
						const d = keys[keys.length - 1];
						console.log('Document key:', d);
						
						// Get the document
						const fichatec = frappe.model.get_doc('Table Order', d);
						ficha_tec = fichatec;
						console.log('Document loaded:', ficha_tec.name);
						
						resolve(ficha_tec);
					} catch (error) {
						reject(error);
					}
				});
			});
			
			// Now ficha_tec should be available
			if (!ficha_tec || !ficha_tec.name) {
				frappe.msgprint(__('Table Order document not found'));
				return false;
			}
			
			// Continue with printing logic based on baseUrl
			if (baseUrl) {
				console.log('Using ngrok/pinggy address:', baseUrl);
				// Your printing logic with ngrok/pinggy
				await this.printWithNgrok(baseUrl);
			} else {
				console.log('Using local printer');
				// Your printing logic without ngrok/pinggy
				await this.printWithLocalPrinter(ficha_tec,props,title);
			}
			
		} catch (error) {
			console.error('Print error:', error);
			frappe.msgprint(__('Error printing: ') + error.message);
			return false;
		}
	}

	// Helper method for printing with ngrok/pinggy
	async printWithNgrok(baseUrl) {
		try {
			// Check printer
			const printerStatus = await PrintHelper.checkPrinter();
			if (!printerStatus.available) {
				frappe.msgprint(__('Printer not available: ') + printerStatus.message);
				return false;
			}
			/*
			// Generate buffer
			const bufferResult = await PrintHelper.generateBuffer(
				'Table Order',
				ficha_tec.name,
				ficha_tec.company,
				{ 
					server_url: baseUrl,
					freeze: true 
				}
			);

			if (!bufferResult.success) {
				frappe.msgprint(__('Failed to generate receipt: ') + (bufferResult.error || ''));
				return false;
			}
			*/

			console.log('TEM VALOR DO NGROK');

			//const apiBaseUrl = d.ngrok_or_pinggy_address;

			//Moved inside here
			let dialog = new frappe.ui.Dialog({
				title: 'Selecione a Impressora',
				primary_action_label: 'Impressora BAR 01', // Custom text for the primary button
				primary_action: function() {
					console.log('Selecionou Printer 01');

					//TESTE using ESC/POS
					frappe.call({
						method: "angola_erp.util.angola.generate_escpos_and_print",
						args: {
							server_url: baseUrl,
							doctype: 'Table Order',
							docname: ficha_tec.name,
							company_info: ficha_tec.company,
							to_printer: 1,
							logo_path: '/files/logo.png'
						},
						callback: function(response) {
							if (response.message) {
								console.log('response ESCPOS and Print')
								console.log(response.message)                
							}
						}
					})

					dialog.hide();

				}
			});
		
			// Adding a custom secondary button
			dialog.set_secondary_action(function() {
					console.log('Selecionou Printer 02');

					//TESTE using ESC/POS
					frappe.call({
						method: "angola_erp.util.angola.generate_escpos_and_print",
						args: {
							server_url: baseUrl,
							doctype: 'Table Order',
							docname: ficha_tec.name,
							company_info: ficha_tec.company,
							to_printer: 2,
							logo_path: '/files/logo.png'
						},
						callback: function(response) {
							if (response.message) {
								console.log('response ESCPOS and Print')
								console.log(response.message)                
							}
						}
					})

					dialog.hide();
			});
			dialog.set_secondary_action_label('Impressora BAR 02'); // Custom text for the secondary button
			dialog.show();

			/*
			// Print
			const result = await PrintHelper.printUSB(bufferResult.buffer);
			
			if (result.success) {
				frappe.msgprint(__('Receipt printed successfully!'));
				return true;
			} else {
				frappe.msgprint(__('Failed to print receipt: ') + (result.error || ''));
				return false;
			}
				*/

		} catch (error) {
			console.error('Ngrok printing error:', error);
			throw error;
		}
	}

	// Helper method for local printing
	async printWithLocalPrinter(ficha_tec,props,title) {
		try {
			// Check printer
			const printerStatus = await PrintHelper.checkPrinter();
			if (!printerStatus.available) {
				// Offer browser fallback
				/*
				const useFallback = await frappe.confirm(
					__('Printer not available. Would you like to print via browser?')
				);
				*/

				/*
				if (useFallback) {
					return await this.printViaBrowser(ficha_tec);
				}
				*/

				//return await this.printViaBrowser(ficha_tec);
				return await this.printViaBrowser(ficha_tec,ficha_tec.doctype,ficha_tec.name,props);
				
				//return await this.printViaFrappeform(ficha_tec,props,title);
				//return false;
			}

			// Generate buffer
			const bufferResult = await PrintHelper.generateBuffer(
				'Table Order',
				ficha_tec.name,
				ficha_tec.company,
				{ freeze: true }
			);

			if (!bufferResult.success) {
				frappe.msgprint(__('Failed to generate receipt: ') + (bufferResult.error || ''));
				return false;
			}

			// Print
			const result = await PrintHelper.printUSB(bufferResult.buffer);
			
			if (result.success) {
				frappe.msgprint(__('Receipt printed successfully!'));
				return true;
			} else {
				// Offer browser fallback if USB fails
				const useFallback = await frappe.confirm(
					__('USB printing failed. Would you like to print via browser?')
				);
				
				if (useFallback) {
					return await this.printViaBrowser(ficha_tec);
				}
				return false;
			}
		} catch (error) {
			console.error('Local printing error:', error);
			throw error;
		}
	}

	async printViaFrappeform(order_manage,props,title) {
		if (order_manage.print_modal) {
			order_manage.print_modal.set_props(props);
			order_manage.print_modal.set_title(title);
			order_manage.print_modal.reload().show();
		} else {
			order_manage.print_modal = new DeskModal(props);
		}
		return true;
	}

	// Browser printing fallback
	//FIX 19-10-2026; Added default_Printformat
	async printViaBrowser(doc,doctype=null,docname=null,default_Printformat=null) {
		try {
			const bufferResult = await PrintHelper.generateBuffer(
				'Table Order',
				doc.name,
				doc.company
			);
			
			if (!bufferResult.success) {
				throw new Error(bufferResult.error);
			}
			
			//const result = await PrintHelper.printViaBrowser(bufferResult.buffer);
			const result = await PrintHelper.printViaBrowser(doctype,docname,default_Printformat);
			
			if (result.success) {
				console.log('Print dialog opened');
				/*
				frappe.msgprint({
					title: __('Success'),
					message: __('Print dialog opened'),
					indicator: 'green'
				});
				*/
			}
			
			return result.success;
		} catch (error) {
			console.error('Browser printing error:', error);
			frappe.msgprint(__('Browser printing failed: ') + error.message);
			return false;
		}
	}

	async print_account_V0() {
		//FIX 18-08-2026
		const baseUrl = await this.baseURL();
		//FIX 19-10-2026
		const defaultPrintFormat = await this.default_Printformat();

		const docname = this.data.name;

		const title = this.data.name + " (" + __("Account") + ")";
		const order_manage = this.order_manage;
		const props = {
			model: "Table Order",
			model_name: this.data.name,
			from_server: true,
			args: {
				format: defaultPrintFormat,
				_lang: RM.lang,
				no_letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 1,
				letterhead: RM.pos_profile.letter_head ? RM.pos_profile.letter_head : 'No%20Letterhead'
			},
			set_buttons: true,
			is_pdf: true,
			customize: true,
			title: title
		}
		console.log('print account....');
		
		var order_print = "";
		var ficha_tec = "";
		var orderprint  = "";

		//console.log('TEM NGOK ', await this.baseURL());
		if (baseUrl) {
			//FIX 16-08-2026
			frappe.model.with_doc('Table Order', this.data.name, function() { 
				//FIX 27-05-2025
				var d = Object.keys(locals['Table Order'])[Object.keys(locals['Table Order']).length-1]
				frappe.model.with_doctype('Table Order', () => {
					let meta = frappe.get_meta("Table Order");
					var fichatec = frappe.model.get_doc('Table Order', d);
					ficha_tec = fichatec; 
					console.log ('ficccc ', ficha_tec.name);      
					/*
					frappe.route_options = {
						//frm: frm,
						print_format_list : ['POS Invoice'],
						print_format_select_val : ['POS Invoice'],
						print_sel : ['POS Invoice'],
						default_print_format : ['POS Invoice'],
						print_format_selector : ['POS Invoice'],
					};
					*/
					
					//frappe.set_route('print', 'Table Order', d);   
					//meta.default_print_format
					//console.log('default template ');
					//console.log(meta.__print_formats[1].html);

					/*        
					let print_template_data = frappe.render_template("print_template", {
						content: meta.__print_formats[1].html, //this.print_template,
						title: "POS TESTE",
						base_url: frappe.urllib.get_base_url(),
						print_css: frappe.boot.print_css,
						print_settings: locals[":Print Settings"]["Print Settings"],
						//header: this.letter_head.header,
						//footer: this.letter_head.footer,
						landscape: false,
						lang: "PT",
						layout_direction: "Portrait",
						columns: []

					})
					console.log(' printe temaple');
					console.log(print_template_data)
			
					
					order_print = print_template_data;
					var aaa  = frappe.render(order_print,ficha_tec)      
					*/

					//let print_template_data = frappe.get_html_and_style(ficha_tec.name,null,"Order_ACC_QUARD",meta,null,null,true,null,null,null);
					/*
					frappe.call({
						"method": "frappe.www.printview.get_html_and_style",
						args: {
							doc :"Table Order",
							name :ficha_tec.name,
							print_format:"Order_ACC_QUARD",
							trigger_print:false,
						},
						callback: function (r) {
							console.log('dbbbbbbbbbb')
							console.log(r);
							//var print_template_data = r.message.html;
							order_print = r.message.html;

							//print ('print template ', print_template_data);
							//order_print = print_template_data;
			
						}
					})
						*/


					//print ('print template ', print_template_data);
					//order_print = print_template_data;

					//orderprint = aaa;

					/*
					var bbb = "<h1>Hello, World!</h1><p>This is a sample content to print.</p>"

					var w = window.open();
					w.document.write('<html><head><title>Print</title></head><body>');
					w.document.write(bbb);
					w.document.write('</body></html>');
					w.document.close();
					setTimeout(function () {
						w.print();
						w.close();
					}, 1000)
					*/  
				}).then((r) => {
					//FIX 27-050-2025; Added two button for PRT-BAR01 and PRT-BAR02
					//fix 01-06-2025
					frappe.model.get_value('Restaurant Settings',{'name': 'Restaurant Settings'}, 'ngrok_or_pinggy_address',
						function(d) {
							console.log('TEM VALOR DO NGROK');
							console.log(d)
							const apiBaseUrl = d.ngrok_or_pinggy_address;

							//Moved inside here
							let dialog = new frappe.ui.Dialog({
								title: 'Selecione a Impressora',
								primary_action_label: 'Impressora BAR 01', // Custom text for the primary button
								primary_action: function() {
									console.log('Selecionou Printer 01');
			
									//TESTE using ESC/POS
									frappe.call({
										method: "angola_erp.util.angola.generate_escpos_and_print",
										args: {
											server_url: apiBaseUrl,
											doctype: 'Table Order',
											docname: ficha_tec.name,
											company_info: ficha_tec.company,
											to_printer: 1,
											logo_path: '/files/logo.png'
										},
										callback: function(response) {
											if (response.message) {
												console.log('response ESCPOS and Print')
												console.log(response.message)                
											}
										}
									})
			
									dialog.hide();
			
								}
							});
						
							// Adding a custom secondary button
							dialog.set_secondary_action(function() {
									console.log('Selecionou Printer 02');

									//TESTE using ESC/POS
									frappe.call({
										method: "angola_erp.util.angola.generate_escpos_and_print",
										args: {
											server_url: apiBaseUrl,
											doctype: 'Table Order',
											docname: ficha_tec.name,
											company_info: ficha_tec.company,
											to_printer: 2,
											logo_path: '/files/logo.png'
										},
										callback: function(response) {
											if (response.message) {
												console.log('response ESCPOS and Print')
												console.log(response.message)                
											}
										}
									})
			
									dialog.hide();
							});
							dialog.set_secondary_action_label('Impressora BAR 02'); // Custom text for the secondary button
							dialog.show();

						}
					)
			

				/*
					//console.log('TERMINOUIadfsadfsfsafsafasfa');

					frappe.call({
						"method": "frappe.www.printview.get_html_and_style",
						args: {
							doc :"Table Order",
							name :ficha_tec.name,
							print_format:"Order_ACC_QUARD",
							trigger_print:false,
						},
						callback: function (r) {
							console.log('dbbbbbbbbbb')
							console.log(r);
							//var print_template_data = r.message.html;
							order_print = r.message.html;
							let print_template_data = frappe.render_template("print_template", {
								content: order_print, //this.print_template,
								title: "POS TESTE",
								base_url: frappe.urllib.get_base_url(),
								print_css: frappe.boot.print_css,
								print_settings: locals[":Print Settings"]["Print Settings"],
								//header: this.letter_head.header,
								//footer: this.letter_head.footer,
								landscape: false,
								lang: "PT",
								layout_direction: "Portrait",
								columns: []
			
							})
			
							//console.log('aaaaaaa ', print_template_data);
							
							var w = window.open();
							w.document.write(print_template_data);
							w.document.close();
							setTimeout(function () {
								w.print();
								w.close();
							}, 1000)

							
							
			
						}
					})

					*/
			
				});
		
			})

		} else {
			frappe.model.with_doc('Table Order', this.data.name, function() { 
				//FIX 27-05-2025
				var d = Object.keys(locals['Table Order'])[Object.keys(locals['Table Order']).length-1]
				
				(async () => {
					try {
						// Get the document
						await frappe.model.with_doctype('Table Order', () => {
							let meta = frappe.get_meta("Table Order");
							var fichatec = frappe.model.get_doc('Table Order', d);
							ficha_tec = fichatec; 
							console.log('Table Order document:', ficha_tec.name);      
						});
						
						if (!ficha_tec || !ficha_tec.name) {
							frappe.msgprint(__('Table Order document not found'));
							return;
						}
						
						//FIX 18-08-2026; Testing 
						// Check printer availability
						const printerStatus = await PrintHelper.checkPrinter();
						if (!printerStatus.available) {
							// Ask if user wants to use browser fallback
							const useFallback = await frappe.confirm(
								__('Printer not available: ') + printerStatus.message +
								__('\n\nWould you like to print via browser instead?')
							);
							
							if (useFallback) {
								// Try browser printing
								const bufferResult = await PrintHelper.generateBuffer(
									'Table Order',
									ficha_tec.name,
									ficha_tec.company
								);
								
								if (bufferResult.success) {
									const browserResult = await PrintHelper.printViaBrowser(bufferResult.buffer);
									if (browserResult.success) {
										console.log('Print dialog opened');
										/*
										frappe.msgprint({
											title: __('Success'),
											message: __('Print dialog opened'),
											indicator: 'green'
										});
										*/
									} else {
										frappe.msgprint({
											title: __('Error'),
											message: __('Browser printing failed: ') + browserResult.error,
											indicator: 'red'
										});
									}
								}
							}
							return;
						}

						// Show progress indicator
						frappe.show_alert({
							message: __('Generating receipt...'),
							indicator: 'blue'
						});

						// Generate buffer
						const bufferResult = await PrintHelper.generateBuffer(
							'Table Order',
							ficha_tec.name,
							ficha_tec.company,
							{ freeze: true }
						);

						if (!bufferResult.success) {
							// Show modal if there was an error
							if (order_manage.print_modal) {
								order_manage.print_modal.set_props(props);
								order_manage.print_modal.set_title(title);
								order_manage.print_modal.reload().show();
							} else {
								order_manage.print_modal = new DeskModal(props);
							}
							
							frappe.msgprint({
								title: __('Error'),
								message: __('Failed to generate receipt: ') + (bufferResult.error || ''),
								indicator: 'red'
							});
							return;
						}

						// Show progress indicator
						frappe.show_alert({
							message: __('Sending to printer...'),
							indicator: 'blue'
						});

						// Print
						const result = await PrintHelper.printUSB(bufferResult.buffer, {
							retryAttempts: 2
						});
						
						if (result.success) {
							frappe.show_alert({
								message: __('Receipt printed successfully!'),
								indicator: 'green'
							});
						} else {
							// If USB fails, offer browser fallback
							const useFallback = await frappe.confirm(
								__('USB printing failed: ') + (result.error || '') +
								__('\n\nWould you like to try printing via browser instead?')
							);
							
							if (useFallback) {
								const browserResult = await PrintHelper.printViaBrowser(bufferResult.buffer);
								if (browserResult.success) {
									console.log('Print dialog opened');
									/*
									frappe.msgprint({
										title: __('Success'),
										message: __('Print dialog opened'),
										indicator: 'green'
									});
									*/
								} else {
									frappe.msgprint({
										title: __('Error'),
										message: __('Browser printing failed: ') + browserResult.error,
										indicator: 'red'
									});
								}
							} else {
								frappe.msgprint({
									title: __('Error'),
									message: __('Failed to print receipt: ') + (result.error || ''),
									indicator: 'red'
								});
							}
						}
						
					} catch (error) {
						console.error('Printing error:', error);
						
						// Show modal if there was an error
						if (order_manage.print_modal) {
							order_manage.print_modal.set_props(props);
							order_manage.print_modal.set_title(title);
							order_manage.print_modal.reload().show();
						} else {
							order_manage.print_modal = new DeskModal(props);
						}
						
						frappe.msgprint({
							title: __('Error'),
							message: __('Failed to print: ') + error.message,
							indicator: 'red'
						});
					}
				})();
			});


		}

	
		/*
		REMOVED FOR NOW

		if (order_manage.print_modal) {
			order_manage.print_modal.set_props(props);
			order_manage.print_modal.set_title(title);
			order_manage.print_modal.reload().show();
		} else {
			order_manage.print_modal = new DeskModal(props);
		}
			*/
	}

	set_customer() {
		//FIX 20-12-2024
		console.log('DIGITA O CLIENTE');
		this.edit("customer");
	}

	set_dinners() {
		this.edit("dinners");
	}

	edit(type) {
		const form = type + "_form";
		if (this[form]) {
			this[form].reload();
			this[form].show();
		} else {
			if (type === "customer"/* && RM.crm_customer*/) {
				if (this.customer_editor == null) {
					this.customer_editor = new CustomerEditor({
						order: this,
						//location: this.order_manage.invoice_wrapper.JQ()
					});
				} else {
					this.customer_editor.reload();
					this.customer_editor.show();
				}
			} else {
				this[form] = new DeskForm({
					form_name: `restaurant-order-${type}`,
					doc_name: this.data.name,
					callback: self => {
						self.hide();

						RM.sound_submit();
						this.data[type] = self.get_value(type);
						this.make_invoice();
					},
					title: __(`Set ${type}`),
					after_load: self => {
						const input = self.get_field(type);
						input.set_focus();
					}
				});
			}
		}
	}

	delete_current_item() {
		this.current_item = null;
		this.order_manage.check_buttons_status();
	}

	select_first_item() {
		this.in_items((item, k, index) => {
			if (index === 0) item.select();
		});
	}

	is_some_item(item1, item2) {
		return item1 != null && item1.data.identifier === item2.data.identifier;
	}

	delete_item(identifier) {
		const item = this.get_item(identifier);
		if (item) {
			if (this.is_some_item(this.current_item, item)) {
				this.delete_current_item();
			}
			item.remove();
			delete this.items[identifier];
		}
	}

	get_delivery_address() {
		const address = this.data.address

		return new Promise(resolve => {
			if (address.length === 0) {
				resolve({});
			}

			frappeHelper.api.call({
				model: "Table Order",
				name: this.data.name,
				method: "get_delivery_address",
				args: { address },
				always: (r) => {
					if (r.message) {
						resolve(r.message)
					}
				}
			});
		});
	}
}

class CustomerEditor extends DeskForm {
	form_name = "Restaurant Order Customer";
	constructor(props) {
		super(props);
		this.doc_name = this.order.data.name;
		this.title = __("Set Customer");

		super.initialize();
	}

	save() {
		super.save({
			success: () => {
				this.hide();
				if (this.order.pay_form) {
					this.order.order_manage.toggle_main_section("pay");
					this.order.pay_form.set_value("customer", this.get_value("customer"));
				} else {
					this.order.pay();
				}
			}
		});
	}

	async make() {
		await super.make();

		this.on(["address"], "change", (field) => {
			this.get_delivery_address();
		});

		this.on("customer", "change", (field) => {
			this.set_field_property("address", "get_query", () => {
				return {
					filters: {
						'link_doctype': 'Customer',
						'link_name': field.get_value(),
					}
				}
			});
		});

		this.on("customer_primary_address", "change", (field) => {
			this.set_value("address", field.get_value());
		});

		this.get_field("customer_primary_address").$wrapper.hide();

		this.hide_field(["address", "delivery_address"]);

		setTimeout(() => {
			this.trigger(["customer_primary_address"], "change");
		}, 0);
	}

	async get_delivery_address() {
		this.order.data.address = this.get_value("address");
		const address = await this.order.get_delivery_address();

		this.set_value("delivery_address", address.address || "");
	}
}