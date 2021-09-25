
/*
 *
 *	(OK)		M		moveto								(x y)+
 * 	(OK)		Z		closepath							(none)
 *	(OK)		L		lineto								(x y)+
 *	(OK)		H		horizontal lineto					x+
 *	(OK)		V		vertical lineto						y+
 *	(OK)		C		curveto								(x1 y1 x2 y2 x y)+
 *	(OK)		S		smooth curveto						(x2 y2 x y)+
 *	(NO)		Q		Quadratic Bézier curveto			(x1 y1 x y)+
 *	(NO)		T		smooth quadratic Bézier curveto		(x y)+
 *	(NO)		A		elliptical arc						(rx ry x-axis-rotation large-arc-flag sweep-flag x y)+
 *	(NO)		R		Catmull-Rom curveto*				x1 y1 (x y)+
 *
 * */

import { color, geometry, Graphics, Mesh, Node, primitives, utils, Vec2 } from "cc";
import arcToBezier from "./arc2bezier";

const Scale2Dto3D = 1 / 100

export class Command {
    cmd = '';
    terms: number[] = []

    constructor (command: string) {
        this.cmd = command.substr(0, 1);

        let terms = (command.length > 1 ? command.substr(1).trim().split(" ") : [""]);
        this.terms = terms.map(t => parseFloat(t))
    }

    draw (ctx: Graphics, scale = 1) {
        let cmd = this.cmd;
        let terms = this.terms.map(t => scale * t);

        let x = (ctx.impl as any)._commandX as number;
        let y = (ctx.impl as any)._commandY as number;

        if (cmd == "m" || cmd == "M") {
            ctx.moveTo(x = terms[0], y = terms[1]);
            // if (terms.length > 2) {
            //     for (let i = 2; i < terms.length; i+=2) {
            //         ctx.lineTo(x += terms[i], y += terms[i + 1])
            //     }
            // }
        }
        else if (cmd == "l" || cmd == "L") {
            for (let i = 0; i < terms.length; i += 2) {
                let dx = cmd === 'l' ? x += terms[i] : terms[i]
                let dy = cmd === 'l' ? y += terms[i + 1] : terms[i + 1]
                ctx.lineTo(dx, dy)
            }
        }
        else if (cmd == "h" || cmd == "H") {
            for (let i = 0; i < terms.length; i++) {
                let dx = cmd === 'h' ? x += terms[i] : terms[i]
                ctx.lineTo(dx, y);
            }
        }
        else if (cmd == "v" || cmd == "V") {
            for (let i = 0; i < terms.length; i++) {
                let dy = cmd === 'v' ? y += terms[i + 1] : terms[i + 1]
                ctx.lineTo(x, dy);
            }
        }
        else if (cmd == "c") {
            for (let i = 0; i < terms.length; i += 6) {
                ctx.bezierCurveTo(x + terms[i], y + terms[i + 1], x + terms[i + 2], y + terms[i + 3], x += terms[i + 4], y += terms[i + 5]);
            }
        }
        else if (cmd == "C") {
            for (let i = 0; i < terms.length; i += 6) {
                ctx.bezierCurveTo(terms[i], terms[i + 1], terms[i + 2], terms[i + 3], terms[i + 4], terms[i + 5]);
            }
        }
        else if (cmd == "s") {
            for (let i = 0; i < terms.length; i += 4) {
                let cx2 = x + terms[i], cy2 = y + terms[i + 1];
                let dx = x + terms[i + 2], dy = y + terms[i + 3];
                let cx1 = x - (dx - cx2), cy1 = y - (dy - cy2);

                ctx.bezierCurveTo(cx1, cy1, cx2, cy2, dx, dy);

                x = dx; y = dy;
            }
        }
        else if (cmd == "S") {
            for (let i = 0; i < terms.length; i += 4) {
                let cx2 = terms[i], cy2 = terms[i + 1];
                let dx = terms[i + 2], dy = terms[i + 3];
                let cx1 = x - (dx - cx2), cy1 = y - (dy - cy2);

                ctx.bezierCurveTo(cx1, cy1, cx2, cy2, dx, dy);
            }
        }
        else if (cmd === 'Q') {
            for (let i = 0; i < terms.length; i += 4) {
                let cx = terms[i], cy = terms[i + 1];
                let dx = terms[i + 2], dy = terms[i + 3];
                ctx.quadraticCurveTo(cx, cy, dx, dy);
            }
        }
        else if (cmd === 'A') {
            for (let i = 0; i < terms.length; i += 7) {
                let curves = arcToBezier(x, y, terms[i + 5], terms[i + 6], terms[i], terms[i + 1], terms[i + 2], terms[i + 3], terms[i + 4])

                for (let j = 0; j < curves.length; j++) {
                    ctx.bezierCurveTo(curves[i].x1, curves[i].y1, curves[i].x2, curves[i].y2, curves[i].x, curves[i].y)
                }
            }
        }
        else if (cmd == "z" || cmd == "Z") {
            ctx.close();
        }
        else {
            console.log("UNKNOWN CMD: " + cmd);
        }
    }
}

class PathData {
    geo: primitives.IGeometry
    mesh: Mesh

    constructor (geo: primitives.IGeometry, mesh: Mesh) {
        this.geo = geo;
        this.mesh = mesh
    }
}

export class Path {
    cache2D: Map<number, PathData> = new Map
    cache3D: Map<number, PathData> = new Map

    commands: Command[] = []

    svg: SVG

    constructor (path: string, svg: SVG) {
        let matchRes = /d *= *"(.*?)"/g.exec(path)![1]
        let commands: string[] = []
        if (matchRes) {
            matchRes = matchRes.replace(/\s*([abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ])\s*/g, "\n$1 ")
                .replace(/,/g, " ")
                .replace(/-/g, " -")
                .replace(/ +/g, " ");

            commands = matchRes.split("\n");
            commands = commands.filter(c => c)
        }

        this.commands = commands.map(c => new Command(c))
        this.svg = svg
    }

    draw (ctx: Graphics, scale = 1) {
        let commands = this.commands
        for (let i = 0; i < commands.length; i++) {
            commands[i].draw(ctx, scale)
        }

        ctx.stroke();
    }

    get2D (ctx: Graphics, scale = 1) {
        let g = this.cache2D.get(scale)!;
        if (!g) {
            ctx.clear()

            let startDataOffset = ctx.impl!.dataOffset;
            let renderData = ctx.impl!.getRenderDataList()[startDataOffset]

            const AttrBytes = 8;

            let startVbOffset = renderData.vertexStart * AttrBytes;
            let startIbOffset = renderData.indicesStart;

            this.draw(ctx, scale)

            let positions: number[] = []
            let indices: number[] = []


            for (let i = startDataOffset; i <= ctx.impl!.dataOffset; i++) {
                let renderData = ctx.impl!.getRenderDataList()[i]

                let vb = renderData.vData;
                let ib = renderData.iData;

                let vbOffset = renderData.vertexStart * AttrBytes;
                let ibOffset = renderData.indicesStart;

                for (let j = startVbOffset; j < vbOffset; j += AttrBytes) {
                    positions.push(vb[j], this.svg.height - vb[j + 1], vb[j + 2])
                }
                for (let j = startIbOffset; j < ibOffset; j++) {
                    indices.push(ib[j])
                }
            }

            let info = {
                positions,
                indices
            }

            g = new PathData(info, utils.createMesh(info))
            this.cache2D.set(scale, g)
        }

        return g;
    }

    get3D (ctx: Graphics, scale = 1) {
        let g = this.cache3D.get(scale)!;
        if (!g) {
            let g2d = this.get2D(ctx, scale);

            let pos2D = g2d.geo.positions
            let indices2D = g2d.geo.indices!

            let positions: number[] = []
            let indices: number[] = []

            let verticesCount = pos2D.length / 3;
            for (let i = 0; i < pos2D.length; i += 3) {
                positions.push(pos2D[i] * Scale2Dto3D, pos2D[i + 1] * Scale2Dto3D, -0.01)
            }
            for (let i = 0; i < pos2D.length; i += 3) {
                positions.push(pos2D[i] * Scale2Dto3D, pos2D[i + 1] * Scale2Dto3D, 0.01)
            }

            indices = indices2D.concat()
            for (let i = 0; i < indices2D.length; i++) {
                indices.push(indices2D[i] + verticesCount)
            }

            for (let i = 0; i < indices2D.length; i += 3) {
                let v0 = indices[i]
                let v1 = indices[i + 1]
                let v2 = indices[i + 2]

                let v3 = indices[i + indices2D.length]
                let v4 = indices[i + indices2D.length + 1]
                let v5 = indices[i + indices2D.length + 2]

                indices.push(
                    v0, v3, v2,
                    v3, v5, v2,
                    v2, v5, v1,
                    v1, v5, v4,
                    v1, v4, v0,
                    v0, v4, v3,
                )
            }

            let info = {
                positions,
                indices
            }
            g = new PathData(info, utils.createMesh(info))

            this.cache3D.set(scale, g)
        }
        return g
    }
}

export class SVG {
    paths: Path[] = []

    width = 0
    height = 0

    constructor (str: string) {
        let svgEle = str.match(/<svg.*>/g)
        if (svgEle) {
            let res = /width="(.*?)"/.exec(svgEle[0])
            if (res && res[1]) {
                this.width = parseFloat(res[1])
            }
            res = /height="(.*?)"/.exec(svgEle[0])
            if (res && res[1]) {
                this.height = parseFloat(res[1])
            }
        }

        let paths = str.match(/<path.*\/>/g)!;
        for (let i = 0; i < paths.length; i++) {
            this.paths.push(new Path(paths[i], this))
        }
    }

    draw (ctx: Graphics, scale = 1) {

        let paths = this.paths
        for (let i = 0; i < paths.length; i++) {
            paths[i].draw(ctx, scale)
        }
    }
}
