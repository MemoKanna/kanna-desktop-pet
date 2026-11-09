const fs = require('node:fs');
const path = require('node:path');
const artwork = require('./artwork.json');
const { VOICE_CLIPS } = require('./catalog.cjs');

const pngSignature = Buffer.from([137,80,78,71,13,10,26,10]);

function header(file, length) {
  try {
    if (!fs.lstatSync(file).isFile()) return null;
    const fd = fs.openSync(file, 'r');
    try {
      const bytes = Buffer.alloc(length);
      return fs.readSync(fd, bytes, 0, length, 0) === length ? bytes : null;
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
}

function missingArtwork(directory) {
  return Object.entries(artwork).filter(([file, [width, height]]) => {
    const png = header(path.join(directory, file), 24);
    return !png || !png.subarray(0, 8).equals(pngSignature) ||
      png.toString('ascii', 12, 16) !== 'IHDR' ||
      png.readUInt32BE(16) !== width || png.readUInt32BE(20) !== height;
  }).map(([file]) => file);
}

function availableVoices(directory) {
  return Object.entries(VOICE_CLIPS).filter(([, {file}]) => {
    const wav = header(path.join(directory, 'voice', file), 12);
    return wav?.toString('ascii', 0, 4) === 'RIFF' && wav.toString('ascii', 8, 12) === 'WAVE';
  }).map(([id]) => id);
}

function copyPack(source, destination) {
  const missing = missingArtwork(source);
  if (missing.length) throw Error(`缺少兼容图集：${missing.slice(0, 4).join('、')}`);
  fs.mkdirSync(destination, { recursive: true });
  for (const file of Object.keys(artwork)) {
    fs.copyFileSync(path.join(source, file), path.join(destination, file));
  }
  const voices = availableVoices(source);
  if (voices.length) fs.mkdirSync(path.join(destination, 'voice'), { recursive: true });
  for (const id of voices) {
    const file = VOICE_CLIPS[id].file;
    fs.copyFileSync(path.join(source, 'voice', file), path.join(destination, 'voice', file));
  }
}

function importPack(selection, destination) {
  const choices = [selection, path.join(selection, 'assets'), path.join(selection, 'resources', 'app', 'assets')];
  const source = choices.find(directory => missingArtwork(directory).length === 0);
  if (!source) throw Error('请选择包含完整兼容图集的素材文件夹。');
  if (fs.existsSync(destination) && fs.realpathSync(source) === fs.realpathSync(destination)) return;
  const staging = fs.mkdtempSync(path.join(path.dirname(destination), 'assets-import-'));
  const backup = path.join(path.dirname(destination), `assets-backup-${path.basename(staging)}`);
  try {
    copyPack(source, staging);
    if (fs.existsSync(destination)) fs.renameSync(destination, backup);
    try {
      fs.renameSync(staging, destination);
    } catch (error) {
      if (fs.existsSync(backup)) fs.renameSync(backup, destination);
      throw error;
    }
  } finally {
    fs.rmSync(staging, { recursive: true, force: true });
  }
}

module.exports = { missingArtwork, availableVoices, copyPack, importPack };
