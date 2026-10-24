class DeskModal {
	constructor(options) {
		Object.assign(this, options);
		this.id = "desk-modal-" + Math.random().toString(36).substr(2, 15);
		this.modal = null;
		this.construct();
	}

	set_props(props){
		Object.assign(this, props);
	}

	remove(){
		this.modal && this.modal.$wrapper.remove();
	}

	construct(){
		this.modal = new frappe.ui.Dialog({
			title: this.title,
			primary_action_label: __("Save")
		});

		this.show();
		
		if(this.full_page){
			this.modal.$wrapper.find('.modal-dialog').css({
				"width": "100%", "height": "100%", "left": "0", "top": "0", "margin": "0", "padding":"0", "border-style": "none",
				"max-width": "unset", "max-height": "unset"
			});

			this.modal.$wrapper.find('.modal-content').css({
				"width": "100%", "height": "100%", "left": "0", "top": "0", "border-style": "none", "border-radius": "0",
				"max-width": "unset", "max-height": "unset"
			});
		}

		setTimeout(() => {
			this.render();
		}, 200);
	}

	_adjust_height(){
		return typeof this.adjust_height == "undefined" ? 0 : this.adjust_height;
	}

	render(){
		this.set_title();

		if(typeof this.customize != "undefined"){
			this.modal.$wrapper.find(".modal-body").empty();

			this.modal.$wrapper.css({
				"height": `calc(100% - ${this._adjust_height()}px)`,
				"border-bottom": "var(--default-line)",
			});

			this.modal.$wrapper.find('.modal-header').css({
				"padding": "5px",
				"border-bottom": "var(--default-line)",
				"border-radius": "0",
				/*"min-height": "50px"*/
			});

			this.modal.$wrapper.find('.modal-body').css({
				"background-color": "transparent",
				"padding": "0",
				"border-style": "none",
				"border-radius": "0",
				"overflow-y": "auto"
			});

			this.modal.$wrapper.find('.modal-title').css({
				"margin": "0"
			});

			this.modal.$wrapper.find(".modal-actions").prepend("<span class='btn-container'></span>").css({
				"top": "5px"
			});
		}

		if(typeof this.from_server == "undefined") {
			if(this.callback){
				this.callback(this);
			}
		}else{
			this.load_data();
		}
	}

	set_title(title){
		this.modal.set_title(title);
	}

	get container(){return this.modal.$wrapper.find(".modal-body")}
	get title_container(){return this.modal.$wrapper.find(".modal-title")}
	get buttons_container(){return this.modal.$wrapper.find(".modal-actions .btn-container")}

	show(){
		this.modal.show();
	}

	hide(){
		this.modal.hide();
	}

	loading() {
		this.modal.fields_dict.ht.$wrapper.html(
			"<div class='loading-form' style='font-size: xx-large; text-align: center; color: #8D99A6'>" + __("Loading") + "...</div>"
		);
	}

	stop_loading() {
		//this.modal.fields_dict.ht.$wrapper.html("");
	}

	get _is_pdf(){
		return typeof this.is_pdf != "undefined" && this.is_pdf === true;
	}

	get _args() {
		let args = this.args;
		return (typeof args == "undefined" || args == null ? {} : this.args);
	}

	get _pdf_url(){
		let url = `/api/method/frappe.utils.print_format.download_pdf?doctype=${this.model}&name=${this.model_name}`;
		let args = Object.assign({
			no_letterhead: 1,
			letterhead: 'No%20Letterhead',
			settings: '%7B%7D'
		}, this._args);

		Object.keys(args).forEach(k => {
			url += '&' + k + '=' + args[k];
		});

		return url;
	}

	get pdf_template(){
		return `
 			<div class="col-md-12" style="margin-top: 15px">
 				<div class="pdf-container">
 					<embed src="${this._pdf_url}" frameborder="0" width="100%" height="400px">
 			 	</div>
 			 </div>
		`;
	}

	load_data(){
		//FIX 24-12-2024
		console.log('desk modal - LOAD DATA');
		if(this._is_pdf){
			this.container.empty().append(this.pdf_template);
		}else{
			frappeHelper.api.call({
				model: this.model,
				name: this.model_name,
				method: this.action,
				args:{},
				always: (r) => {
					this.container.empty().append(r.message);
					this.stop_loading();
					if(this.callback){
						this.callback(this);
					}
				},
			});
		}
    }

    reload(){
		this.load_data();
		return this;
	}
}