import { assetManager, CCObject, Color, Component, Director, director, EffectAsset, error, find, gfx, Mat4, Material, Mesh, MeshRenderer, Node, primitives, utils, Vec3, _decorator, __private } from 'cc';

const { ccclass } = _decorator;

let _tempVec3 = new Vec3;
let _tempBoxVec3 = new Array(8).fill(0).map(_ => new Vec3)

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

interface MeshData {
    mesh: Mesh,
    vbuffer: Float32Array,
    ibuffer: Uint16Array,
    vertexCount: number,
    indexCount: number,
    primitiveMode: gfx.PrimitiveMode,

    cullMode: gfx.CullMode,

    depthFunc?: gfx.ComparisonFunc,
    depthTest?: boolean,
    depthWrite?: boolean,

    technique: string;

    id: string,
}

let tempBox = primitives.box();
let tempPrimitive: primitives.IGeometry = {
    positions: tempBox.positions,
    colors: new Array(tempBox.positions.length / 3 * 4).fill(255),
    indices: tempBox.indices,
    minPos: new Vec3(-Infinity, -Infinity, -Infinity),
    maxPos: new Vec3(Infinity, Infinity, Infinity)
};

export const TechniqueNams = {
    opaque: 'opaque',
    transparent: 'transparent'
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
        return `${this.technique}_${this.cull}_${this.depthTest}_${this.depthWrite}_${this.depthFunc}`;
    }

    constructor () {
        super();

        this._line = this._line.bind(this);
        this._line_box = this._line_box.bind(this);

        let solidPriMap: Map<string, primitives.IGeometry> = new Map

        for (let name in primitives) {
            if (!(this as any)[name]) continue;
            (this as any)[name] = (...args: any[]) => {
                let solidFunc = (primitives as any)[name];

                let lineFunc: any;
                if (this.type & DrawType.Line || this.type & DrawType.LineDouble) {
                    lineFunc = (this as any)['_line_' + name];
                }

                let solidPri: primitives.IGeometry = solidPriMap.get(name)!;
                if (!solidPri) {
                    solidPri = solidFunc(...args);
                    solidPriMap.set(name, solidPri);
                }

                let linePri: primitives.IGeometry = solidPri;
                if (lineFunc) {
                    linePri = lineFunc(...args);
                }

                if (this.type & DrawType.Solid) {
                    solidPri.primitiveMode = gfx.PrimitiveMode.TRIANGLE_LIST;
                    this.primitive(solidPri, this.color);
                }
                if (this.type & DrawType.FrameWire || this.type & DrawType.FrameWireDouble ||
                    this.type & DrawType.Line || this.type & DrawType.LineDouble) {
                    linePri.primitiveMode = gfx.PrimitiveMode.LINE_LIST;
                    this.primitive(linePri, this.frameWireColor);
                }
                if (this.type & DrawType.FrameWireDouble || this.type & DrawType.LineDouble) {
                    linePri.primitiveMode = gfx.PrimitiveMode.LINE_LIST;

                    let depthFunc = this.depthFunc;
                    let alpha = this.frameWireColor.a;
                    let technique = this.technique;

                    this.depthFunc = gfx.ComparisonFunc.GREATER;
                    this.frameWireColor.a = 30;
                    this.technique = TechniqueNams.transparent;

                    this.primitive(linePri, this.frameWireColor);

                    this.depthFunc = depthFunc;
                    this.frameWireColor.a = alpha;
                    this.technique = technique;
                }
            };
        }
    }

    resetState () {
        this.color.set(Color.WHITE);
        this.type = DrawType.Solid;
        this.cull = CullMode.Back;
        this.depthTest = undefined;
        this.depthWrite = undefined;
        this.depthFunc = undefined;
        this.technique = TechniqueNams.opaque;
        this.matrix.identity();
    }

    clear () {
        this.resetState();

        this._meshDatas.forEach(meshData => {
            meshData.vertexCount = 0;
            meshData.indexCount = 0;
        })
    }

    box = primitives.box
    sphere = primitives.sphere
    cylinder = primitives.cylinder
    cone = primitives.cone
    capsule = primitives.capsule
    torus = primitives.torus
    plane = primitives.plane
    quad = primitives.quad

    private _line_box (options: __private.cocos_primitive_box_IBoxOptions) {
        let w = ((options && options.width) || 1) / 2;
        let h = ((options && options.height) || 1) / 2;
        let l = ((options && options.length) || 1) / 2;

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

        return this._line(...sortedPoints)
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
        this.primitive(p, this.frameWireColor);
    }

    primitive (primitive: primitives.IGeometry, color: Color) {
        let primitiveMode = primitive.primitiveMode!;

        let id = this.id + '_' + primitiveMode;
        let meshData = this._meshDatas.get(id);
        if (!meshData) {
            tempPrimitive.primitiveMode = primitiveMode;
            tempPrimitive.minPos = new Vec3(-1000, -1000, -1000);
            tempPrimitive.maxPos = new Vec3(1000, 1000, 1000);
            meshData = {
                mesh: utils.createMesh(tempPrimitive),
                vertexCount: 0,
                indexCount: 0,
                vbuffer: new Float32Array(1024),
                ibuffer: new Uint16Array(1024),
                primitiveMode: primitiveMode,

                cullMode: this.cull as any,

                depthWrite: this.depthWrite,
                depthTest: this.depthTest,
                depthFunc: this.depthFunc,

                technique: this.technique,

                id: id
            }
            this._meshDatas.set(id, meshData);
        }

        // 
        let positions = primitive.positions;
        let indices = primitive.indices!;

        let vbuffer = meshData.vbuffer;
        let ibuffer = meshData.ibuffer;

        let vertexStart = meshData.vertexCount;
        let vertexCount = positions.length / 3;

        // 
        let vbOffset = vertexStart * 7;
        let ibOffset = meshData.indexCount;

        // 
        meshData.vertexCount += vertexCount;

        let indexCount = 0;
        if (primitiveMode === gfx.PrimitiveMode.POINT_LIST) {
            indexCount = vertexCount;
        }
        else if (primitiveMode === gfx.PrimitiveMode.LINE_LIST) {
            indexCount = indices.length * 2;
        }
        else if (primitiveMode === gfx.PrimitiveMode.TRIANGLE_LIST) {
            indexCount = indices.length;
        }

        meshData.indexCount += indexCount;

        // 
        if ((meshData.vertexCount * 7) > vbuffer.length) {
            meshData.vbuffer = new Float32Array(vbuffer.length * 2);
            meshData.vbuffer.set(vbuffer);
            vbuffer = meshData.vbuffer;
        }
        if (meshData.indexCount > ibuffer.length) {
            meshData.ibuffer = new Uint16Array(ibuffer.length * 2);
            meshData.ibuffer.set(ibuffer);
            ibuffer = meshData.ibuffer;
        }

        // 
        let positionsOffset = 0;
        for (let i = 0; i < vertexCount; i++) {
            _tempVec3.set(positions[positionsOffset++], positions[positionsOffset++], positions[positionsOffset++]);
            Vec3.transformMat4(_tempVec3, _tempVec3, this.matrix);

            vbuffer[vbOffset++] = _tempVec3.x;
            vbuffer[vbOffset++] = _tempVec3.y;
            vbuffer[vbOffset++] = _tempVec3.z;

            vbuffer[vbOffset++] = color.x;
            vbuffer[vbOffset++] = color.y;
            vbuffer[vbOffset++] = color.z;
            vbuffer[vbOffset++] = color.w;

            if (primitiveMode === gfx.PrimitiveMode.POINT_LIST) {
                ibuffer[ibOffset++] = vertexStart + i;
            }
        }

        if (primitiveMode === gfx.PrimitiveMode.TRIANGLE_LIST) {
            for (let i = 0; i < indices.length; i++) {
                ibuffer[ibOffset++] = vertexStart + indices[i];
            }
        }
        else if (primitiveMode === gfx.PrimitiveMode.LINE_LIST) {
            for (let i = 0; i < indices.length - 1; i++) {
                ibuffer[ibOffset++] = vertexStart + indices[i];
                ibuffer[ibOffset++] = vertexStart + indices[i + 1];
            }

            if ((this.type & DrawType.FrameWire) || (this.type & DrawType.FrameWireDouble)) {
                ibuffer[ibOffset++] = vertexStart + indices[indices.length - 1];
                ibuffer[ibOffset++] = vertexStart + indices[0];
            }
        }
    }

    finish () {
        this._meshDatas.forEach(meshData => {
            let name = 'MeshDrawer_' + meshData.id;
            let node = find(name, this.node)!;
            if (!meshData.vertexCount || !meshData.indexCount) {
                if (node) {
                    node.destroy();
                }
                return;
            }

            let mesh = meshData.mesh;
            let subMesh = mesh.renderingSubMeshes[0];

            let vb = subMesh.vertexBuffers[0];
            let vbuffer = meshData.vbuffer;
            let vertexByteLength = meshData.vertexCount * 7 * 4;
            if (vertexByteLength > vb.size) {
                vb.resize(vertexByteLength);
            }
            vb.update(vbuffer.buffer, vertexByteLength);

            let ib = subMesh.indexBuffer!;
            let ibuffer = meshData.ibuffer;
            let indexByteLength = meshData.indexCount * 2;
            if (indexByteLength > ib.size) {
                ib.resize(ibuffer.byteLength);
            }
            ib.update(ibuffer.buffer, indexByteLength);

            if (!node) {
                node = new Node(name);
                node._objFlags |= CCObject.Flags.DontSave;
                node.parent = this.node;
            }

            let meshRenderer = node.getComponent(MeshRenderer)!;
            if (!meshRenderer) {
                meshRenderer = node.addComponent(MeshRenderer);
                // let effect = EffectAsset.get('builtin-unlit') || EffectAsset.get('unlit')

                assetManager.loadAny('a3cd009f-0ab0-420d-9278-b9fdab939bbc', (err, effect: EffectAsset) => {
                    if (err) {
                        error('Failed to load builtin unlit effect.')
                        return;
                    }

                    let techniqueIndex = effect.techniques.findIndex(t => {
                        return t.name === meshData.technique;
                    })

                    if (techniqueIndex === -1) {
                        techniqueIndex = 0;
                    }

                    let depthStencilState: any = {}
                    if (meshData.depthFunc !== undefined) {
                        depthStencilState.depthFunc = meshData.depthFunc
                    }
                    if (meshData.depthTest !== undefined) {
                        depthStencilState.depthTest = meshData.depthTest
                    }
                    if (meshData.depthWrite !== undefined) {
                        depthStencilState.depthWrite = meshData.depthWrite
                    }

                    let m = new Material()
                    m.initialize({
                        effectAsset: effect,
                        technique: techniqueIndex,
                        states: {
                            primitive: meshData.primitiveMode,
                            rasterizerState: {
                                cullMode: meshData.cullMode
                            },
                            depthStencilState: depthStencilState
                        },
                        defines: {
                            USE_VERTEX_COLOR: true
                        }
                    });
                    meshRenderer.setMaterial(m, 0);
                })

            }
            if (meshRenderer.mesh !== mesh) {
                meshRenderer.mesh = mesh;
            }

            let model = meshRenderer.model && meshRenderer.model.subModels[0];
            if (!model) return;
            let ia = model.inputAssembler;
            if (!ia) return;
            ia.vertexCount = meshData.vertexCount;
            ia.indexCount = meshData.indexCount;
            model.update();
        })
    }


    private _meshDatas: Map<string, MeshData> = new Map;
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
