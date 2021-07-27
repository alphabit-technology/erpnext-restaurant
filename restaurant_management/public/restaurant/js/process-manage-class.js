ProcessManage = class ProcessManage {
    constructor(options) {
        Object.assign(this, options);
        this.status = "close";
        this.modal = null;
        this.items = {};
        this.command_container_name = this.table.data.name + "-command_container";
        this.new_items_keys = [];

        this.initialize();
    }

    reload() {
        this.get_commands_food();
    }

    initialize() {
        this.title = this.table.room.data.description + " (" + this.table.data.description + ")";
        if (this.modal == null) {
            this.modal = RMHelper.default_full_modal(this.title, () => this.make());
        } else {
            this.show();
        }
    }

    show() {
        this.modal.show();
    }

    is_open() {
        return this.modal.modal.display;
    }

    close() {
        this.modal.hide();
        this.status = "close";
    }

    make() {
        this.make_dom();
        this.get_commands_food();
    }

    make_dom() {
        this.modal.container.empty().append(this.template());
        this.modal.title_container.empty().append(
            RMHelper.return_main_button(this.title, () => this.modal.hide()).html()
        );
    }

    template() {
        return `
		<div class=" process-manage">
			<div id="${this.command_container_name}"></div>
		</div>`
    }

    get_commands_food() {
        RM.working("Load commands food")
        frappeHelper.api.call({
            model: "Restaurant Object",
            name: this.table.data.name,
            method: "commands_food",
            args: {},
            always: (r) => {
                RM.ready();
                this.make_food_commands(r.message);
            },
        });
    }

    make_food_commands(items = []) {
        let _items = Object.keys(this.items);
        this.new_items_keys = [];

        items.forEach((item) => {
            this.new_items_keys.push(item.identifier);

            if (_items.includes(item.identifier)) {
                this.items[item.identifier].data = item;
            } else {
                this.add_item(item);
            }

            this.items[item.identifier].process_manage = this;
        });

        setTimeout(() => {
            this.debug_items();
        }, 100);
    }

    check_items(items) {
        items.forEach((item) => {
            this.check_item(item);
        });
    }

    check_item(item) {
        if (Object.keys(this.items).includes(item.identifier)) {
            let _item = this.items[item.identifier];
            if (this.include_status(item.status)) {
                _item.data = item;
                _item.refresh_html();
            } else {
                _item.remove();
            }
        } else {
            if (this.include_status(item.status) && this.include_item_group(item.item_group)) {
                this.new_items_keys.push(item.identifier);
                this.add_item(item);
            }
        }
    }

    debug_items() {
        Object.keys(this.items).filter(x => !this.new_items_keys.includes(x)).forEach((r) => {
            this.items[r].remove();
        });
    }

    remove_item(item){
        if(this.items[item]){
             this.items[item].remove();
        }
    }

    add_item(item) {
        this.items[item.identifier] = new FoodCommand({
            identifier: item.identifier,
            process_manage: this,
            data: item
        });
    }

    include_status(status) {
        return this.table.data.status_managed.includes(status);
    }

    include_item_group(item_group) {
        return this.table.data.items_group.includes(item_group);
    }

    container() {
        return $(`#orders-${this.table.data.name}`);
    }

    command_container() {
        return document.getElementById(this.command_container_name);
    }
}