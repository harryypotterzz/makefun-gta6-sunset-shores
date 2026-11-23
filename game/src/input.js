// Sunset Shores — keyboard input.
// One job only: held keys give a steering direction; one-shot presses (start,
// pause, enter car, new mission, mute) are reported once per press.
export const ACTION = {
  ENTER: 1,
  PAUSE: 2,
  MISSION: 4,
  MUTE: 8,
  RESTART: 16,
};

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyE: 'enter',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mission',
  KeyQ: 'mute',
  Enter: 'start',
};

export class Input {
  constructor() {
    this.held = { up: false, down: false, left: false, right: false };
    this.pressed = 0;
    this.anyKey = false;
    this._onDown = (event) => {
      const name = KEY_MAP[event.code];
      if (!name) return;
      event.preventDefault();
      this.anyKey = true;
      if (name === 'enter') this.pressed |= ACTION.ENTER;
      else if (name === 'pause') this.pressed |= ACTION.PAUSE;
      else if (name === 'mission') this.pressed |= ACTION.MISSION;
      else if (name === 'mute') this.pressed |= ACTION.MUTE;
      else if (name === 'start') this.pressed |= ACTION.RESTART;
      else this.held[name] = true;
    };
    this._onUp = (event) => {
      const name = KEY_MAP[event.code];
      if (name && this.held[name] !== undefined) this.held[name] = false;
    };
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup', this._onUp);
    window.addEventListener('blur', () => {
      this.held.up = this.held.down = this.held.left = this.held.right = false;
    });
  }

  /** The one-shot presses since the last call, as ACTION flags. */
  takePressed() {
    const p = this.pressed;
    this.pressed = 0;
    return p;
  }
}
