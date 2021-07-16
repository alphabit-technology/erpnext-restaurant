class Drag {
    move(event, obj) {
        if (!obj.is_selected()) return;
        let target = event.target,
            // keep the dragged position in the data-x/data-y attributes
            x = (parseFloat(obj.data_style.x) || 0) + event.dx,
            y = (parseFloat(obj.data_style.y) || 0) + event.dy;

        // translate the element
        target.style.webkitTransform = target.style.transform = 'translate(' + x + 'px, ' + y + 'px)';

        // update the position attributes
        obj.set_data_style(x, y);
        obj.room.resize_container(obj);
    }

    resize(event, obj) {
        if (!obj.is_selected()) return;

        let target = event.target;
        let x = (parseFloat(obj.data_style.x) || 0);
        let y = (parseFloat(obj.data_style.y) || 0);

        // update the element's style
        target.style.width = event.rect.width + 'px';
        target.style.height = event.rect.height + 'px';

        // translate when resizing from top or left edges
        x += event.deltaRect.left;
        y += event.deltaRect.top;

        target.style.transform = 'translate(' + x + 'px,' + y + 'px)';

        obj.set_data_style(x, y);
        obj.room.resize_container(obj);
    }
}

let drag = new Drag();