class Drag {
    move(e, obj) {
        if (!obj.is_selected) return;
        let target = e.target,
            x = (parseFloat(obj.data_style.x) || 0) + e.dx,
            y = (parseFloat(obj.data_style.y) || 0) + e.dy;

        target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

        obj.set_data_style(x, y);
        obj.room.resize_container(obj);
    }

    resize(e, obj) {
        if (!obj.is_selected) return;

        let target = e.target,
            x = (parseFloat(obj.data_style.x) || 0),
            y = (parseFloat(obj.data_style.y) || 0);

        target.style.width = e.rect.width + 'px';
        target.style.height = e.rect.height + 'px';

        x += e.deltaRect.left;
        y += e.deltaRect.top;

        target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

        obj.set_data_style(x, y);
        obj.room.resize_container(obj);
    }
}

let drag = new Drag();