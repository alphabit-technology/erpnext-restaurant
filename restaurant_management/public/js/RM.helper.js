let DOUBLE_CLICK = 'double_click';

class RMHelperClass {
    constructor() {
        this.icons = {
            add: `<span class='fa fa-plus' style="padding-right: 5px"></span`,
            trash: `<span class='fa fa-trash' style="padding-right: 5px"></span`,
            edit: `<span class='fa fa-pencil' style="padding-right: 5px"></span>`,
            ok: `<span class='fa fa-check' style="padding-right: 5px"></span>`,
            people: `<span class='fa fa-user' style="padding-right: 5px"><span`,
            peoples: `<span class='fa fa-users' style="padding-right: 5px"><span`,
        }
    }

    no_data(message) {
        return `
        <div class="col-md-12" style="color: var(--gray-500)">
            <div class="col-md-12" style="font-size: 5em; text-align: center !important;">
                <span class="fa fa-shopping-cart"></span><br>
            </div>
            <div class="col-md-12" style="font-size: 25px; text-align: center">
                <em>${__(message)}</em>
            </div>
        </div>`
    }

    return_main_button(title, f, wrapper = null) {
        return frappe.jshtml({
            tag: "button",
            wrapper: wrapper,
            properties: { class: "btn btn-default btn-flat" },
            content: "<span class='fa fa-reply' style='padding-right: 5px'></span> {{text}}",
            text: title
        }).on("click", () => f());
    }

    default_button(text, icon, f, method, wrapper = null) {
        return frappe.jshtml({
            tag: "button",
            wrapper: wrapper,
            properties: { class: "btn btn-default btn-flat", style: 'display: none;' },
            content: `${this.icons[icon]} {{text}}`,
            text: __(text)
        }).on("click", () => f(), method);
    }

    default_full_modal(title, f) {
        return new DeskModal({
            full_page: true,
            customize: true,
            adjust_height: 25,
            title: title,
            call_back: () => f()
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

    prettyDate(date, mini, f = null) {
        if (!date) return '';

        if (typeof (date) == "string") {
            date = frappe.datetime.convert_to_user_tz(date);
            date = new Date((date || "").replace(/-/g, "/").replace(/[TZ]/g, " ").replace(/\.[0-9]*/, ""));
        }

        let diff = (((new Date()).getTime() - date.getTime()) / 1000);
        let day_diff = Math.floor(diff / 86400);

        if (isNaN(day_diff) || day_diff < 0) return '';

        if (f) f(diff);

        if (mini) {
            // Return short format of time difference
            if (day_diff == 0) {
                if (diff < 60) {
                    return __("now");
                } else if (diff < 3600) {
                    return __("{0} m", [Math.floor(diff / 60)]);
                } else if (diff < 86400) {
                    return __("{0} h", [Math.floor(diff / 3600)]);
                }
            } else {
                if (day_diff < 7) {
                    return __("{0} d", [day_diff]);
                } else if (day_diff < 31) {
                    return __("{0} w", [Math.ceil(day_diff / 7)]);
                } else if (day_diff < 365) {
                    return __("{0} M", [Math.ceil(day_diff / 30)]);
                } else {
                    return __("{0} y", [Math.ceil(day_diff / 365)]);
                }
            }
        } else {
            // Return long format of time difference
            if (day_diff == 0) {
                if (diff < 60) {
                    return __("just now");
                } else if (diff < 120) {
                    return __("1 minute ago");
                } else if (diff < 3600) {
                    return __("{0} minutes ago", [Math.floor(diff / 60)]);
                } else if (diff < 7200) {
                    return __("1 hour ago");
                } else if (diff < 86400) {
                    return __("{0} hours ago", [Math.floor(diff / 3600)]);
                }
            } else {
                if (day_diff == 1) {
                    return __("yesterday");
                } else if (day_diff < 7) {
                    return __("{0} days ago", [day_diff]);
                } else if (day_diff < 14) {
                    return __("1 week ago");
                } else if (day_diff < 31) {
                    return __("{0} weeks ago", [Math.ceil(day_diff / 7)]);
                } else if (day_diff < 62) {
                    return __("1 month ago");
                } else if (day_diff < 365) {
                    return __("{0} months ago", [Math.ceil(day_diff / 30)]);
                } else if (day_diff < 730) {
                    return __("1 year ago");
                } else {
                    return __("{0} years ago", [Math.ceil(day_diff / 365)]);
                }
            }
        }
    }
}

RMHelper = new RMHelperClass();