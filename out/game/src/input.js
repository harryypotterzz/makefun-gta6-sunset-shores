// Keyboard state: which keys are held, and which were pressed since the
// last frame (edge-triggered, so an action fires once per key press).

export function createInput() {
  const held = new Set();
  const justPressed = new Set();

  function onKeyDown(event) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
    if (event.repeat) return;
    held.add(event.code);
    justPressed.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  return {
    down(code) {
      return held.has(code);
    },
    pressed(code) {
      if (justPressed.has(code)) {
        justPressed.delete(code);
        return true;
      }
      return false;
    },
    endFrame() {
      justPressed.clear();
    },
  };
}
