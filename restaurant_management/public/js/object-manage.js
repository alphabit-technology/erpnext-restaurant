class ObjectManage{
    #children={};

    constructor(options){
        Object.assign(this, options);
    }

    append_child(opts) {
        const children = this.children;
        const child = opts.child || null;
        const exist_f = opts.exist || null;
        const not_exist_f = opts.not_exist || null;
        const always_f = opts.always || null;

        if(!child) return;

        if (this.has_child(child.name)) {
            if(exist_f) exist_f(children[child.name]);
        } else {
            if(not_exist_f) this.#children[child.name] = not_exist_f();
        }

        if(always_f){
            always_f(this.get_child(child.name));
        }

        return this.get_child(child.name);
    }



    has_child(child){
        const children = this.children;
        return Array.isArray(children) ? children.includes(child) : Object.keys(children).includes(child);
    }

    get children(){
        const children = this.#children;
        return children && typeof children == 'object' ? children : {};
    }

    set children(children){
        this.#children = children;
    }

    get_child(child){
        return this.has_child(child) ? this.children[child] : null;
    }

    in_child(f){
        const children = this.children;
        let index = 0;

        if (Array.isArray(children)){
            children.forEach((child, key) => {
                f(child, key, index);
                index ++;
            });
        }else{
            Object.keys(children).forEach(key => {
                f(children[key], key, index);
                index ++;
            });
        }
    }

    delete_child(child){
        if (this.has_child(child)) delete this.#children[child];
    }
}