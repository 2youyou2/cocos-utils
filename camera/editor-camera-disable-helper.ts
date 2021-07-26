
import { _decorator, Component, Node, director, renderer } from 'cc';
import { EDITOR } from 'cc/env';
const { ccclass, property, executeInEditMode } = _decorator;

const IgnoreCameras = ['Material Preview Camera', 'Model Preview Camera', 'Mesh Preview Camera', 'Skeleton Preview Camera']

@ccclass('EditorCameraDisableHelper')
@executeInEditMode
export class EditorCameraDisableHelper extends Component {
    @property
    EditorCamera = true

    @property
    EditorUICamera = true

    @property
    EditorUIGizmoCamera = true

    @property
    SceneGizmoCamera = true

    @property
    HierarchyCameras = true

    disableCameras (disable = true) {
        const windows = director.root!.windows;
        const cameraList: renderer.scene.Camera[] = [];
        for (let i = 0; i < windows.length; i++) {
            const window = windows[i];
            for (let ci = 0; ci < window.cameras.length; ci++) {
                if (cameraList.indexOf(window.cameras[ci]) === -1) {
                    cameraList.push(window.cameras[ci])
                }
            }
        }

        for (let i = 0; i < cameraList.length; i++) {
            let camera = cameraList[i];
            let name = (camera as any)._name as string;

            if (IgnoreCameras.indexOf(name) !== -1) {
                continue;
            }

            let enabled = !disable;
            let finded = false;

            if (disable) {
                if (name.startsWith('Editor ') || name.startsWith('Scene ')) {
                    if (this.EditorCamera && name === 'Editor Camera') {
                        enabled = true;
                    }
                    else if (this.EditorUICamera && name === 'Editor UICamera') {
                        enabled = true;
                    }
                    else if (this.EditorUIGizmoCamera && name === 'Editor UIGizmoCamera') {
                        enabled = true;
                    }
                    else if (this.SceneGizmoCamera && name === 'Scene Gizmo Camera') {
                        enabled = true;
                    }
                }
                else if (this.HierarchyCameras) {
                    enabled = true;
                }
            }

            camera.enabled = enabled;
        }
    }

    onEnable () {
        if (EDITOR) {
            this.disableCameras(true)
        }
    }

    onDisable () {
        if (EDITOR) {
            this.disableCameras(false)
        }
    }

    update (deltaTime: number) {
        if (EDITOR) {
            this.disableCameras();
        }
    }
}

