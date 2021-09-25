
import { Vec2 } from 'cc';

const PI = Math.PI;
const min = Math.min;
const max = Math.max;
const cos = Math.cos;
const sin = Math.sin;
const abs = Math.abs;
const sign = Math.sign;

const KAPPA90 = 0.5522847493;

const TessTol = 0.25

export function add (out: Vec2[], x: number, y: number) {
    out.push(new Vec2(x, y))
}

export function moveTo (out: Vec2[], x: number, y: number) {
    add(out, x, y)
}

export function lineTo (out: Vec2[], x: number, y: number) {
    add(out, x, y)
}

export function bezierCurveTo (out: Vec2[], c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number) {
    const last = out[out.length - 1];
    if (!last) {
        return;
    }

    if (last.x === c1x && last.y === c1y && c2x === x && c2y === y) {
        lineTo(out, x, y);
        return;
    }

    tesselateBezier(out, last.x, last.y, c1x, c1y, c2x, c2y, x, y, 0);
}

export function arc (out: Vec2[], cx: number, cy: number, r: number, startAngle: number, endAngle: number, counterclockwise: boolean) {
    counterclockwise = counterclockwise || false;

    let a = 0;
    let da = 0;
    let hda = 0;
    let kappa = 0;
    let dx = 0;
    let dy = 0;
    let x = 0;
    let y = 0;
    let tanx = 0;
    let tany = 0;
    let px = 0;
    let py = 0;
    let ptanx = 0;
    let ptany = 0;
    let i = 0;
    let ndivs = 0;

    // Clamp angles
    da = endAngle - startAngle;
    if (counterclockwise) {
        if (abs(da) >= PI * 2) {
            da = PI * 2;
        } else {
            while (da < 0) { da += PI * 2; }
        }
    } else if (abs(da) >= PI * 2) {
        da = -PI * 2;
    } else {
        while (da > 0) { da -= PI * 2; }
    }

    // Split arc into max 90 degree segments.
    ndivs = max(1, min(abs(da) / (PI * 0.5) + 0.5, 5)) | 0;
    hda = da / ndivs / 2.0;
    kappa = abs(4.0 / 3.0 * (1 - cos(hda)) / sin(hda));

    if (!counterclockwise) { kappa = -kappa; }

    for (i = 0; i <= ndivs; i++) {
        a = startAngle + da * (i / ndivs);
        dx = cos(a);
        dy = sin(a);
        x = cx + dx * r;
        y = cy + dy * r;
        tanx = -dy * r * kappa;
        tany = dx * r * kappa;

        if (i === 0) {
            moveTo(out, x, y);
        } else {
            bezierCurveTo(out, px + ptanx, py + ptany, x - tanx, y - tany, x, y);
        }
        px = x;
        py = y;
        ptanx = tanx;
        ptany = tany;
    }
}

export function rect (out: Vec2[], x: number, y: number, w: number, h: number) {
    moveTo(out, x, y);
    lineTo(out, x + w, y);
    lineTo(out, x + w, y + h);
    lineTo(out, x, y + h);
}

export function ellipse (out: Vec2[], cx: number, cy: number, rx: number, ry: number) {
    moveTo(out, cx - rx, cy);
    bezierCurveTo(out, cx - rx, cy + ry * KAPPA90, cx - rx * KAPPA90, cy + ry, cx, cy + ry);
    bezierCurveTo(out, cx + rx * KAPPA90, cy + ry, cx + rx, cy + ry * KAPPA90, cx + rx, cy);
    bezierCurveTo(out, cx + rx, cy - ry * KAPPA90, cx + rx * KAPPA90, cy - ry, cx, cy - ry);
    bezierCurveTo(out, cx - rx * KAPPA90, cy - ry, cx - rx, cy - ry * KAPPA90, cx - rx, cy);
}

export function roundRect (out: Vec2[], x: number, y: number, w: number, h: number, r: number) {
    if (r < 0.1) {
        rect(out, x, y, w, h);
    } else {
        const rx = min(r, abs(w) * 0.5) * sign(w);
        const ry = min(r, abs(h) * 0.5) * sign(h);

        moveTo(out, x, y + ry);
        lineTo(out, x, y + h - ry);
        bezierCurveTo(out, x, y + h - ry * (1 - KAPPA90), x + rx * (1 - KAPPA90), y + h, x + rx, y + h);
        lineTo(out, x + w - rx, y + h);
        bezierCurveTo(out, x + w - rx * (1 - KAPPA90), y + h, x + w, y + h - ry * (1 - KAPPA90), x + w, y + h - ry);
        lineTo(out, x + w, y + ry);
        bezierCurveTo(out, x + w, y + ry * (1 - KAPPA90), x + w - rx * (1 - KAPPA90), y, x + w - rx, y);
        lineTo(out, x + rx, y);
        bezierCurveTo(out, x + rx * (1 - KAPPA90), y, x, y + ry * (1 - KAPPA90), x, y + ry);
    }
}

export function tesselateBezier (
    out: Vec2[], x1: number, y1: number,
    x2: number, y2: number,
    x3: number, y3: number,
    x4: number, y4: number,
    level: number,
) {
    let x12 = 0;
    let y12 = 0;
    let x23 = 0;
    let y23 = 0;
    let x34 = 0;
    let y34 = 0;
    let x123 = 0;
    let y123 = 0;
    let x234 = 0;
    let y234 = 0;
    let x1234 = 0;
    let y1234 = 0;
    let dx = 0;
    let dy = 0;
    let d2 = 0;
    let d3 = 0;

    if (level > 10) {
        return;
    }

    x12 = (x1 + x2) * 0.5;
    y12 = (y1 + y2) * 0.5;
    x23 = (x2 + x3) * 0.5;
    y23 = (y2 + y3) * 0.5;
    x34 = (x3 + x4) * 0.5;
    y34 = (y3 + y4) * 0.5;
    x123 = (x12 + x23) * 0.5;
    y123 = (y12 + y23) * 0.5;

    dx = x4 - x1;
    dy = y4 - y1;
    d2 = abs((x2 - x4) * dy - (y2 - y4) * dx);
    d3 = abs((x3 - x4) * dy - (y3 - y4) * dx);

    if ((d2 + d3) * (d2 + d3) < TessTol * (dx * dx + dy * dy)) {
        add(out, x4, y4);
        return;
    }

    x234 = (x23 + x34) * 0.5;
    y234 = (y23 + y34) * 0.5;
    x1234 = (x123 + x234) * 0.5;
    y1234 = (y123 + y234) * 0.5;

    tesselateBezier(out, x1, y1, x12, y12, x123, y123, x1234, y1234, level + 1);
    tesselateBezier(out, x1234, y1234, x234, y234, x34, y34, x4, y4, level + 1);
}
