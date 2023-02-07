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
        //groups.push({ name: "Options", parent_item_group: null, icon: "fa fa-cog" });

        groups.forEach(group => {
            const icon_class = group.name === "All Item Groups" ? "fa fa-list" : group.icon || "fa fa-chevron-right";
            const style = group.name === "Options" ? "float: right; position:absolute; right:0;" : "";
            this.order_manage.item_parent_wrapper.append(`
                <button class="btn btn-default btn-flat item-group-action" data-group="${group.name}" style="${style}">
                    <span class="${icon_class}" icon-group="icon-group"></span>
                    ${group.name === "All Item Groups" ? __("All") : group.name}
                </button>
            `)
        });

        this.order_manage.item_parent_wrapper.find(".item-group-action").click(function (e) {
            $(this).addClass('active').removeClass("text-muted").siblings().removeClass('active').addClass("text-muted");
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
			<div class="items-wrapper col-md-12 ayout-main-section-wrapper" style="padding: 0; min-width: 330px;">
                <div class="layout-main-section frappe-card" style="background-color:unset !important;">
                    <div class="tree with-skeleton opened" style="padding:0;">
                    
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
                    href: "#icon-right"
                }
            });

            this[`${item.name}_count`] = frappe.jshtml({
                tag: "span",
                properties: {
                    class: "badge"
                },
                content: 0
            });

            const action = frappe.jshtml({
                tag: "li",
                properties: {
                    class: "tree-node",
                    style: `padding-top: 5px; ${item.name === "All Item Groups" ? "display: none;" : ";"}`
                },
                content: `
                    <span class="tree-item">
                        <span class="tree-label" data-children="${item.name}"></span>
                        <svg class="icon icon-md" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
                            ${icon.html()}
                        </svg>
                        </span">
                            <a class="tree-label"> ${item.name}</a>
                            ${this[`${item.name}_count`].html()}
                        </span>
                    </span>
                `
            });

            wrapper.append(`
                <li class="tree-node">
                    ${action.html()}
                    <ul class="tree-children" area-children="${item.name}" style="display:none;"></ul>
                    <div class="col md-12" area-items="${item.name}" style="display:none; top: 5px;">

                    </div>
                </li>
            `);

            const open_children = () => {
                const children_wrapper = wrapper.find(`[area-children="${item.name}"]`);
                const items_container = wrapper.find(`[area-items="${item.name}"]`);

                const children = data.filter(group => (group.parent_item_group === item.name));
                
                this.render_tree(children, children_wrapper);
                children_wrapper.toggle();
                icon.obj.setAttribute("href", `#icon-${children_wrapper.is(":visible") ? 'down' : 'right'}`);

                items_container.empty().toggle();

                this.#items = new ProductItem({
                    wrapper: items_container,
                    order_manage: this.order_manage,
                    have_search: false,
                    item_group: item.name
                });
                
                this.update_items_count();
            }

            this.update_items_count();
            setTimeout(() => {
                item.name === "All Item Groups" && open_children();
                //opened && open_children();
            }, 0);

            action.on('click', (e) => {
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