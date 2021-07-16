
import { _decorator, Component, Node, systemEvent, SystemEvent, EventTouch, Touch, Quat, Vec3, Animation, tween, Tween, Vec2 } from 'cc';
import { lerp } from '../../extend-components/utils/math';
import { KeyDirection, KeyDownEvent, KeyUpEvent, TouchEnd, TouchMove, TouchPanelEnd, TouchPanelMove, TouchPanelStart, TouchStart } from '../input/input-event';
import { JoyStick } from '../input/joystick';
const { ccclass, property } = _decorator;

const tempQuat = new Quat;
const tempVec3 = new Vec3;

const DeltaFactor = 1 / 200

@ccclass('FlyCameraControl')
export class FlyCameraControl extends Component {
    @property
    rotateSpeed = 1;

    @property
    moveSpeed = 1;

    _rotation = new Quat;
    _targetRotation = new Vec3

    _position = new Vec3;
    _targetPosition = new Vec3;

    _storedRotation = new Quat;
    _storedPosition = new Vec3;

    isRotating = false;
    isMoving = false;

    start () {
        TouchPanelStart.on(this.onTouchPanelStart, this);
        TouchPanelEnd.on(this.onTouchPanelEnd, this);
        TouchPanelMove.on(this.onTouchPanelMove, this);

        TouchStart.on(this.onTouchStart, this);
        TouchEnd.on(this.onTouchEnd, this);
        TouchMove.on(this.onTouchMove, this);

        KeyDownEvent.on(this.onKeyDown, this);
        KeyUpEvent.on(this.onKeyUp, this);
    }

    _tween: Tween<Node> | null = null;
    _controlling = false;
    beginControl () {
        if (this._controlling) {
            return;
        }

        this._controlling = true;

        console.log('beginControl')

        if (this._tween) {
            this._tween.stop();
        }

        this._storedRotation.set(this.node.worldRotation);
        this._storedPosition.set(this.node.worldPosition);

        this._targetRotation.set(this.node.eulerAngles);
        this._targetRotation.z = 0;
        Quat.fromEuler(this._rotation, this._targetRotation.x, this._targetRotation.y, this._targetRotation.z);

        this._targetPosition.set(this.node.worldPosition);
        this._position.set(this._targetPosition);

        let animation = this.getComponent(Animation);
        if (animation) {
            animation.pause();
        }
    }
    endControl () {
        if (this.isMoving || this.isRotating || this.isKeyDown) {
            return;
        }

        setTimeout(() => {
            if (this.isMoving || this.isRotating || this.isKeyDown) {
                return;
            }

            this._controlling = false;
            console.log('endControl')

            this._tween = tween(this.node)
                .to(0.5, { worldRotation: this._storedRotation, position: this._storedPosition })
                .call(() => {
                    let animation = this.getComponent(Animation);
                    if (animation) {
                        animation.resume();
                    }
                    this._tween = null;
                })
                .start();
        }, 1000);
    }

    isKeyDown = false;
    onKeyDown () {
        if (!this.isKeyDown) {
            this.isKeyDown = true;
            this.beginControl();
        }

        this._moveSpeed.set(KeyDirection.x, 0, -KeyDirection.z);
        this._moveSpeed.multiplyScalar(this.moveSpeed * 10);
        Vec3.transformQuat(this._moveSpeed, this._moveSpeed, this.node.worldRotation);
    }
    onKeyUp () {
        if (KeyDirection.length() <= 0) {
            this.isKeyDown = false;
            this.endControl();

            this._moveSpeed.multiplyScalar(0);
        }
    }

    // moving
    _moveSpeed = new Vec3;
    onTouchStart () {
        console.log('onTouchStart');

        this.isMoving = true;
        this.beginControl();
    }
    onTouchEnd () {
        console.log('onTouchEnd');

        this._moveSpeed.multiplyScalar(0);

        this.isMoving = false;
        this.endControl();
    }
    onTouchMove (joystick: JoyStick) {

        this._moveSpeed.set(joystick.direction.x, 0, -joystick.direction.y);
        this._moveSpeed.multiplyScalar(this.moveSpeed * 10);
        Vec3.transformQuat(this._moveSpeed, this._moveSpeed, this.node.worldRotation);
    }

    // rotating
    onTouchPanelStart () {
        console.log('onTouchStart');

        this.isRotating = true;
        this.beginControl();
    }
    onTouchPanelEnd () {
        console.log('onTouchEnd');

        this.isRotating = false;
        this.endControl();
    }
    onTouchPanelMove (joystick: JoyStick, x: number, y: number, deltaX: number, deltaY: number) {
        if (!this.isRotating) return;

        Quat.fromEuler(tempQuat, this._targetRotation.x, this._targetRotation.y, this._targetRotation.z);

        Quat.rotateX(tempQuat, tempQuat, deltaY * DeltaFactor);
        Quat.rotateAround(tempQuat, tempQuat, Vec3.UP, -deltaX * DeltaFactor);

        Quat.toEuler(this._targetRotation, tempQuat);
    }

    update (dt: number) {
        if (!this.isRotating && !this.isMoving && !this.isKeyDown) {
            return;
        }

        // rotation
        let targetRotation = this._targetRotation;
        Quat.fromEuler(tempQuat, targetRotation.x, targetRotation.y, targetRotation.z);
        Quat.slerp(this._rotation, this._rotation, tempQuat, dt * 7 * this.rotateSpeed);
        this.node.worldRotation = this._rotation;

        // position
        let targetPosition = this._targetPosition;

        tempVec3.set(this._moveSpeed)
        tempVec3.multiplyScalar(dt);
        targetPosition.add(tempVec3);

        Vec3.lerp(this._position, targetPosition, this._position, dt * this.moveSpeed);
        this.node.worldPosition = this._position;
    }
}

