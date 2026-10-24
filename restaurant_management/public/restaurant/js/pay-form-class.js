//LAST Modified: 29-07-2025
class PayForm extends DeskForm {
	payment_methods = {};
	form_name = "Payment Order";
	has_primary_action = false;

	constructor(options) {
		super(options);

		this.doc_name = this.order.data.name;
		this.title = this.order.data.name;
		this.primary_action = () => {
			this.send_payment();
		};

		this.primary_action_label = __("Pay");

		super.initialize();
	}

	on_reload() {
		this.trigger("is_delivery", "change");
		this.trigger("customer_primary_address", "change");
	}

	get is_delivery() {
		return this.get_value("is_delivery") === 1;
	}

	async set_order_value(fieldname, value) {
		return new Promise(resolve => {
			frappeHelper.api.call({
				model: "Table Order",
				name: this.order.data.name,
				method: "set_" + fieldname,
				args: { fieldname: value },
				always: (r) => {
					resolve(r);
				}
			});
		});
	}

	async make() {
		await super.make();

		this.init_synchronize();

		const set_address_query = () => {
			this.set_field_property("address", "get_query", () => {
				return {
					filters: {
						'link_doctype': 'Customer',
						'link_name': this.get_value("customer"),
					}
				}
			});
		}

		this.on("charge_amount", "change", (field) => {
			if (this.order.data.charge_amount !== field.get_value()) {
				this.order.data.is_delivery = this.get_value("is_delivery");
				this.order.data.delivery_branch = this.get_value("delivery_branch");
				this.order.data.charge_amount = field.get_value();
				this.order.aggregate(true);

				super.save({}, true);
			}
		});

		this.on("related_branch", "change", (field) => {
			this.set_value("branch", field.get_value());
		});

		this.on(["delivery_branch", "address"], "change", () => {
			const set_reqd_status = delivery_branch => {
				if (this.is_delivery) {
					if (delivery_branch) {
						this.set_field_property(["delivery_date", "pick_time", "branch"], "reqd", 1);
						this.set_field_property("address", "reqd", 0);
					} else {
						this.set_field_property(["delivery_date", "pick_time", "branch"], "reqd", 0);
						this.set_field_property("address", "reqd", 1);
					}
				} else {
					this.set_field_property(["delivery_date", "pick_time", "branch", "address"], "reqd", 0);
				}
			}

			if (this.get_value("delivery_branch") === 1) {
				this.set_field_property("branch", {
					read_only: 0,
					reqd: 1,
				});

				set_reqd_status(this.get_value("delivery_branch") === 1);

				["delivery_date", "pick_time"].forEach(fieldname => {
					this.get_field(fieldname).$wrapper.show();
				});

				["delivery_address", "charge_amount"].forEach(fieldname => {
					this.get_field(fieldname).$wrapper.hide();
				});
			} else {
				this.set_field_property("branch", {
					read_only: 1,
					reqd: 0,
				});

				set_reqd_status(this.get_value("delivery_branch") === 1);

				["delivery_date", "pick_time"].forEach(fieldname => {
					this.get_field(fieldname).$wrapper.hide();
				});

				["delivery_address", "charge_amount"].forEach(fieldname => {
					this.get_field(fieldname).$wrapper.show();
				});
			}

			this.get_delivery_address();
		});

		const set_related = (from, to) => {
			const from_value = this.get_value(from);
			this.set_value(to, from_value);
		}

		this.on("is_delivery", "change", (field) => {
			if (field.get_value() === 1) {
				this.get_field("delivery_options").wrapper[0].style.display = "block";
				this.set_field_property("dinners", "reqd", 0);
				this.get_field("dinners").$wrapper.hide();
			} else {
				this.get_field("delivery_options").wrapper[0].style.display = "none";;
				this.set_field_property(["delivery_date", "pick_time", "branch", "address"], "reqd", 0);
				//FIX 15-12-2024; SET DINNERS default to 0;
				//FIX 15-12-2024; HIDE as we dont need for NOW
				console.log('set Dinners 0');
				this.set_value('dinners', 0);
				this.set_field_property("dinners", "reqd", 0);
				this.get_field("dinners").$wrapper.hide();
			}

			this.trigger("charge_amount", "change");
		});

		this.on("customer", "change", () => {
			this.order.data.customer = this.get_value("customer");
		});

		this.on("customer_primary_address", "change", () => {
			set_related("customer_primary_address", "address");
		});

		this.on("address_branch", "change", () => {
			set_related("address_branch", "branch");
		});

		this.get_field("notes").input.style.height = "80px";
		this.get_field("column").$wrapper.css("height", "37px");

		this.hide_support_elements();

		set_address_query();

		this.make_actions();

		setTimeout(() => {
			this.disable_input("payment_button", !RM.can_pay);
			this.trigger(["delivery_branch", "is_delivery"], "change");
		}, 0);
		setTimeout(() => {
			this.make_inputs();
		}, 300);
	}

	make_actions() {
		[
			{ name: "save", label: "Save", type: "success" },
			{ name: "send_order", label: "Order", type: "success", icon: "fa fa-cutlery" },
			{ name: "cancel", label: "Cancel", type: "danger", icon: "fa fa-times" },
			{ name: "pay", label: "Pay", type: "primary", icon: "fa fa-money", confirm: !RM.restrictions.to_pay ? DOUBLE_CLICK : null },
		].forEach(action => {
			this.add_action(action, () => {
				this[action.name]();
			});
		});

		this.actions.pay.prop("disabled", !RM.can_pay);
	}

	/**Actions **/
	save() {
		super.save({
			success: () => {
				this.order.select(true, false);
				RM.ready("Order Placed");
			}
		});
	}

	send_order() {
		frappe.confirm(__("This action sent all order to Production Center,<br><strong>Do you want to continue?</strong>"), () => {
			frappe.db.set_value("Table Order", this.order.data.name, "status", "Sent");
		});
	}

	cancel() {
		frappe.confirm(__("Do you want to cancel Order?</strong>"), () => {
			frappe.db.set_value("Table Order", this.order.data.name, "status", "Cancelled");
		});
	}

	pay() {
		if (!RM.can_pay) return;
		this.actions.pay.disable().val(__("Paying"));
		this.send_payment();
	}
	/**Actions */

	disable_input(input, value = true) {
		const field = this.get_field(input);
		field && field.input && (field.input.disabled = value);
	}

	enable_input(input) {
		const field = this.get_field(input);
		field && field.input && (field.input.disabled = false);
	}

	hide_support_elements() {
		["customer_primary_address", "address_branch", "related_branch", "amount"].forEach(fieldname => {
			this.get_field(fieldname).$wrapper.hide();
		});
	}

	async get_delivery_address() {
		this.order.data.address = this.get_value("address");

		if (this.get_value("delivery_branch") === 1) {
			this.set_value("delivery_address", "");
			this.set_value("charge_amount", 0);
		} else {
			const address = await this.order.get_delivery_address();

			this.set_value("delivery_address", address.address || "");
			this.set_value("charge_amount", address.charges || 0);
		};
	}

	init_synchronize() {
		frappe.realtime.on("pos_profile_update", () => {
			this.hide();
		});
	}

	async reload() {
		await super.reload(null, true);
		this.update_paid_value();
	}

	make_inputs() {
		let payment_methods = "";
		RM.pos_profile.payments.forEach(mode_of_payment => {
			this.payment_methods[mode_of_payment.mode_of_payment] = frappe.jshtml({
				tag: "input",
				properties: {
					type: "text",
					class: `input-with-feedback form-control bold`
				},
			}).on(["change", "keyup"], () => {
				this.update_paid_value();
			}).on("click", (obj) => {
				this.order.order_manage.num_pad.input = obj;
			}).float();

			window["mode_of_payment"] = this.payment_methods[mode_of_payment.mode_of_payment]

			if (mode_of_payment.default === 1) {
				//FIX 29-07-2025
				if (String(roundNumber(this.order.data.amount,2)).endsWith('.99')) {
					this.payment_methods[mode_of_payment.mode_of_payment].val(Math.round(this.order.data.amount,2));
				} else {
					this.payment_methods[mode_of_payment.mode_of_payment].val(this.order.data.amount);
				}
				

				setTimeout(() => {
					this.payment_methods[mode_of_payment.mode_of_payment].select();
					this.order.order_manage.num_pad.input = this.payment_methods[mode_of_payment.mode_of_payment];
				}, 200);
			}

			payment_methods += this.form_tag(
				mode_of_payment.mode_of_payment, this.payment_methods[mode_of_payment.mode_of_payment]
			);
		});

		this.get_field("payment_methods").$wrapper.empty().append(payment_methods);
		this.update_paid_value();

		/*RM.pos_profile.payments.forEach(mode_of_payment => {
				console.log(this.payment_methods[mode_of_payment.mode_of_payment])
		});*/
	}

	form_tag(label, input) {
		return `
				<div class="form-group">
						<div class="clearfix">
								<label class="control-label" style="padding-right: 0;">${__(label)}</label>
						</div>
						<div class="control-input-wrapper">
								${input.html()}
						</div>
				 </div>`
	}

	get payments_values() {
		const payment_values = {};
		RM.pos_profile.payments.forEach((mode_of_payment) => {
			let value = this.payment_methods[mode_of_payment.mode_of_payment].float_val;
			if (value > 0) {
				//FIX 29-07-2025; Add round
				//payment_values[mode_of_payment.mode_of_payment] = value;
				console.log('paymentvalue ', Math.round(value,2));
				payment_values[mode_of_payment.mode_of_payment] = Math.round(value,2)
			}
		});

		return payment_values;
	}

	send_payment() {
		RM.working("Saving Invoice");
		this.#send_payment();
	}

	reset_payment_button() {
		RM.ready();
		if (!RM.can_pay) {
			this.actions.pay.disable();
			return;
		}
		this.actions.pay.enable().val(__("Pay"));
	}

	#send_payment() {
		if (!RM.can_pay) return;
		const order_manage = this.order.order_manage;

		RM.working("Saving Invoice");

		super.save({
			success: (r) => {
				RM.working("Paying Invoice");
				frappeHelper.api.call({
					model: "Table Order",
					name: this.order.data.name,
					method: "make_invoice",
					args: {
						mode_of_payment: this.payments_values
					},
					always: (r) => {
						RM.ready();
						this.reset_payment_button();

						if (r.message && r.message.status) {
							order_manage.clear_current_order();
							order_manage.check_buttons_status();
							order_manage.check_item_editor_status();

							this.hide();
							this.print(r.message.invoice_name);
							order_manage.make_orders();
						}
					},
					freeze: true
				});
			},
			error: (r) => {
				RM.ready();
				this.reset_payment_button();
				if (r !== false && typeof r === "string") {
					frappe.msgprint(r);
				}
			}
		});
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
											console.warn('No ngrok/pinggy address found, returning empty string');
											resolve('');
									}
							}
					);
			});
	}

	
	// Fixed print_account method
	async print(invoice_name) {
		try {
			console.log('print account....');
			const baseUrl = await this.baseURL();
			const docname = invoice_name;

			if (!RM.can_pay) return;

			const title = invoice_name + " (" + __("Print") + ")";
			const order_manage = this.order.order_manage;

			const props = {
				model: "POS Invoice",
				model_name: invoice_name,
				args: {
					format: RM.pos_profile.print_format,
					_lang: RM.lang,
					no_letterhead: RM.pos_profile.letter_head || 1,
					letterhead: RM.pos_profile.letter_head || 'No%20Letterhead'
				},
				from_server: true,
				set_buttons: true,
				is_pdf: true,
				customize: true,
				title: title
			};

			//FIX 15-10-2024
			
			var order_print = "";
			var ficha_tec = "";
			var orderprint  = "";

			console.log('Base URL:', baseUrl);
			console.log('Docname:', docname);
			
			// Use a wrapper function to handle the callback properly
			await new Promise((resolve, reject) => {
				frappe.model.with_doc('POS Invoice', docname, function() {
					try {
						// Get all keys from locals['POS Invoice']
						const keys = Object.keys(locals['POS Invoice']);
						console.log('Keys:', keys);
						
						if (keys.length === 0) {
							reject(new Error('No Invoice document found in locals'));
							return;
						}
						
						// Get the last key
						const d = keys[keys.length - 1];
						console.log('Document key:', d);
						
						// Get the document
						const fichatec = frappe.model.get_doc('POS Invoice', d);
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
				frappe.msgprint(__('POS Invoice document not found'));
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

		//FIX 02-01-2025; TRying to reload
		console.log('RELOAD after printting PAYMENT');
		document.getElementsByClassName('modal-backdrop')[0].remove('fade');
		this.reload();
		//FIX 28-05-2025
		document.getElementsByClassName('modal-backdrop')[0].remove('fade');
				
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
							doctype: 'POS Invoice',
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
							doctype: 'POS Invoice',
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
				return await this.printViaBrowser(ficha_tec,ficha_tec.doctype,ficha_tec.name, props);
				//return await this.printViaFrappeform(ficha_tec,props,title);
				//return false;
			}

			// Generate buffer
			const bufferResult = await PrintHelper.generateBuffer(
				'POS Invoice',
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
				'POS Invoice',
				doc.name,
				doc.company
			);
			
			if (!bufferResult.success) {
				throw new Error(bufferResult.error);
			}
			
			//const result = await PrintHelper.printViaBrowser(bufferResult.buffer);
			const result = await PrintHelper.printViaBrowser(doctype,docname,default_Printformat);
			
			if (result.success) {
				frappe.msgprint({
					title: __('Success'),
					message: __('Print dialog opened'),
					indicator: 'green'
				});
			}
			
			return result.success;
		} catch (error) {
			console.error('Browser printing error:', error);
			frappe.msgprint(__('Browser printing failed: ') + error.message);
			return false;
		}
	}

	async print_v0(invoice_name) {
		if (!RM.can_pay) return;

		const title = invoice_name + " (" + __("Print") + ")";
		const order_manage = this.order.order_manage;

		const props = {
			model: "POS Invoice",
			model_name: invoice_name,
			args: {
				format: RM.pos_profile.print_format,
				_lang: RM.lang,
				no_letterhead: RM.pos_profile.letter_head || 1,
				letterhead: RM.pos_profile.letter_head || 'No%20Letterhead'
			},
			from_server: true,
			set_buttons: true,
			is_pdf: true,
			customize: true,
			title: title
		};

		//FIX 15-10-2024
		
		var order_print = "";
		var ficha_tec = "";
		var orderprint  = "";

		//FIX 17-08-2026
		//console.log('TEM NGOK ', await this.baseURL());
		if (await this.baseURL()) {

			frappe.model.with_doc('POS Invoice', invoice_name, function() { 
				//var d = Object.keys(locals['POS Invoice'])[0]
				//FIX 27-05-2025
				var d = Object.keys(locals['POS Invoice'])[Object.keys(locals['POS Invoice']).length-1]      
				frappe.model.with_doctype('POS Invoice', () => {
					let meta = frappe.get_meta("POS Invoice");
					var fichatec = frappe.model.get_doc('POS Invoice', d);
					ficha_tec = fichatec; 
					console.log ('ficccc ', ficha_tec.name);      
					///console.log('default template ');
					//console.log(meta.__print_formats[1].html);

				}).then((r) => {
					frappe.model.get_value('Restaurant Settings',{'name': 'Restaurant Settings'}, 'ngrok_or_pinggy_address',
						function(d) {
							console.log('TEM VALOR DO NGROK');
							console.log(d)
							const apiBaseUrl = d.ngrok_or_pinggy_address;

							//Moved inside here

							//FIX 27-050-2025; Added two button for PRT-BAR01 and PRT-BAR02
							let dialog = new frappe.ui.Dialog({
								title: 'Selecione a Impressora',
								primary_action_label: 'Impressora BAR 01', // Custom text for the primary button
								primary_action: function() {
									console.log('Selecionou Printer 01');
									//Once bought the PLAN this will be printer-backend.angolaerp.co.ao
									//TESTE using ESC/POS
									frappe.call({
										method: "angola_erp.util.angola.generate_escpos_and_print",
										args: {
											server_url: apiBaseUrl,
											doctype: 'POS Invoice',
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
									//Once bought the PLAN this will be printer-backend.angolaerp.co.ao
									//TESTE using ESC/POS
									frappe.call({
										method: "angola_erp.util.angola.generate_escpos_and_print",
										args: {
											server_url: apiBaseUrl,
											doctype: 'POS Invoice',
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
						});

					
					//console.log('TERMINOUIadfsadfsfsafsafasfa');    
					/*
					frappe.call({
						"method": "frappe.www.printview.get_html_and_style",
						args: {
							doc :"POS Invoice",
							name :ficha_tec.name,
							print_format:"POS Invoice_selling",
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
				})
				
			})
		} else {
			//FIX 17-08-2026
			if (order_manage.print_modal) {
				order_manage.print_modal.set_props(props);
				order_manage.print_modal.set_title(title);
				order_manage.print_modal.reload().show();
			} else {
				order_manage.print_modal = new DeskModal(props);
			}

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

		//FIX 02-01-2025; TRying to reload
		console.log('RELOAD after printting PAYMENT');
		document.getElementsByClassName('modal-backdrop')[0].remove('fade');
		this.reload();
		//FIX 28-05-2025
		document.getElementsByClassName('modal-backdrop')[0].remove('fade');

	}

	update_paid_value() {
		let total = 0;

		setTimeout(() => {
			Object.keys(this.payment_methods).forEach((payment_method) => {
				total += this.payment_methods[payment_method].float_val;
			});
			//FIX 22-05-2025; Added roundNumber(this.order.amount,2) to avoid 4 decimals; 
			//FIX 29-07-2025; Added roundNumbert to total
			//this.set_value("total_payment", total);
			this.set_value("total_payment", Math.round(total,2));
			this.set_value("change_amount", (Math.round(total,2) - roundNumber(this.order.amount,2)));
			//FIX 29-12-2024; Check if change amount is MINUS... meaning paying LESS
			console.log('total ', total);
			console.log('orderamount ', roundNumber(this.order.amount,2));
			console.log('change amou ', (total - roundNumber(this.order.amount,2)));
			if ((total - roundNumber(this.order.amount,2)) < 0) {
				this.actions.pay.disable();
			} else if (total == roundNumber(this.order.amount,2)) {
				//FIX 22-05-2025
				this.actions.pay.enable();
			} else {
				this.actions.pay.enable();
			}
			
		}, 0);
	}

	set_value(field, value) {
		super.set_value(field, value);
		if (field === "amount") {
			this.set_total_payment();
		}
	}

	set_total_payment() {
		//FIX 17-08-2026;
		if (!this.actions) {
			this.make_actions();
		}

		if (this.actions.pay) {
			//FIX 29-07-2025
			if (String(roundNumber(this.order.data.amount,2)).endsWith('.99')) {
				this.actions.pay.set_content(`<span style="font-size: 25px; font-weight: 400">{{text}} ${Math.round(this.order.data.amount,2).toFixed(2)}</span>`);
			} else {
				this.actions.pay.set_content(`<span style="font-size: 25px; font-weight: 400">{{text}} ${this.order.total_money}</span>`);
			}
			this.actions.pay.val(__("Pay"));
		}
	}
}
