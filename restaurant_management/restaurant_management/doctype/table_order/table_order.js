// Copyright (c) 2021, Quantum Bit Core and contributors
// For license information, please see license.txt

//LAST MODIFIED: 31-05-2025

frappe.ui.form.on("Order Entry Item","item_code", function(frm,cdt,cdn) {
	var d = locals[cdt][cdn];
	
	console.log('TABLE ORDER ENTRY ITEM');

});

frappe.ui.form.on('Table Order', {
	
	refresh: function(frm) {
		//FIX 21-12-2024; Adding Button PRINT INVOICE
		if (frm.doc.status == "Invoiced") {
			frm.add_custom_button(__('Print Invoice'), function() {

				var order_print = "";
				var ficha_tec = "";
				var orderprint  = "";
			
				frappe.model.with_doc('POS Invoice', frm.doc.link_invoice, function() { 
				  var d = Object.keys(locals['POS Invoice'])[0]
				  frappe.model.with_doctype('POS Invoice', () => {
					let meta = frappe.get_meta("POS Invoice");
					var fichatec = frappe.model.get_doc('POS Invoice', d);
					ficha_tec = fichatec; 
					console.log ('ficccc ', ficha_tec.name);      
					console.log('default template ');
					console.log(meta.__print_formats[1].html);
			
				  }).then((r) => {
					//console.log('TERMINOUIadfsadfsfsafsafasfa');    
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
				  })
				})				
			});

			//25-05-2025; PRINT NODE Consulta de MESA
			frm.add_custom_button(__('Print NODE INVOICE'), function() {
				// Detect if frontend is running on HTTPS

				//FIX 15-10-2024
				
				var order_print = "";
				var ficha_tec = "";
				var orderprint  = "";

				frappe.model.with_doc('POS Invoice', cur_frm.doc.link_invoice, function() { 
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


			});			

		} else if (frm.doc.status == "Attending") {
			//25-05-2025; PRINT NODE Consulta de MESA
			frm.add_custom_button(__('Print NODE'), function() {
				// Detect if frontend is running on HTTPS
				const apiBaseUrl = window.location.protocol === 'https:' 
					? 'https://192.168.8.147:3443' 
					: 'http://192.168.8.147:3000';

				//TESTE using ESC/POS
				frappe.call({
					method: "angola_erp.util.angola.generate_escpos_and_print",
					args: {
						server_url: apiBaseUrl,
						doctype: frm.doc.doctype,
						docname: frm.doc.name,
						company_info: frm.doc.company,
						logo_path: '/files/logo.png'
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

	}
});
