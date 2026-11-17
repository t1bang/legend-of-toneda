// On-screen joystick for touch screens.
// The returned object's x and y run from -1 to 1 (x: right, y: down the screen), 0 when let go.
export function makeStick(base, knob) {
  const stick = { x: 0, y: 0, id: null };
  const DEAD = 0.16;                               // a little slack in the middle, so a resting thumb does nothing
  function move(e) {
    const b = base.getBoundingClientRect(), reach = b.width / 2 - knob.offsetWidth / 4;
    let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    const d = Math.hypot(dx, dy);
    if (d > reach) { dx *= reach / d; dy *= reach / d; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    const push = Math.min(1, d / reach), out = push < DEAD ? 0 : (push - DEAD) / (1 - DEAD);
    stick.x = d ? dx / Math.min(d, reach) * out : 0;
    stick.y = d ? dy / Math.min(d, reach) * out : 0;
  }
  function letGo(e) {
    if (e.pointerId !== stick.id) return;
    stick.id = null; stick.x = stick.y = 0;
    knob.style.transform = '';
  }
  base.addEventListener('pointerdown', e => {
    if (stick.id !== null) return;
    stick.id = e.pointerId;
    base.setPointerCapture(e.pointerId);
    move(e);
    e.preventDefault();
  });
  base.addEventListener('pointermove', e => { if (e.pointerId === stick.id) move(e); });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(type, letGo);
  return stick;
}
