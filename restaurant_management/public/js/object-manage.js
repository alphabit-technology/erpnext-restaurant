class ObjectManage{
    #childrend={};

    constructor(options){
        Object.assign(this, options);
    }

    append_child(opts) {
        const childrend = this.childrend;
        const child = opts.child || null;
        const exist_f = opts.exist || null;
        const not_exist_f = opts.not_exist || null;
        const always_f = opts.always || null;

        if(!child) return;

        if (this.has_child(child.name)) {
            if(exist_f) exist_f(childrend[child.name]);
        } else {
            if(not_exist_f) this.#childrend[child.name] = not_exist_f();
        }

        if(always_f){
            always_f(this.get_child(child.name));
        }

        return this.get_child(child.name);
    }



    has_child(child){
        const childrend = this.childrend;
        return Array.isArray(childrend) ? childrend.includes(child) : Object.keys(childrend).includes(child);
    }

    get childrend(){
        const childrend = this.#childrend;
        return childrend && typeof childrend == 'object' ? childrend : {};
    }

    set childrend(childrend){
        this.#childrend = childrend;
    }

    get_child(child){
        return this.has_child(child) ? this.childrend[child] : null;
    }

    in_childs(f){
        const childrend = this.childrend;
        let index = 0;

        if(Array.isArray(childrend)){
            childrend.forEach((child, key) => {
                f(child, key, index);
                index ++;
            });
        }else{
            Object.keys(childrend).forEach(key => {
                f(childrend[key], key, index);
                index ++;
            });
        }
    }

    delete_child(child){
        if(this.has_child(child)) delete this.#childrend[child];
    }
}