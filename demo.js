// Original illustrated mascot used to demonstrate the controls before importing a pack.
const canvas = document.querySelector('#demo');
const ink = canvas.getContext('2d', { willReadFrequently: true });
const colors = {classic:'#be8fe0', pajamas:'#f0ba69', pink:'#e98bb1', green:'#7bcba9', movie:'#f3cc68'};
const sleepActions = new Set(['rest', 'kneel', 'sidesleep', 'backpacksleep']);
const food = {butterfly:'#b884ea', cicada:'#8abc6e', rice:'#fff4d7', watermelon:'#f2768c'};
let settings, action, queued, started, endsAt, timer, pointer, frozenAt, passThrough;

function oval(x, y, rx, ry, color) {
  ink.beginPath();
  ink.ellipse(x, y, rx, ry, 0, 0, 2 * Math.PI);
  ink.fillStyle = color;
  ink.fill();
}

function line(path, color, width) {
  ink.strokeStyle = color;
  ink.lineWidth = width;
  ink.lineCap = 'round';
  ink.stroke(new Path2D(path));
}

function star(x, y, radius, color) {
  ink.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = point * Math.PI / 5 - Math.PI / 2;
    const distance = radius * (point % 2 ? .47 : 1);
    ink.lineTo(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance);
  }
  ink.closePath();
  ink.fillStyle = color;
  ink.fill();
}

function draw(now) {
  const w = Math.round(canvas.clientWidth * devicePixelRatio);
  const h = Math.round(canvas.clientHeight * devicePixelRatio);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  ink.setTransform(w / 150, 0, 0, h / 155, 0, 0);
  ink.clearRect(0, 0, 150, 155);
  const time = now / 1000;
  const id = action?.id;
  const elapsed = action ? Math.max(0, (now - started) / 1000) : 0;
  const settle = action ? Math.min(1, elapsed / .5, Math.max(0, (endsAt - now) / 500)) : 0;
  const sleepy = sleepActions.has(id) ? settle : 0;
  const outfit = colors[settings.outfit] ?? colors.classic;
  const tilt = id === 'headshake' ? .14 * Math.sin(elapsed * 15) * settle : 0;
  const tailY = 93 + Math.sin(time * 3.8) * 7;
  oval(69, 141, 42, 6, '#1f25432e');
  ink.save();
  ink.translate(69, 136);
  ink.rotate(tilt + (id === 'sidesleep' || id === 'backpacksleep' ? -.36 * sleepy : 0));
  ink.scale(1 + .12 * sleepy, 1 - .18 * sleepy);
  ink.translate(-69, -136 + Math.sin(time * 3) * (1.5 - sleepy));
  line(`M 99 109 Q 128 121 128 ${tailY}`, '#3e6b83', 8);
  star(128, tailY, 10, '#ffce71');
  oval(49, 128, 14, 9, '#81c1d5');
  oval(88, 128, 14, 9, '#81c1d5');
  const body = new Path2D('M 27 94 C 24 72 29 52 40 47 Q 41 26 57 43 Q 69 39 80 43 Q 95 26 99 49 C 113 58 120 81 112 103 C 106 126 90 133 68 133 C 42 133 30 119 27 94 Z');
  const shade = ink.createLinearGradient(34, 42, 101, 130);
  shade.addColorStop(0, '#d5f7f4');
  shade.addColorStop(1, '#94cde0');
  ink.fillStyle = shade;
  ink.fill(body);
  ink.strokeStyle = '#345a73';
  ink.lineWidth = 3;
  ink.stroke(body);
  oval(69, 114, 38, 16, outfit);
  line('M 34 110 Q 69 129 104 110', '#fff7e9', 2.7);
  star(69, 116, 7, '#fff1b5');
  star(54, 57, 9, '#fff3b4');
  const blink = time % 4.6 > 4.46;
  if (sleepy > .62 || blink) {
    line('M 49 81 Q 55 87 61 81 M 77 81 Q 83 87 89 81', '#2e455f', 3.2);
  } else {
    for (const x of [55, 83]) {
      oval(x, 80, 5.7, 8, '#253d59');
      oval(x - 1.5, 77, 1.7, 2, '#ffffff');
    }
  }
  oval(44, 91, 6, 3.5, '#e99aa8');
  oval(94, 91, 6, 3.5, '#e99aa8');
  if (food[id] && elapsed < 2.5) oval(69, 92, 4, 4, '#3a536c');
  else line('M 64 92 Q 69 97 74 92', '#34546c', 2.2);
  if (id === 'peace') {
    for (const x of [29, 109]) {
      oval(x, 99 - 25 * settle, 8, 12, '#d4f7f1');
      line(`M ${x - 3} ${94 - 25 * settle} l -3 -7 M ${x + 3} ${94 - 25 * settle} l 3 -7`, '#456d82', 2);
    }
  }
  ink.restore();
  if (food[id]) {
    const lift = Math.min(1, elapsed / 2);
    const y = 126 - 22 * lift;
    if (elapsed < 2.5) {
      oval(81, y, 14, 9, food[id]);
      if (id === 'watermelon') line(`M 70 ${y + 4} Q 81 ${y + 13} 92 ${y + 4}`, '#75b58b', 3);
    } else star(101, 83 - 9 * Math.sin(elapsed * 2), 7 * settle, '#f3bb60');
  }
  if (id === 'homework' || id === 'pillow') {
    ink.save();
    ink.globalAlpha = settle;
    ink.fillStyle = id === 'pillow' ? '#ffcf92' : '#fff4d6';
    ink.beginPath();
    ink.roundRect(51, 104, 48, 27, 7);
    ink.fill();
    if (id === 'homework') line('M 61 114 h 25 M 61 121 h 17', '#a08370', 2);
    else star(75, 117, 8, '#e58d86');
    ink.restore();
  }
  if (sleepy > .7) {
    star(105, 54 + Math.sin(time * 2) * 3, 6, '#ffe4a4');
    star(119, 44 + Math.sin(time * 2) * 3, 4, '#ead3fc');
  }
}

function schedule() {
  clearTimeout(timer);
  if (!settings.interval || action || pointer) return;
  const [min, max] = settings.interval;
  timer = setTimeout(() => {
    const choices = ACTIONS.filter(item => canPlay(item, settings.outfit));
    play(choices[Math.floor(Math.random() * choices.length)].id, true);
  }, (min + Math.random() * (max - min)) * 1000);
}

function play(id, automatic = false) {
  const next = ACTIONS.find(item => item.id === id);
  if (!next || !canPlay(next, settings.outfit)) return;
  if (action) {
    queued = next.id;
    return;
  }
  clearTimeout(timer);
  action = next;
  started = performance.now();
  endsAt = started + next.seconds * 1000;
  petVoice.begin(id, automatic);
}

function frame(now) {
  const clock = frozenAt ?? now;
  if (action && clock >= endsAt) {
    action = null;
    petVoice.finish(true);
    if (queued) play(queued);
    queued = null;
    schedule();
  }
  if (action && frozenAt === undefined) petVoice.tick((now - started) / 1000);
  draw(clock);
  requestAnimationFrame(frame);
}

function hit(event) {
  return ink.getImageData(Math.floor(event.clientX * devicePixelRatio),
    Math.floor(event.clientY * devicePixelRatio), 1, 1).data[3] > 55;
}

function setPass(value) {
  if (passThrough === value) return;
  passThrough = value;
  petHost.pass(value);
}

async function init() {
  settings = await petHost.initial();
  petVoice.configure(settings.voice);
  petHost.settings(next => {
    if (next.outfit !== settings.outfit) {
      action = null;
      queued = null;
      petVoice.finish();
    }
    settings = next;
    petVoice.configure(next.voice);
    schedule();
  });
  petHost.action(play);
  petHost.voicePreview(id => petVoice.preview(id));
  petHost.menuClosed(() => { passThrough = undefined; });
  canvas.addEventListener('contextmenu', event => {
    event.preventDefault();
    petHost.menu();
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !hit(event)) return;
    canvas.setPointerCapture(event.pointerId);
    pointer = {x:event.screenX, y:event.screenY, dragged:false};
    clearTimeout(timer);
    petHost.drag('start');
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointer) return setPass(!hit(event));
    if (!pointer.dragged && Math.hypot(event.screenX - pointer.x, event.screenY - pointer.y) >= 4) {
      pointer.dragged = true;
      frozenAt = performance.now();
      petVoice.pause();
    }
    if (pointer.dragged) petHost.drag('move');
  });
  function endPointer(event) {
    if (!pointer) return;
    const {dragged} = pointer;
    pointer = null;
    petHost.drag('end');
    if (dragged) {
      const pause = performance.now() - frozenAt;
      started += pause;
      endsAt += pause;
      frozenAt = undefined;
      petVoice.resume();
    } else if (event.type === 'pointerup') {
      if (sleepActions.has(action?.id)) {
        endsAt = performance.now() + 500;
        petVoice.react('wake');
      } else if (!action) play('idle');
    }
    schedule();
  }
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, endPointer);
  }
  requestAnimationFrame(frame);
  schedule();
  if (settings.qa) window.kannaDemoCheck = () => ({outfit:settings.outfit, action:action?.id, visible:canvas.width > 0});
}

init().catch(console.error);
