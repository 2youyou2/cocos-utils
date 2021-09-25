
import { Graphics, Node } from 'cc';
import { SVG } from '../svg';
import LoraStr from './lora'

// Get font from https://danmarshall.github.io/google-font-to-svg-path/

export enum FontType {
    E2D,
    E3D
}

class FontData {
    ctx: Graphics
    svg: SVG

    constructor (str: string) {
        let node = new Node
        this.ctx = node.addComponent(Graphics)

        this.ctx.lineCap = Graphics.LineCap.ROUND
        this.ctx.lineJoin = Graphics.LineJoin.ROUND
        this.ctx.lineWidth = 1

        this.svg = new SVG(str);
    }

    get (letter: string, scale = 1, type = FontType.E3D) {
        let index = letter.charCodeAt(0) - 33
        let path = this.svg.paths[index]
        if (!path) {
            return
        }

        if (type === FontType.E3D) {
            return path.get3D(this.ctx, scale)
        }

        return path.get2D(this.ctx, scale)
    }
}


let cache: Map<string, FontData> = new Map

export let Font = {
    get Lora () {
        let data = cache.get('Lora')!
        if (!data) {
            data = new FontData(LoraStr)
            cache.set('Lora', data)
        }
        return data
    }
}
