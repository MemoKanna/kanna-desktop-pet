// Fixed transparent room for horizontal poses; the character pixel scale stays fixed.
const CANVAS_SPAN = 1.5;
const OUTFITS = [
  {id:'classic', label:'经典粉白披肩'},
  {id:'pajamas', label:'黄色睡衣'},
  {id:'pink', label:'粉色连衣裙'},
  {id:'green', label:'绿色夏装'},
  {id:'movie', label:'剧场版小黄裙'},
];
const ACTIONS = [
  {id:'idle', label:'眨眼摆尾', seconds:4.1},
  {id:'butterfly', label:'啊呜，吃蝴蝶', seconds:4.3},
  {id:'cicada', label:'啊呜，吃蝉', seconds:6.2, outfit:'pink'},
  {id:'peace', label:'双手比耶', seconds:6.4, outfit:'movie'},
  {id:'rice', label:'大口吃白米饭', seconds:7.6, outfit:'classic'},
  {id:'watermelon', label:'吃西瓜', seconds:7.2, outfit:'green'},
  {id:'headshake', label:'甩头', seconds:3.6, outfit:'green'},
  {id:'homework', label:'光脚侧身写作业', seconds:36, outfit:'green'},
  {id:'pillow', label:'抱枕头', seconds:12.8, outfit:'pajamas'},
  {id:'rest', label:'坐着充电打盹', seconds:180, outfit:'classic'},
  {id:'kneel', label:'侧身跪坐', seconds:180, outfit:'classic'},
  {id:'sidesleep', label:'抱枕侧睡', seconds:180, outfit:'classic'},
  {id:'backpacksleep', label:'背书包侧睡', seconds:180, outfit:'pajamas'},
];
const canPlay = (action,outfit) => !action.outfit || action.outfit === outfit;
const CLASSIC_VOICES = {
  majiyaba:{file:'majiyaba.wav',label:'マジやばくね'},
  hungry:{file:'hungry.wav',label:'肚子饿了'},
  encourage:{file:'encourage.wav',label:'工作加油'},
  see_you:{file:'see_you.wav',label:'明天见'},
};
const VOICE_CLIPS = {
  oh:{file:'oh.wav',label:'轻声回应'},
  happy:{file:'happy.wav',label:'开心的反应'},
  kobayashi:{file:'kobayashi.wav',label:'自我介绍'},
  eat:{file:'eat.wav',label:'吃东西'},
  yummy:{file:'yummy.wav',label:'好吃'},
  ...CLASSIC_VOICES,
};
if (typeof module !== 'undefined') module.exports = {OUTFITS,ACTIONS,canPlay,CANVAS_SPAN,CLASSIC_VOICES,VOICE_CLIPS};
