import { assetManager, CCObject, Color, Component, Director, director, EffectAsset, error, find, Game, game, geometry, gfx, Mat4, Material, Mesh, MeshRenderer, Node, primitives, PrimitiveType, Quat, utils, Vec3, _decorator, __private } from 'cc';
import { createMesh } from '../spline-tool/editor/asset-operation';
import { Font, FontType } from './svg/font';
import { SVG } from './svg/svg';

const { ccclass } = _decorator;

let _tempVec3 = new Vec3;
let _tempBoxVec3 = new Array(8).fill(0).map(_ => new Vec3)

let UseInstance = true;

let _tempPos = new Vec3
let _tempRotation = new Quat
let _tempScale = new Vec3

let DrawTypeIndex = 0;
export enum DrawType {
    Solid = 1 << DrawTypeIndex++,
    FrameWire = 1 << DrawTypeIndex++,
    FrameWireDouble = 1 << DrawTypeIndex++,
    Line = 1 << DrawTypeIndex++,
    LineDouble = 1 << DrawTypeIndex++,
}

export enum CullMode {
    Back = gfx.CullMode.BACK,
    Front = gfx.CullMode.FRONT,
    None = gfx.CullMode.NONE,
}


let tempBox = primitives.box();
let tempPrimitive: primitives.IGeometry = {
    positions: tempBox.positions,
    colors: new Array(tempBox.positions.length / 3 * 4).fill(255),
    indices: tempBox.indices,
    minPos: new Vec3(-1000, -1000, -1000),
    maxPos: new Vec3(1000, 1000, 1000)
};

export const TechniqueNams = {
    opaque: 'opaque',
    transparent: 'transparent'
}

class CachedMeshData {
    root: Node
    rootMR: MeshRenderer | undefined

    rendererIndex = -1;
    renderers: MeshRenderer[] = []

    vb = new Float32Array(1024)
    ib = new Uint16Array(1024)

    vertexCount = 0;
    indexCount = 0

    constructor (material: Material, mesh: Mesh) {
        this.root = new Node('root')

        if (!UseInstance) {
            this.rootMR = this.root.addComponent(MeshRenderer)
            this.rootMR.material = material;
            this.rootMR.mesh = utils.createMesh(tempPrimitive);
        }
    }
}

class CachedMaterialData {
    material: Material
    meshes: Map<Mesh, CachedMeshData> = new Map

    constructor (material: Material) {
        this.material = material;
    }
}

@ccclass('MeshDrawer')
export class MeshDrawer extends Component {
    color = Color.WHITE.clone();
    frameWireColor = Color.RED.clone();

    type = DrawType.Solid;
    cull = CullMode.Back;

    depthTest: undefined | boolean;
    depthWrite: undefined | boolean;
    depthFunc: undefined | gfx.ComparisonFunc;

    // effect = 'builtin-unlit';
    technique = TechniqueNams.transparent;

    matrix = new Mat4;

    depth (depthTest?: boolean, depthWrite?: boolean, depthFunc?: gfx.ComparisonFunc) {
        this.depthTest = depthTest;
        this.depthWrite = depthWrite;
        this.depthFunc = depthFunc;
    }

    get id () {
        return `${this.technique}_${this.cull}_${this.depthTest}_${this.depthWrite}_${this.depthFunc}_${this._primitiveMode}`;
    }

    resetState () {
        this.color.set(Color.WHITE);
        this.type = DrawType.Solid;
        this.cull = CullMode.Back;
        this.depthTest = undefined;
        this.depthWrite = undefined;
        this.depthFunc = undefined;
        this.technique = TechniqueNams.transparent;
        this.matrix.identity();
    }

    clear () {
        this.resetState();

        this._cachedMaterialDatas.forEach(md => {
            md.meshes.forEach(md => {
                md.vertexCount = 0;
                md.indexCount = 0;

                md.rendererIndex = 0;
                md.renderers.forEach(r => {
                    r.model!.enabled = false;
                })
            })
        })

        // this._meshDatas.forEach(meshData => {
        //     meshData.vertexCount = 0;
        //     meshData.indexCount = 0;
        // })
    }

    _cachedMeshes: Map<string, Mesh> = new Map
    _cachedNodes: Map<Material, Map<Mesh, Node[]>> = new Map
    _cachedMaterialDatas: Map<string, CachedMaterialData> = new Map

    _cachedGeometries: Map<string, primitives.IGeometry> = new Map()

    _primitiveMode = gfx.PrimitiveMode.TRIANGLE_LIST

    _effect: EffectAsset | undefined

    _lineMesh: Mesh | undefined
    getLineMesh () {
        if (!this._lineMesh) {
            let pi = Object.assign({}, tempPrimitive)
            pi.primitiveMode = gfx.PrimitiveMode.LINE_LIST
            this._lineMesh = utils.createMesh(pi)
        }

        return this._lineMesh;
    }
    getMesh (name: string) {
        let mesh = this._cachedMeshes.get(name);
        if (!mesh) {
            let g = this.getGeometry(name)
            mesh = utils.createMesh(g);
            this._cachedMeshes.set(name, mesh);
        }
        return mesh;
    }
    getGeometry (name: string) {
        let g = this._cachedGeometries.get(name)!;
        if (!g) {
            let func = (primitives as any)[name];
            if (!func) {
                console.warn(`Can not find primitives.${name}`);
                func = primitives.box;
            }

            if (name === 'sphere') {
                g = primitives.sphere(1)
            }
            else {
                g = func()
            }
            this._cachedGeometries.set(name, g);
        }
        return g;
    }

    box () {
        this.primitive('box')
    }
    sphere () {
        this.primitive('sphere')
    }
    cylinder () {
        this.primitive('cylinder')
    }
    cone () {
        this.primitive('cone')
    }
    capsule () {
        this.primitive('capsule')
    }
    torus () {
        this.primitive('torus')
    }
    quad () {
        this.primitive('quad')
    }
    plane () {
        this.primitive('plane')
    }

    text (t: string, scale = 1) {
        // UseInstance = true;

        let cull = this.cull

        this.cull = CullMode.None

        let space = 0;//0.1;
        let offset = 0;
        for (let i = 0; i < t.length; i++) {
            let data = Font.Lora.get(t[i], scale)
            if (!data) {
                continue
            }

            if (this.type & DrawType.Solid) {
                let width = data.geo.maxPos!.x - data.geo.minPos!.x
                this.matrix.m12 += offset + width / 2;
                this.draw(data.mesh, gfx.PrimitiveMode.TRIANGLE_LIST)
                offset = space + width / 2;
            }
        }

        this.cull = cull

        // UseInstance = false;
    }

    primitive (name: string) {
        if (this.type & DrawType.Solid) {
            this.draw(this.getMesh(name), gfx.PrimitiveMode.TRIANGLE_LIST);
        }

        if (this.type & DrawType.Line || this.type & DrawType.LineDouble || this.type & DrawType.FrameWire || this.type & DrawType.FrameWireDouble) {
            let g = this.getGeometry(name)

            let lineFunc = (this as any)['_line_' + name]
            if ((this.type & DrawType.Line || this.type & DrawType.LineDouble) && lineFunc) {
                g = lineFunc.call(this)
            }

            this.draw(this.getLineMesh(), gfx.PrimitiveMode.LINE_LIST, g)
        }
    }

    createMaterial () {
        if (!this._effect) {
            loadBuiltinEffect((err: any, effect: EffectAsset) => {
                this._effect = effect;
            })
            if (!this._effect) {
                return;
            }
        }

        let techniqueIndex = this._effect.techniques.findIndex(t => {
            return t.name === this.technique;
        })

        let depthStencilState: any = {}
        if (this.depthFunc !== undefined) {
            depthStencilState.depthFunc = this.depthFunc
        }
        if (this.depthTest !== undefined) {
            depthStencilState.depthTest = this.depthTest
        }
        if (this.depthWrite !== undefined) {
            depthStencilState.depthWrite = this.depthWrite
        }

        let m = new Material()
        m.initialize({
            effectAsset: this._effect,
            technique: techniqueIndex,
            states: {
                primitive: this._primitiveMode,
                rasterizerState: {
                    cullMode: this.cull as any
                },
                depthStencilState: depthStencilState
            },
            defines: {
                USE_VERTEX_COLOR: !UseInstance
            }
        });

        return m;
    }

    draw (mesh: Mesh, primitiveMode: gfx.PrimitiveMode, info?: primitives.IGeometry) {
        this._primitiveMode = primitiveMode;

        let id = this.id;
        let materialData = this._cachedMaterialDatas.get(id);
        if (!materialData) {
            let material = this.createMaterial();
            if (!material) {
                return;
            }

            materialData = new CachedMaterialData(material);
            this._cachedMaterialDatas.set(id, materialData);
        }

        let meshData = materialData.meshes.get(mesh)
        if (!meshData) {
            meshData = new CachedMeshData(materialData.material, mesh)

            meshData.root.parent = this.node;
            materialData.meshes.set(mesh, meshData)
        }

        if (!UseInstance) {
            let color = this.color;
            if (primitiveMode === gfx.PrimitiveMode.LINE_LIST) {
                color = this.frameWireColor;
            }

            if (mesh.renderingSubMeshes.length) {
                let vb = meshData.vb;
                let ib = meshData.ib;

                const VectexStride = 7;

                let vbOffset = meshData.vertexCount * VectexStride;
                let ibOffset = meshData.indexCount;

                let vertexStart = meshData.vertexCount;

                info = info! || mesh.renderingSubMeshes[0].geometricInfo;
                let positions = info.positions;
                let indices = info.indices!;

                if ((meshData.vertexCount + positions.length / 3) * VectexStride > vb.length) {
                    let newBuffer = new Float32Array(vb.length * 2)
                    newBuffer.set(vb)
                    vb = meshData.vb = newBuffer
                }

                let indexCount = 0;
                if (primitiveMode === gfx.PrimitiveMode.LINE_LIST) {
                    indexCount = indices.length * 2;
                }
                else if (primitiveMode === gfx.PrimitiveMode.TRIANGLE_LIST) {
                    indexCount = indices.length;
                }
                if ((meshData.indexCount + indexCount) > ib.length) {
                    let newBufferr = new Uint16Array(ib.length * 2)
                    newBufferr.set(ib)
                    ib = meshData.ib = newBufferr
                }

                for (let i = 0; i < positions.length; i += 3) {
                    _tempVec3.set(positions[i], positions[i + 1], positions[i + 2]);
                    Vec3.transformMat4(_tempVec3, _tempVec3, this.matrix);

                    vb[vbOffset++] = _tempVec3.x;
                    vb[vbOffset++] = _tempVec3.y;
                    vb[vbOffset++] = _tempVec3.z;

                    vb[vbOffset++] = color.x;
                    vb[vbOffset++] = color.y;
                    vb[vbOffset++] = color.z;
                    vb[vbOffset++] = color.w;
                }

                if (primitiveMode === gfx.PrimitiveMode.TRIANGLE_LIST) {
                    for (let i = 0; i < indices.length; i++) {
                        ib[ibOffset++] = vertexStart + indices[i];
                    }
                }
                else if (primitiveMode === gfx.PrimitiveMode.LINE_LIST) {
                    if (this.type & DrawType.Line || this.type & DrawType.LineDouble) {
                        for (let i = 0; i < indices.length - 1; i++) {
                            ib[ibOffset++] = vertexStart + indices[i];
                            ib[ibOffset++] = vertexStart + indices[i + 1];
                        }
                    }
                    else if ((this.type & DrawType.FrameWire) || (this.type & DrawType.FrameWireDouble)) {
                        for (let i = 0; i < indices.length; i += 3) {
                            let a = indices[i + 0] + vertexStart;
                            let b = indices[i + 1] + vertexStart;
                            let c = indices[i + 2] + vertexStart;

                            ib[ibOffset++] = a;
                            ib[ibOffset++] = b;
                            ib[ibOffset++] = b;
                            ib[ibOffset++] = c;
                            ib[ibOffset++] = c;
                            ib[ibOffset++] = a;
                        }
                    }
                }

                meshData.vertexCount = vbOffset / VectexStride;
                meshData.indexCount = ibOffset;
            }
        }
        else {
            let renderer = meshData.renderers[meshData.rendererIndex]
            if (!renderer) {
                let node = new Node
                node._objFlags |= CCObject.Flags.DontSave;
                node.parent = meshData.root;

                let mr = node.addComponent(MeshRenderer)
                mr.mesh = mesh
                mr.material = materialData.material;
                renderer = mr;

                meshData.renderers.push(mr);
            }
            else {
                renderer.model!.enabled = true;
            }

            meshData.rendererIndex++;

            Mat4.toRTS(this.matrix, _tempRotation, _tempPos, _tempScale);
            renderer.node.setRTS(_tempRotation, _tempPos, _tempScale);

            renderer.material!.setProperty('mainColor', this.color);
        }
    }

    private _line_box () {
        let info = this._cachedGeometries.get('_line_box')
        if (!info) {
            let w = 1 / 2;
            let h = 1 / 2;
            let l = 1 / 2;

            let points = [
                _tempBoxVec3[0].set(-w, -h, l), _tempBoxVec3[1].set(w, -h, l), _tempBoxVec3[2].set(w, h, l), _tempBoxVec3[3].set(-w, h, l),
                _tempBoxVec3[4].set(-w, -h, -l), _tempBoxVec3[5].set(w, -h, -l), _tempBoxVec3[6].set(w, h, -l), _tempBoxVec3[7].set(-w, h, -l)
            ]
            let sortedPoints: Vec3[][] = []
            sortedPoints.push(points.slice(0, 4));
            sortedPoints.push(points.slice(4, 8));

            for (let i = 0; i < 4; i++) {
                sortedPoints.push([points[i], points[i + 4]]);
            }

            info = this._line(...sortedPoints)
            this._cachedGeometries.set('_line_box', info)
        }
        return info
    }

    private _line (...args: Vec3[][]): primitives.IGeometry {
        let positions: number[] = []
        let indices: number[] = []

        let pointIndex = 0;
        args.forEach(points => {
            let startIndex = pointIndex;
            for (let i = 0; i < points.length; i++) {
                positions.push(points[i].x, points[i].y, points[i].z);
                if ((i + 1) < points.length) {
                    indices.push(pointIndex, pointIndex + 1);
                }
                else {
                    indices.push(pointIndex, startIndex);
                }
                pointIndex++;
            }
        })

        return {
            positions,
            indices,
        }
    }

    line (...args: Vec3[][]) {
        let p = this._line(...args);
        p.primitiveMode = gfx.PrimitiveMode.LINE_LIST;
        // this.primitive(p, this.frameWireColor);
    }

    finish () {
        if (!UseInstance) {
            this._cachedMaterialDatas.forEach(md => {
                md.meshes.forEach(md => {
                    let mr = md.rootMR;
                    if (!mr) {
                        return;
                    }
                    let mesh = mr.mesh;
                    if (!mesh) {
                        return;
                    }

                    let subMesh = mesh.renderingSubMeshes[0];

                    let vb = subMesh.vertexBuffers[0];
                    let vbuffer = new Float32Array(md.vb);
                    let vertexByteLength = vbuffer.byteLength;
                    if (vertexByteLength > vb.size) {
                        vb.resize(vertexByteLength);
                    }
                    vb.update(vbuffer, vertexByteLength);

                    let ib = subMesh.indexBuffer!;
                    let ibuffer = new Uint16Array(md.ib);
                    let indexByteLength = ibuffer.byteLength;
                    if (indexByteLength > ib.size) {
                        ib.resize(ibuffer.byteLength);
                    }
                    ib.update(ibuffer.buffer, indexByteLength);

                    let model = mr.model!.subModels[0]!;
                    let ia = model.inputAssembler!;
                    ia.vertexCount = md.vertexCount;
                    ia.indexCount = md.indexCount;
                    model.update();
                })
            })
        }
    }

}

class Debug {
    get drawer () {
        let drawNode = find('DEBUG_GLOBAL_DRAW')!;
        if (!drawNode || !drawNode.isValid) {
            drawNode = new Node('DEBUG_GLOBAL_DRAW');
            drawNode._objFlags |= CCObject.Flags.DontSave | CCObject.Flags.HideInHierarchy;
            drawNode.parent = director.getScene() as any;
        }

        let drawer = drawNode.getComponent(MeshDrawer);
        if (!drawer) {
            drawer = drawNode.addComponent(MeshDrawer);
        }

        return drawer;
    }

    _beforeUpdate () {
        if (!director.getScene()) {
            return;
        }
        let drawer = this.drawer;
        drawer.clear();

        // drawer.color.set(Color.WHITE);
        // drawer.box({})

        drawer.technique = TechniqueNams.transparent;
        drawer.type = DrawType.Solid | DrawType.FrameWireDouble;

        // drawer.color.set(Color.WHITE);
        // drawer.box({
        //     width: 1,
        //     height: 1,
        //     length: 1
        // })

        // drawer.matrix.translate(_tempVec3.set(2, 0, 0))

        // drawer.box({
        //     width: 2,
        //     height: 2,
        //     length: 2
        // })

        // drawer.color.set(255, 0, 0, 100);
        // drawer.box({
        //     width: 2,
        //     height: 2,
        //     length: 2
        // })

    }
    _beforeDraw () {
        if (!director.getScene()) {
            return;
        }
        this.drawer.finish();
    }
}

let globalAny = globalThis as any;

if (globalAny.debug) {
    director.off(Director.EVENT_BEFORE_DRAW, globalAny.debug._beforeDraw, globalAny.debug);
    director.off(Director.EVENT_BEFORE_UPDATE, globalAny.debug._beforeUpdate, globalAny.debug);

    let globalDrawer = find('DEBUG_GLOBAL_DRAW');
    if (globalDrawer) {
        globalDrawer.destroy();
    }
}

export let debug = globalAny.debug = new Debug;

director.on(Director.EVENT_BEFORE_DRAW, globalAny.debug._beforeDraw, globalAny.debug);
director.on(Director.EVENT_BEFORE_UPDATE, globalAny.debug._beforeUpdate, globalAny.debug);

function loadBuiltinEffect (cb: Function) {
    // let effect = EffectAsset.get('builtin-unlit') || EffectAsset.get('unlit')
    assetManager.loadAny('a3cd009f-0ab0-420d-9278-b9fdab939bbc', cb)
}

game.on(Game.EVENT_GAME_INITED, () => {
    loadBuiltinEffect(() => { });
})