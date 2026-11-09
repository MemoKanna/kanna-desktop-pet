const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { copyPack } = require('./asset-pack.cjs');
const pkg = require('./package.json');

const appFiles = [
  'package.json', 'main.cjs', 'preload.cjs', 'catalog.cjs', 'asset-pack.cjs', 'artwork.json',
  'index.html', 'demo.html', 'demo.js', 'pet.css', 'renderer.js', 'rig.js', 'blink.js',
  'effects.js', 'pose-rigs.js', 'seat-face.js', 'watermelon.js', 'pillow.js', 'homework.js',
  'side-sleep.js', 'cicada.js', 'peace.js', 'rice.js', 'voice.js', 'LICENSE',
];

function packageWindows() {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw Error('需要 Windows x64。');
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== '--local-assets')) {
    throw Error('用法：npm run package:win -- [--local-assets <assets 文件夹>]');
  }
  const localAssets = args[1];
  const runtime = process.env.KANNA_ELECTRON_DIST || path.dirname(require('electron'));
  const version = fs.readFileSync(path.join(runtime, 'version'), 'utf8').trim();
  if (version !== pkg.devDependencies.electron) throw Error(`Electron 版本不匹配：${version}`);

  const dist = path.join(__dirname, 'dist');
  fs.mkdirSync(dist, { recursive: true });
  const stage = fs.mkdtempSync(path.join(dist, 'build-'));
  const bundle = path.join(stage, 'KannaDesktopPet');
  const destination = path.join(bundle, 'resources', 'app');
  fs.cpSync(runtime, bundle, {
    recursive: true,
    filter: source => path.basename(source) !== 'default_app.asar',
  });
  fs.renameSync(path.join(bundle, 'electron.exe'), path.join(bundle, 'KannaDesktopPet.exe'));
  const crashReporter = path.join(bundle, 'electron_wer.dll');
  if (fs.existsSync(crashReporter)) fs.renameSync(crashReporter, path.join(bundle, 'KannaDesktopPet_wer.dll'));
  fs.mkdirSync(destination, { recursive: true });
  for (const name of appFiles) fs.copyFileSync(path.join(__dirname, name), path.join(destination, name));
  fs.copyFileSync(path.join(__dirname, 'README.md'), path.join(bundle, '使用说明.md'));
  if (localAssets) copyPack(path.resolve(localAssets), path.join(destination, 'assets'));

  const name = `KannaDesktopPet-${pkg.version}-windows-x64${localAssets ? '-local' : ''}.zip`;
  const archive = path.join(dist, name);
  const zip = spawnSync('tar.exe', ['-a', '-cf', archive, '-C', stage, 'KannaDesktopPet'], { stdio:'inherit' });
  if (zip.error) throw zip.error;
  if (zip.status !== 0) throw Error('ZIP 打包失败。');
  console.log(JSON.stringify({archive, bundle, version, localAssets:Boolean(localAssets)}));
}

packageWindows();
