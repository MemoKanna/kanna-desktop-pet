const { app, BrowserWindow, Menu, dialog, ipcMain, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { OUTFITS, ACTIONS, canPlay, CANVAS_SPAN, CLASSIC_VOICES } = require('./catalog.cjs');
const { missingArtwork, availableVoices, importPack } = require('./asset-pack.cjs');

const assetDirectory = path.join(__dirname, 'assets');
let hasArtwork = missingArtwork(assetDirectory).length === 0;
let voiceIds = availableVoices(assetDirectory);
let importing = false;

app.setName('康娜桌宠');
app.setPath('userData', path.join(app.getPath('appData'), 'KannaDesktopPet'));
const qaDirectory = process.env.KANNA_QA_DIRECTORY;
if (qaDirectory) {
  app.setPath('userData', path.join(qaDirectory, 'profile'));
}
if (process.env.KANNA_SOFTWARE_RENDERING === '1') {
  app.commandLine.appendSwitch('use-angle', 'swiftshader');
  app.commandLine.appendSwitch('enable-unsafe-swiftshader');
}

const sizes = { 小: 104, 中: 140, 大: 176 };
const previousSizes = { 小: 168, 中: 212, 大: 272 };
const intervals = { 安静: [32, 55], 适中: [16, 32], 活泼: [8, 16], 暂停: null };
const defaults = { outfit: 'classic', size: '中', cadence: '适中', top: true, position: null };
let pet;
let drag;
let openingMenu = false;
let state;
let saveTimer;
const stateFile = () => path.join(app.getPath('userData'), 'settings.json');

function readState() {
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) ?? {}; } catch {}
  const size = Object.hasOwn(sizes, saved.size) ? saved.size : defaults.size;
  const position = Number.isInteger(saved.position?.x) && Number.isInteger(saved.position?.y)
    ? saved.position : null;
  if (position && saved.version !== 2) {
    position.x += Math.round((previousSizes[size] - sizes[size]) / 2);
    position.y += Math.round(previousSizes[size] * 1.5) - Math.round(sizes[size] * 1.5);
  }
  return {
    version: 2,
    outfit: OUTFITS.some(o => o.id === saved.outfit) ? saved.outfit : defaults.outfit,
    size,
    cadence: Object.hasOwn(intervals, saved.cadence) ? saved.cadence : defaults.cadence,
    top: typeof saved.top === 'boolean' ? saved.top : defaults.top,
    position,
    scale: Number.isFinite(saved.scale) && saved.scale >= .75 && saved.scale <= 5
      ? saved.scale : (position ? screen.getDisplayNearestPoint(position) : screen.getPrimaryDisplay()).scaleFactor,
    voice: {enabled:saved.voice?.enabled !== false,
      volume:Number.isFinite(saved.voice?.volume)?Math.max(0,Math.min(1,saved.voice.volume)):.4},
  };
}

function save() {
  if (!state) return;
  try {
    fs.mkdirSync(path.dirname(stateFile()), { recursive: true });
    const temporary = stateFile() + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(state, null, 2));
    fs.renameSync(temporary, stateFile());
  } catch (error) { console.error('保存桌宠设置失败', error.message); }
}

function stagePixels() {
  return Math.round(sizes[state.size] * state.scale / 2) * 2;
}

function dimensions(display) {
  const stage = stagePixels();
  const scale = display.scaleFactor;
  return {width:Math.ceil(stage * CANVAS_SPAN / scale),height:Math.ceil(stage * 1.55 / scale)};
}

function layout(position, display = position ? screen.getDisplayNearestPoint(position) : screen.getPrimaryDisplay()) {
  const area = display.workArea;
  const {width,height} = dimensions(display);
  const clamp = (value, min, max) => Math.min(Math.max(min, max), Math.max(min, value));
  return {
    x: clamp(position?.x ?? area.x + area.width - width - 24, area.x, area.x + area.width - width),
    y: clamp(position?.y ?? area.y + area.height - height - 12, area.y, area.y + area.height - height),
    width, height,
  };
}

function rendererState() {
  return {outfit:state.outfit,interval:intervals[state.cadence],stagePixels:stagePixels(),
    voice:{...state.voice,available:voiceIds},qa:Boolean(qaDirectory)};
}

function loadPetPage() {
  return pet.loadFile(path.join(__dirname, hasArtwork ? 'index.html' : 'demo.html'));
}

async function chooseAssetPack() {
  if (importing) return;
  importing = true;
  try {
    const result = await dialog.showOpenDialog(pet, {
      title:'选择本地素材包文件夹', properties:['openDirectory'],
    });
    if (result.canceled) return;
    importPack(result.filePaths[0], assetDirectory);
    hasArtwork = true;
    voiceIds = availableVoices(assetDirectory);
    await loadPetPage();
  } catch (error) {
    await dialog.showMessageBox(pet, {type:'error', title:'素材导入失败', message:error.message});
  } finally {
    importing = false;
  }
}

function chooseSize(size) {
  const previous = pet.getBounds();
  const display = screen.getDisplayMatching(previous);
  state.size = size;
  const {width,height} = dimensions(display);
  pet.setBounds(layout({
    x: Math.round(previous.x + (previous.width - width) / (2*CANVAS_SPAN)),
    y: previous.y + previous.height - height,
  },display));
  sendState();
}

function sendState() {
  pet.webContents.send('pet:settings', rendererState());
  save();
}

function buildMenu() {
  const canSpeak = state.voice.enabled && state.voice.volume > 0;
  const classics = Object.entries(CLASSIC_VOICES).filter(([id]) => voiceIds.includes(id));
  const actions = ACTIONS.filter(action => canPlay(action, state.outfit))
    .map(action => ({
      label: action.label,
      click: () => pet.webContents.send('pet:play', action.id),
    }));
  const template = [
    { label: '换衣服', submenu: OUTFITS.map(outfit => ({
      label: outfit.label,
      type: 'radio',
      checked: state.outfit === outfit.id,
      click: () => { state.outfit = outfit.id; sendState(); },
    })) },
    { label: '播放动作', submenu: actions },
    { label: '随机动作频率', submenu: Object.keys(intervals).map(cadence => ({
      label: cadence, type: 'radio', checked: state.cadence === cadence,
      click: () => { state.cadence = cadence; sendState(); },
    })) },
    { label: '配音', submenu: [
      {label:'开启配音',type:'checkbox',checked:state.voice.enabled,
        click:item=>{state.voice.enabled=item.checked;sendState()}},
      {label:'音量',submenu:[.2,.4,.6,.8,1].map(volume=>({
        label:Math.round(volume*100)+'%',type:'radio',checked:Math.abs(state.voice.volume-volume)<.001,
        click:()=>{state.voice.volume=volume;sendState()},
      }))},
      {type:'separator'},
      {label:'试听一句',enabled:canSpeak&&voiceIds.some(id=>['oh','happy','kobayashi','majiyaba','hungry'].includes(id)),
        click:()=>pet.webContents.send('pet:voice-preview')},
      {label:'经典台词',enabled:canSpeak&&classics.length>0,
        submenu:classics.map(([id,voice])=>({
          label:voice.label,
          click:()=>pet.webContents.send('pet:voice-preview',id),
        }))},
    ]},
    {label:'导入本地素材',click:chooseAssetPack},
    { label: '大小', submenu: Object.keys(sizes).map(size => ({
      label: size, type: 'radio', checked: state.size === size, click: () => chooseSize(size),
    })) },
    { label: '保持置顶', type: 'checkbox', checked: state.top, click: item => {
      state.top = item.checked;
      pet.setAlwaysOnTop(state.top);
      save();
    } },
    { type: 'separator' },
    { label: '退出康娜', click: () => app.quit() },
  ];
  return Menu.buildFromTemplate(template);
}

function showMenu() {
  if (openingMenu || pet.isDestroyed()) return;
  openingMenu = true;
  pet.setIgnoreMouseEvents(false);
  buildMenu().popup({
    window: pet,
    callback: () => { openingMenu = false; pet?.webContents.send('pet:menu-closed'); },
  });
}

function trusted(event) { return pet && !pet.isDestroyed() && event.sender === pet.webContents; }

function createPet() {
  state = readState();
  pet = new BrowserWindow({
    ...layout(state.position),
    title: '康娜桌宠',
    transparent: true, backgroundColor: '#00000000', frame: false,
    resizable: false, maximizable: false, minimizable: false,
    hasShadow: false, skipTaskbar: true, alwaysOnTop: state.top, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, sandbox: true, nodeIntegration: false,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required',
    },
  });
  pet.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  pet.webContents.on('will-navigate', event => event.preventDefault());
  if (qaDirectory) pet.webContents.on('console-message', details => {
    if (details.level === 'error' || details.level === 3) console.error(details.message);
  });
  pet.on('move', () => {
    const [x, y] = pet.getPosition();
    state.position = { x, y };
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 220);
  });
  pet.on('closed', () => { pet = null; });
  pet.once('ready-to-show', () => {
    pet.setBounds(layout(state.position),false);
    pet.showInactive();
  });
  loadPetPage();

  if (qaDirectory) pet.webContents.once('did-finish-load', () => runQa().catch(error => {
    fs.writeFileSync(path.join(qaDirectory, 'report.json'), JSON.stringify({error: error.stack}));
    app.exit(1);
  }));
}

ipcMain.handle('pet:initial', event => trusted(event) ? rendererState() : null);
ipcMain.on('pet:menu', event => { if (trusted(event)) showMenu(); });
ipcMain.on('pet:pass', (event, value) => {
  if (trusted(event) && !drag && !openingMenu) pet.setIgnoreMouseEvents(value === true, { forward: true });
});
function beginDrag(cursor) {
  const bounds = pet.getBounds();
  const display = screen.getDisplayMatching(bounds);
  drag = {offsetX:(cursor.x-bounds.x)*display.scaleFactor,
    offsetY:(cursor.y-bounds.y)*display.scaleFactor,display,moved:false};
}
ipcMain.on('pet:drag-start', event => {
  if (trusted(event) && !openingMenu) beginDrag(screen.getCursorScreenPoint());
});
function moveDrag(cursor) {
  const display = screen.getDisplayNearestPoint(cursor);
  const x = Math.round(cursor.x-drag.offsetX/display.scaleFactor);
  const y = Math.round(cursor.y-drag.offsetY/display.scaleFactor);
  const current = pet.getBounds();
  const size = dimensions(display);
  const request = {x,y,...size};
  if (drag.requested && Object.keys(request).every(key=>request[key]===drag.requested[key])) return;
  if (x === current.x && y === current.y && size.width === current.width &&
      size.height === current.height && display.id === drag.display.id) return;
  drag.moved = true;
  drag.display = display;
  drag.requested = request;
  pet.setBounds(request,false);
}
ipcMain.on('pet:drag-move', event => {
  if (trusted(event) && drag) moveDrag(screen.getCursorScreenPoint());
});
function endDrag() {
  const finished = drag;
  drag = null;
  if (!finished?.moved) return;
  const bounds = pet.getBounds();
  const placed = layout(bounds,finished.display);
  if (Object.keys(placed).some(key=>bounds[key]!==placed[key])) pet.setBounds(placed,false);
}
ipcMain.on('pet:drag-end', event => {
  if (trusted(event)) endDrag();
});

async function runQa() {
  const execute = code => pet.webContents.executeJavaScript(code);
  for (let attempt = 0; attempt < 120; attempt++) {
    if (await execute('Boolean(window.kannaCheck?.ready)')) break;
    await new Promise(resolve => setTimeout(resolve, 80));
  }
  const report = await execute('window.kannaCheck.verify()');
  if (!report.ok) throw Error(JSON.stringify(report));
  report.initialOutfit = (await execute('window.kannaCheck.status()')).outfit;
  report.initialBounds = pet.getBounds();
  report.stage = {};
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  for (const size of Object.keys(sizes)) {
    chooseSize(size);
    await pause(110);
    const geometry = await execute('window.kannaCheck.geometry()');
    if (geometry.pixels[0] * 3 !== geometry.pixels[1] * 2 * geometry.span ||
        Math.abs(geometry.css[0] * 1.5 / geometry.span - geometry.css[1]) > .06)
      throw Error('Stage stretched at size ' + size);
    report.stage[size] = geometry;
  }
  chooseSize('小');
  await pause(100);
  const before = pet.getBounds();
  const geometryBefore = await execute('window.kannaCheck.geometry()');
  const cursor = {x:before.x+41,y:before.y+45};
  beginDrag(cursor);
  await execute('window.kannaCheck.freezeDrag(-1)');
  for (const dx of [13,26,53]) {
    moveDrag({x:cursor.x-dx,y:cursor.y-Math.round(dx*.65)});
    await pause(65);
  }
  const during = pet.getBounds();
  const geometryDuring = await execute('window.kannaCheck.geometry()');
  const statusDuring = await execute('window.kannaCheck.status()');
  fs.writeFileSync(path.join(qaDirectory,'drag-tilt.png'),(await pet.webContents.capturePage()).toPNG());
  endDrag();
  // Windows can round a DIP bound by one unit when the origin moves on a scaled screen.
  if (before.x === during.x || before.y === during.y || Math.abs(before.width-during.width)>1 ||
      Math.abs(before.height-during.height)>1 || JSON.stringify(geometryBefore.pixels)!==JSON.stringify(geometryDuring.pixels) ||
      statusDuring.tilt >= -.06)
    throw Error('Drag check failed: '+JSON.stringify({before,during,geometryBefore,geometryDuring,statusDuring}));
  report.drag = {before,during,physical:geometryDuring.pixels,tilt:statusDuring.tilt};
  await execute('window.kannaCheck.thawDrag()');
  await pause(500);
  if (Math.abs((await execute('window.kannaCheck.status()')).tilt) > .001)
    throw Error('Head did not return after drag');
  const virtual = pet.webContents.debugger;
  virtual.attach('1.3');
  try {
    for (const dpr of [1,2]) {
      await virtual.sendCommand('Emulation.setDeviceMetricsOverride',{
        width:Math.ceil(geometryBefore.pixels[0]/dpr)+2,
        height:Math.ceil(geometryBefore.pixels[1]/dpr)+8,
        deviceScaleFactor:dpr,mobile:false,
      });
      await pause(120);
      const scaled=await execute('window.kannaCheck.geometry()');
      if (Math.abs(scaled.dpr-dpr)>.001 || scaled.pixels.join()!==geometryBefore.pixels.join() ||
          Math.abs(scaled.css[0]*dpr-geometryBefore.pixels[0])>.1)
        throw Error('Physical size changed after DPR switch: '+JSON.stringify(scaled));
    }
    report.dprSimulation = [1,2];
  } finally {
    await virtual.sendCommand('Emulation.clearDeviceMetricsOverride');
    virtual.detach();
  }
  chooseSize('中');
  for (const outfit of OUTFITS) {
    const option = buildMenu().items[0].submenu.items.find(item => item.label === outfit.label);
    option.click();
    await new Promise(resolve => setTimeout(resolve, 320));
    if ((await execute('window.kannaCheck.status()')).outfit !== outfit.id)
      throw Error('Native outfit menu failed: ' + outfit.id);
    const image = await pet.webContents.capturePage();
    fs.writeFileSync(path.join(qaDirectory, outfit.id + '.png'), image.toPNG());
  }
  const classic = buildMenu().items[0].submenu.items[0];
  classic.click();
  await new Promise(resolve => setTimeout(resolve, 320));
  const recordFrame = async (name, script) => {
    await execute(script);
    await pause(100);
    const image = await pet.webContents.capturePage();
    fs.writeFileSync(path.join(qaDirectory, name + '.png'), image.toPNG());
  };
  const recordPose = (name,parameters) =>
    recordFrame(name,'window.kannaCheck.pose(...'+JSON.stringify(parameters)+')');
  for (const angle of [0,.25,.5,.75,1]) {
    await recordPose('turn-' + angle, [null,0,angle,angle === .5 ? 1 : 0]);
  }
  for (const action of ACTIONS.filter(action=>canPlay(action,'classic'))) {
    const option = buildMenu().items[1].submenu.items.find(item=>item.label===action.label);
    if (!option?.enabled) throw Error('Action unavailable: '+action.id);
    option.click();
    await pause(75);
    if ((await execute('window.kannaCheck.status()')).action !== action.id)
      throw Error('Native action menu failed: '+action.id);
    const frames = {idle:[.12,.35,1.06,1.38], butterfly:[2.28],
      rest:[.52,.86,1.20,2.18,2.45,3.65,7.8,10.55,11.3],kneel:[.52,.86,1.22,2.24,8.9,10.25],
      sidesleep:[0,.5,1.2,20,80,178.7,179.2,179.9]};
    for (const time of frames[action.id]) await recordPose('action-'+action.id+'-'+time,[action.id,time]);
  }
  await recordFrame('tail-right','window.kannaCheck.sweep(Math.PI*.67)');
  await recordFrame('tail-right-mid','window.kannaCheck.sweep(Math.PI*.8)');
  await recordFrame('tail-behind','window.kannaCheck.sweep(Math.PI)');
  await recordFrame('tail-left','window.kannaCheck.sweep(Math.PI*1.67)');
  await recordFrame('tail-left-mid','window.kannaCheck.sweep(Math.PI*1.8)');
  for (let frame=0;frame<=27;frame++) {
    await recordFrame('tail-reference-'+String(frame).padStart(2,'0'),
      'window.kannaCheck.sweep('+frame+'/27*Math.PI*2)');
  }
  for (const view of [0,1]) {
    await recordFrame('tail-body-'+view,'window.kannaCheck.sweep(0,'+view+',false)');
    for (const frame of [1,2,3,4,5,15,16,17]) {
      await recordFrame('tail-layer-'+view+'-'+frame,
        'window.kannaCheck.sweep('+frame+'/27*Math.PI*2,'+view+')');
    }
  }
  await execute('window.kannaCheck.stopRandom()');
  buildMenu().items[0].submenu.items.find(item=>item.label==='绿色夏装').click();
  await pause(500);
  if (!(await execute('window.kannaCheck.testLocked()'))) throw Error('Summer action lock failed');
  const watermelon = ACTIONS.find(action=>action.id==='watermelon');
  const eat = buildMenu().items[1].submenu.items.find(item=>item.label===watermelon.label);
  if (!eat.enabled) throw Error('Summer watermelon menu is disabled');
  eat.click();
  await pause(180);
  if ((await execute('window.kannaCheck.status()')).action!=='watermelon')
    throw Error('Native watermelon action did not start');
  await execute('window.kannaCheck.seek(6.9)');
  await pause(500);
  if ((await execute('window.kannaCheck.status()')).action)
    throw Error('Watermelon action did not return to idle');
  for (const t of [0,.4,.8,1.2,1.9,2.4,2.95,3.5,4.2,5.1,6.2,6.7,7.19]) {
    await recordPose('watermelon-'+t,['watermelon',t]);
  }
  const shake = ACTIONS.find(action=>action.id==='headshake');
  const shakeMenu = buildMenu().items[1].submenu.items.find(item=>item.label===shake.label);
  if (!shakeMenu.enabled) throw Error('Summer head-shake menu is disabled');
  await execute('window.kannaCheck.resumeFrames()');
  shakeMenu.click();
  await pause(260);
  if ((await execute('window.kannaCheck.status()')).action!=='headshake')
    throw Error('Native head-shake action did not start');
  const shakeHashes = new Set();
  for (let frame=0;frame<15;frame++) {
    await recordPose('headshake-'+String(frame).padStart(2,'0'),['headshake',.22+frame*.02]);
    shakeHashes.add(require('node:crypto').createHash('sha256')
      .update((await pet.webContents.capturePage()).toPNG()).digest('hex'));
  }
  if (shakeHashes.size<12) throw Error('Head-shake frames failed to advance');
  for (const time of [0,.06,.14,3.44,3.54,3.6])
    await recordPose('headshake-transition-'+time,['headshake',time]);
  await execute('window.kannaCheck.resumeFrames()');
  shakeMenu.click();
  await pause(100);
  const shakeGeometry = await execute('window.kannaCheck.geometry()');
  await execute('window.kannaCheck.freezeDrag(-1)');
  await pause(180);
  if (JSON.stringify((await execute('window.kannaCheck.geometry()')).pixels)!==JSON.stringify(shakeGeometry.pixels))
    throw Error('Head-shake size changed during drag');
  await execute('window.kannaCheck.thawDrag();window.kannaCheck.seek(3.5)');
  await pause(330);
  if ((await execute('window.kannaCheck.status()')).action)
    throw Error('Head-shake action did not return to idle');
  report.headshake = {nativeMenu:true,frames:shakeHashes.size,dragSizeStable:true,returnedToIdle:true};
  await execute('window.kannaCheck.testRandom()');
  report.summerRandom = [];
  await pause(150);
  const summerActions = ACTIONS.filter(action=>canPlay(action,'green'));
  for (let i=0;i<summerActions.length;i++) {
    report.summerRandom.push((await execute('window.kannaCheck.status()')).action);
    await execute('window.kannaCheck.seek(500)');
    await pause(150);
  }
  if (new Set(report.summerRandom).size!==summerActions.length ||
      !['watermelon','headshake'].every(id=>report.summerRandom.includes(id)))
    throw Error('Summer random cycle did not include both summer actions');
  await execute('window.kannaCheck.stopRandom()');
  if (process.env.KANNA_QA_WATERMELON_PREVIEW) {
    chooseSize('大');
    await pause(120);
    const video = await execute(`(async () => {
      const pet = document.getElementById('pet');
      const effects = document.getElementById('effects');
      const panel=pet.width+72;
      const canvas=document.createElement('canvas');
      canvas.width=panel*2;
      canvas.height=pet.height+48;
      const brush=canvas.getContext('2d');
      const stream=canvas.captureStream(60);
      const codec=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder=new MediaRecorder(stream,{mimeType:codec,videoBitsPerSecond:3200000});
      const parts=[];
      recorder.ondataavailable=event=>{if(event.data.size)parts.push(event.data);};
      const ended=new Promise(resolve=>{recorder.onstop=resolve;});
      recorder.start();
      await new Promise(resolve=>{
        let start;
        function paint(now) {
          if(start===undefined)start=now;
          // Let the capture encoder settle before the 7.2-second action starts.
          const t=Math.max(0,Math.min(7.2,(now-start)/1000-.85));
          window.kannaCheck.pose('watermelon',t);
          brush.fillStyle='#292735';
          brush.fillRect(0,0,canvas.width,canvas.height);
          brush.drawImage(pet,36,24);
          brush.drawImage(effects,36,24);
          brush.fillStyle='#eee9f3';
          brush.font='16px sans-serif';
          brush.fillText('绿色夏装 · 吃西瓜',24,20);
          brush.fillText('咬下与咀嚼',panel+24,24);
          const crop=[pet.width*.27,pet.height*.19,pet.width*.46,pet.height*.43];
          brush.drawImage(pet,...crop,panel+36,60,264,360);
          brush.drawImage(effects,...crop,panel+36,60,264,360);
          if(t<7.2)requestAnimationFrame(paint);
          else resolve();
        }
        requestAnimationFrame(paint);
      });
      recorder.stop();
      await ended;
      stream.getTracks().forEach(track=>track.stop());
      return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
    })()`);
    fs.writeFileSync(path.join(qaDirectory,'watermelon-preview.webm'),Buffer.from(video));
    chooseSize('中');
  }
  await execute('window.kannaCheck.resumeFrames()');
  buildMenu().items[0].submenu.items[0].click();
  await pause(500);
  if (process.env.KANNA_QA_TAIL_PREVIEW) {
    chooseSize('大');
    await pause(120);
    const video = await execute(`(async () => {
      const pet = document.getElementById('pet');
      const effects = document.getElementById('effects');
      const canvas = document.createElement('canvas');
      const panelWidth = pet.width+72;
      canvas.width = panelWidth*2;
      canvas.height = pet.height+48;
      const brush = canvas.getContext('2d');
      const stream = canvas.captureStream(60);
      const codec = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9' : 'video/webm';
      const recorder = new MediaRecorder(stream,{mimeType:codec,videoBitsPerSecond:2400000});
      const parts = [];
      recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
      const ended = new Promise(resolve=>{recorder.onstop=resolve;});
      recorder.start();
      await new Promise(resolve => {
        let start;
        function paint(now) {
          if (start === undefined) start=now;
          const elapsed = Math.min(11200,now-start);
          window.kannaCheck.sweep(elapsed/5600*Math.PI*2);
          brush.fillStyle='#292735';
          brush.fillRect(0,0,canvas.width,canvas.height);
          brush.drawImage(pet,36,24);
          brush.drawImage(effects,36,24);
          brush.fillStyle='#eee9f3';
          brush.font='16px sans-serif';
          brush.fillText('常态待机',24,20);
          brush.fillText('尾巴局部',panelWidth+24,34);
          const crop = [pet.width*.55,pet.height*.52,pet.width*.45,pet.height*.31];
          brush.drawImage(pet,...crop,panelWidth+35,118,264,273);
          brush.drawImage(effects,...crop,panelWidth+35,118,264,273);
          if (elapsed<11200) requestAnimationFrame(paint);
          else resolve();
        }
        requestAnimationFrame(paint);
      });
      recorder.stop();
      await ended;
      stream.getTracks().forEach(track=>track.stop());
      return Array.from(new Uint8Array(await new Blob(parts).arrayBuffer()));
    })()`);
    fs.writeFileSync(path.join(qaDirectory,'tail-preview.webm'),Buffer.from(video));
    chooseSize('中');
    report.tailPreview = true;
  }
  await execute('window.kannaCheck.testRandom()');
  await new Promise(resolve => setTimeout(resolve, 190));
  report.randomPlayback = (await execute('window.kannaCheck.status()')).action;
  if (!report.randomPlayback || !ACTIONS.some(action=>action.id===report.randomPlayback)) throw Error('Random playback failed');
  await execute('window.kannaCheck.resumeFrames()');
  buildMenu().items[0].submenu.items.find(item=>item.label==='剧场版小黄裙').click();
  await pause(1400);
  await execute('window.kannaCheck.stopRandom()');
  for (const outfit of OUTFITS.filter(outfit=>outfit.id!=='classic')) {
    buildMenu().items[0].submenu.items.find(item=>item.label===outfit.label).click();
    await pause(300);
    const actionItems = buildMenu().items[1].submenu.items;
    const expected = ACTIONS.filter(action => canPlay(action, outfit.id));
    if (actionItems.length !== expected.length ||
        actionItems.some((item, index) => !item.enabled || item.label !== expected[index].label) ||
        !(await execute('window.kannaCheck.testLocked()')))
      throw Error('Action lock mismatch: '+outfit.id);
  }
  await execute('window.kannaCheck.testRandom()');
  await pause(190);
  report.otherOutfitRandom = (await execute('window.kannaCheck.status()')).action;
  if (!ACTIONS.some(action=>action.id===report.otherOutfitRandom && canPlay(action, state.outfit)))
    throw Error('Restricted action appeared in random playback');
  await execute('window.kannaCheck.stopRandom()');
  buildMenu().items[0].submenu.items[0].click();
  await pause(1400);
  report.clickWake = {};
  virtual.attach('1.3');
  try {
    for (const action of ACTIONS.filter(action=>action.seconds===180)) {
      if(state.outfit!==action.outfit){
        buildMenu().items[0].submenu.items.find(item=>item.label===OUTFITS.find(o=>o.id===action.outfit).label).click();
        await pause(500);
      }
      buildMenu().items[1].submenu.items.find(item=>item.label===action.label).click();
      await execute('window.kannaCheck.seek(120)');
      await pause(160);
      const held = await execute('window.kannaCheck.status()');
      if (held.action!==action.id || held.sit!==2 || held.waking) throw Error('Seat did not hold: '+action.id);
      fs.writeFileSync(path.join(qaDirectory,'hold-'+action.id+'.png'),(await pet.webContents.capturePage()).toPNG());
      const point = await execute('window.kannaCheck.clickPoint()');
      await virtual.sendCommand('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      for (const type of ['mousePressed','mouseReleased']) {
        await virtual.sendCommand('Input.dispatchMouseEvent',{type,...point,button:'left',clickCount:1});
      }
      if (!(await execute('window.kannaCheck.status()')).waking) throw Error('Click did not wake: '+action.id);
      let rising = 0;
      let returned = false;
      for (let i = 0; i < 36; i++) {
        await pause(100);
        const status = await execute('window.kannaCheck.status()');
        if (status.sit>0 && status.sit<2) rising++;
        if (!status.action && status.angle===0 && status.sit===0) {
          returned = true;
          break;
        }
      }
      if (!returned || rising<3) throw Error('Wake did not rise and return: '+action.id);
      report.clickWake[action.id] = {heldAtSeconds:120,rising,returned};
    }
  } finally {
    virtual.detach();
  }
  const rest = ACTIONS.find(action=>action.id==='rest');
  buildMenu().items[0].submenu.items[0].click();
  await pause(500);
  buildMenu().items[1].submenu.items.find(item=>item.label===rest.label).click();
  await execute('window.kannaCheck.seek(176.5)');
  await pause(220);
  if ((await execute('window.kannaCheck.status()')).sit!==2) throw Error('Nap ended before its timeout');
  await pause(3550);
  if ((await execute('window.kannaCheck.status()')).action) throw Error('Nap did not finish at its timeout');
  report.naturalWake = true;
  report.classicOnly = true;
  report.nativeMenu = true;
  report.bounds = pet.getBounds();
  report.persistedOutfit = JSON.parse(fs.readFileSync(stateFile(), 'utf8')).outfit;
  fs.writeFileSync(path.join(qaDirectory, 'report.json'), JSON.stringify(report, null, 2));
  app.quit();
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => pet?.showInactive());
  app.on('window-all-closed', () => app.quit());
  app.on('before-quit', save);
  app.whenReady().then(createPet);
}

