class FoodCommand{
	constructor(options) {
		Object.assign(this, options, {
			rendered: false,
		});
		this.item = null;
		this.action_button = null
		this.status_label = null;
		this.render();
		//this.listener();
	}

	/*listener(){
		frappe.realtime.on(this.data.identifier, (data) => {
			if (this.process_manage.include_status(data.status)) {
				this.data = data;
				this.update_status_html();
			}else{
				this.remove();
			}
		})
	}*/

    render(){
		if(this.rendered === false){
			this.action_button = new JSHtml({
				tag: "div",
				properties: {
					class: `btn btn-default btn-food-command right`,
					style: "border-radius: 0; color: black"
				},
				content: '{{text}}<i class="fa fa-chevron-right pull-right"/>',
				text: this.data.process_status_data.next_action_message,
			}).on("click", () => {
				this.execute()
			}, "double_click")

			this.status_label = new JSHtml({
				tag: "label",
				properties: {
					class: "btn btn-food-command status-label left",
					style: `border-radius: 0; color: white; background-color: ${this.data.process_status_data.color}`
				},
				content: `<i class="${this.data.process_status_data.icon} pull-left"/> ${this.data.process_status_data.status_message}`,
			})

			this.item = new JSHtml({
				tag: "article",
				properties: {
					class: "food-command"
				},
				content: this.template()
			})

			$(this.process_manage.command_container()).append(
				this.item.html()
			);

			this.rendered = true;
		}
	}

	update_status_html(){
		this.action_button.val(this.data.process_status_data.next_action_message);
		//this.status_label.content = `<i class="${this.data.process_status_data.icon} pull-left"/> ${this.data.process_status_data.status_message}`;

		this.status_label.val(
			`<i class="${this.data.process_status_data.icon} pull-left"/> ${this.data.process_status_data.status_message}`
		).css({
			"background-color": this.data.process_status_data.color
		});
	}

	execute(){
		if(RM.busy_message()){
			return;
		}
		RM.working(this.data.next_action_message, false);

		CETI.api.call({
			model: "Restaurant Object",
			name: this.process_manage.table.data.name,
			method: "set_status_command",
			args: {
				identifier: this.data.identifier
			},
			always: () => {
				RM.ready(false, "success");
			},
		})
	}

	remove(){
		this.item.remove();

		let items = Object.keys(this.process_manage.items);

		items.forEach((item) => {
			if(this.process_manage.items[item].data.identifier === this.data.identifier){
				delete this.process_manage.items[item];
			}
		})
	}

	template(){
		return `			
		<div class="product-img">
			<span class="price-tag">${this.data.order_name}</span>
			<table class="table command-content">
				<thead>
					<tr>
						<th style="text-align: center">Qty</th>
						<th style="text-align: center">Rate</th>
						<th style="text-align: center">Total</th>
					</tr>
				</thead>
				<tbody>
				<tr>
					<td class="detail" style="font-size: 50px; padding: 0; margin: 0">${this.data.qty}</td>
					<td class="detail" style="text-align: center">${RM.format_currency(this.data.rate)}</td>
					<td class="detail" style="text-align: center">${RM.format_currency(this.data.amount)}</td>
				</tr>
				</tbody>
			</table>
		</div>
	
		<div class="product-name">${this.data.item_name}</div>
		<div class="product-date">${this.data.creation}</div>
		<div class="product-notes ${typeof this.data.notes == "object"? "empty" :""}">
			${typeof this.data.notes == "object"? __("No annotations"): this.data.notes}
		</div>
	
		<label>
			${this.status_label.html()}
		</label>
		${this.action_button.html()}`
	}
}