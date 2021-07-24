let DOUBLE_CLICK = 'double_click';

function scrollIfNeeded(element, container) {
    if (element.offsetTop < container.scrollTop) {
        container.scrollTop = element.offsetTop;
    } else {
        const offsetBottom = element.offsetTop + element.offsetHeight;
        const scrollBottom = container.scrollTop + container.offsetHeight;
        if (offsetBottom > scrollBottom) {
            container.scrollTop = offsetBottom - container.offsetHeight;
        }
    }
}

class RMHelperClass {
    constructor() {
        this.icons = {
            add: `<span class='fa fa-plus' style="padding-right: 5px"/>`,
            trash: `<span class='fa fa-trash' style="padding-right: 5px"/>`,
            edit: `<span class='fa fa-pencil' style="padding-right: 5px"/>`,
            ok: `<span class='fa fa-check' style="padding-right: 5px"/>`
        }
    }

    no_data(message) {
        return `
        <div class="col-md-12" style="color: var(--gray-500)">
            <div class="col-md-12" style="font-size: 5em; text-align: center !important;">
                <span class="fa fa-shopping-cart"/><br>
            </div>
            <div class="col-md-12" style="font-size: 25px; text-align: center">
                <em>${__(message)}</em>
            </div>
        </div>`
    }

    return_main(title, f, wrapper = null) {
        return new JSHtml({
            tag: "button",
            wrapper: wrapper,
            properties: {class: "btn btn-default btn-flat"},
            content: "<span class='fa fa-reply' style='padding-right: 5px'/> {{text}}",
            text: title
        }).on("click", () => {
            setTimeout(f);
        });
    }

    default_button(text, icon, f, method, wrapper = null) {
        return new JSHtml({
            tag: "button",
            wrapper: wrapper,
            properties: {class: "btn btn-default btn-flat", style: 'display: none;'},
            content: `${this.icons[icon]} {{text}}`,
            text: __(text)
        }).on("click", () => {
            setTimeout(f);
        }, method);
    }

    default_full_modal(title, f) {
        return new DeskModal({
            full_page: true,
            customize: true,
            adjust_height: 25,
            title: title,
            call_back: () => {
                setTimeout(f);
            }
        });
    }

    JSONparse(data) {
        if (data) {
            try {
                return JSON.parse(data);
            } catch (e) {
                return null;
            }
        } else {
            return null;
        }
    }
}

RMHelper = new RMHelperClass();