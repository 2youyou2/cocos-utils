import { EventKeyboard, Game, game, SystemEvent, systemEvent, macro, Vec3 } from 'cc'
import Event from '../event'

const { KEY } = macro;

export let TouchStart = new Event
export let TouchEnd = new Event
export let TouchMove = new Event

export let TouchPanelStart = new Event
export let TouchPanelEnd = new Event
export let TouchPanelMove = new Event

export let Jump = new Event
export let Shoot = new Event

export let KeyDownEvent = new Event;
export let KeyUpEvent = new Event;
export let KeyDirection = new Vec3;

game.on(Game.EVENT_GAME_INITED, () => {
    systemEvent.on(SystemEvent.EventType.KEY_DOWN, (event: EventKeyboard) => {
        switch (event.keyCode) {
            case KEY.left:
            case KEY.a:
                KeyDirection.x = -1;
                break;
            case KEY.right:
            case KEY.d:
                KeyDirection.x = 1;
                break;
            case KEY.up:
            case KEY.w:
                KeyDirection.z = 1;
                break;
            case KEY.down:
            case KEY.s:
                KeyDirection.z = -1;
                break;
            case KEY.r:
                KeyDirection.y = 1;
                break;
            case KEY.q:
                KeyDirection.y = -1;
                break;
        }

        KeyDownEvent.invoke(KeyDirection);
    })

    systemEvent.on(SystemEvent.EventType.KEY_UP, (event: EventKeyboard) => {
        switch (event.keyCode) {
            case KEY.left:
            case KEY.a:
                if (KeyDirection.x < 0) {
                    KeyDirection.x = 0;
                }
                break;
            case KEY.right:
            case KEY.d:
                if (KeyDirection.x > 0) {
                    KeyDirection.x = 0;
                }
                break;
            case KEY.up:
            case KEY.w:
                if (KeyDirection.z > 0) {
                    KeyDirection.z = 0;
                }
                break;
            case KEY.down:
            case KEY.s:
                if (KeyDirection.z < 0) {
                    KeyDirection.z = 0;
                }
                break;
            case KEY.r:
                if (KeyDirection.y > 0) {
                    KeyDirection.y = 0;
                }
                break;
            case KEY.q:
                if (KeyDirection.y < 0) {
                    KeyDirection.y = 0;
                }
                break;
        }

        KeyUpEvent.invoke(KeyDirection);
    })
})

