class ItemsTree {
    #items = null;

    constructor({ wrapper, order_manage }) {
        this.wrapper = wrapper;
        this.order_manage = order_manage;
        this.items = {};
        this.currency = RM.pos_profile.currency;

        frappe.db.get_list("Item Group", {fields: ["*"], filters: {is_group: 1}, order_by: "lft"}).then(groups => {
            this.make_dom();
            this.render_parent_group(groups);
        });
    }

    render_parent_group(groups) {
        const self = this;
        groups.forEach(group => {
            this.order_manage.item_parent_wrapper.append(`
                <button class="btn btn-default btn-flat item-group-action" data-group="${group.name}">
                    <span class="fa fa-check"></span> ${group.name}
                </button>
            `)
        });

        this.order_manage.item_parent_wrapper.find(".item-group-action").click(function (e) {
            $(this).addClass('active').siblings().removeClass('active');
            const item_group = $(this).attr('data-group');

            const filter = item_group === "All Item Groups" ? {name: item_group} : { parent_item_group: item_group };

            frappe.db.get_list("Item Group", { fields: ["*"], filters: filter }).then(groups => {
                self.render_tree(groups, self.wrapper.find('.tree'), true);
            });
        });

        this.order_manage.item_parent_wrapper.find(".item-group-action:first").click();
    }

    make_dom() {
        this.wrapper.html(`
			<div class="items-wrapper col-md-12 layout-main-section-wrapper" style="position:absolute; padding: 5px;">
                <div class="layout-main-section frappe-card">
                    
                </div>

                <div class="layout-main-section frappe-card">
                    <div class="tree with-skeleton opened">
                    
                    </div>
                </div>
            </div>
		`);
    }

    render_tree(data, wrapper = null, opened = false) {      
        wrapper.empty();
    
        data.forEach(item => {
            const icon = frappe.jshtml({
                tag: "use",
                properties: {
                    href: (item.is_group ? "#icon-folder-normal" : "#icon-primitive-dot")
                }
            });

            this[`${item.name}_count`] = frappe.jshtml({
                tag: "span",
                properties: {
                    class: "badge"
                },
                content: 0
            });

            const node = frappe.jshtml({
                tag: "li",
                properties: {
                    class: "tree-node"
                },
                content: `
                    <span class="tree-label" data-children="${item.name}"></span>
                    <svg class="icon icon-${item.is_group ? 'md' : 'xs'}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                        ${icon.html()}
                    </svg>
                    </span>
                        <a class="tree-label"> ${item.name}</a>
                        ${this[`${item.name}_count`].html()}
                    </span>

                    <ul class="tree-children" area-children="${item.name}" style="display:none;"></ul>
                    <div class="col md-12" area-items="${item.name}" style="display:none;">

                    </div>
                `
            });

            wrapper.append(node.html());

            const open_children = () => {
                const children_wrapper = node.find(`[area-children="${item.name}"]`);
                const items_container = node.find(`[area-items="${item.name}"]`);

                if (item.is_group) {
                    const children = data.filter(group => (group.parent_item_group === item.name));
                    this.render_tree(children, children_wrapper);

                    children_wrapper.toggle();
                    icon.obj.setAttribute("href", `#icon-folder-${children_wrapper.is(":visible") ? 'open' : 'normal'}`)                   
                }

                items_container.empty().toggle();

                this.#items = new ProductItem({
                    wrapper: items_container,
                    order_manage: this.order_manage,
                    have_search: false,
                    item_group: item.name
                });
                
                this.update_items_count();
            }

            setTimeout(() => {
                opened && open_children();
            }, 0);

            node.on('click', (e) => {
                open_children();
            });
        });
    }

    update_items_count() {
        frappe.call({
            method: RM.url_manage + 'group_items_count',
            freeze: true
        }).then(r => {
            r.message.forEach(item => {
                const badge = this[`${item.item_group}_count`];
                if(badge){
                    badge.val(item.items_count);
                    if(item.items_count <= 1){
                        badge.remove_class('badge-success bg-warning').add_class('badge-danger');
                    }else if(item.items_count > 1 && item.items_count <= 5){
                        badge.remove_class('badge-dander bg-success').add_class('badge-warning');
                    }else{
                        badge.remove_class('badge-warning bg-danger').add_class('badge-success');
                    }
                }
            });

        });
    }
}