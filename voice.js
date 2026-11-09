// Short local anime clips share one audio channel. Animation clocks own cues,
// so pausing a drag or leaving an outfit cannot leave a delayed voice behind.
const VOICE_CUES={
  idle:{at:.22,group:'reaction'},
  butterfly:[{at:2.93,group:'eating'},{at:4.18,group:'satisfied'}],
  cicada:[{at:1.92,group:'eating'},{at:3.66,group:'satisfied'}],
  rice:[{at:1.85,group:'eating'},{at:3.62,group:'satisfied'}],
  watermelon:[{at:2.05,group:'eating'},{at:3.92,group:'satisfied'}],
  peace:{at:.92,group:'happy'},
  headshake:{at:.38,group:'acknowledge'},
  homework:{at:.80,group:'work'},
  pillow:{at:1.10,group:'pillow'},
};
class PetVoice {
  constructor(){
    this.enabled=true;this.volume=.4;this.audio=new Audio();this.audio.preload='auto';
    this.available = new Set(Object.keys(VOICE_CLIPS));
    this.action=null;this.paused=false;this.lastStarted=-Infinity;this.lastReaction=-Infinity;
    this.lastByGroup=new Map();this.history=[];this.error=null;this.sequence=0;
    this.groups={
      reaction:['oh','happy','kobayashi','majiyaba','hungry'],
      eating:['eat'],
      satisfied:['yummy'],
      happy:['happy','majiyaba'],
      acknowledge:['oh'],
      work:['oh','encourage'],
      pillow:['happy','see_you'],
    };
    this.audio.addEventListener('ended',()=>{this.playing=null});
    this.audio.addEventListener('playing',()=>{
      const entry=this.history.at(-1);if(entry){entry.started=true;entry.startedAt??=performance.now()}
    });
    this.audio.addEventListener('error',()=>{this.error='音频无法播放';this.playing=null});
  }
  configure(options){
    if(!options)return;
    if (Array.isArray(options.available)) this.available = new Set(options.available);
    this.enabled=options.enabled!==false;
    this.volume=Number.isFinite(options.volume)?Math.max(0,Math.min(1,options.volume)):.4;
    this.audio.volume=this.enabled?this.volume:0;
    if(!this.enabled||this.volume===0)this.stop();
  }
  choose(group){
    const pool=(this.groups[group]??['oh']).filter(id=>this.available.has(id));
    if (!pool.length) return undefined;
    const available=pool.filter(id=>id!==this.lastByGroup.get(group));
    const pick=(available.length?available:pool)[Math.floor(Math.random()*(available.length||pool.length))];
    this.lastByGroup.set(group,pick);return pick;
  }
  stop(){
    this.sequence++;this.audio.pause();this.audio.currentTime=0;this.playing=null;
  }
  begin(id,automatic=false){
    this.stop();this.paused=false;
    const cue=VOICE_CUES[id];
    this.action=cue?{id,automatic,cues:(Array.isArray(cue)?cue:[cue]).map(item=>({...item,clip:this.choose(item.group),fired:false}))}:null;
  }
  finish(keepPreview=false){
    this.action=null;this.paused=false;
    if(!keepPreview||this.history.at(-1)?.kind!=='preview')this.stop();
  }
  tick(elapsed){
    const current=this.action;if(!current||this.paused)return;
    for(const cue of current.cues){
      if(cue.fired||elapsed<cue.at)continue;
      cue.fired=true;
      // Seeking or a stalled renderer must not play a stale line much later.
      if(elapsed>cue.at+.65)continue;
      const gap=current.id==='idle'?45000:18000;
      current.allowed??=!current.automatic||performance.now()-this.lastStarted>=gap;
      if(current.allowed)this.play(cue.clip,{kind:'action',action:current.id,automatic:current.automatic});
    }
  }
  play(id,details={},force=false){
    if(!this.available.has(id)||!this.enabled||this.volume===0||this.paused)return false;
    if(!this.audio.paused&&!this.audio.ended&&!force)return false;
    this.stop();const sequence=this.sequence;
    this.error=null;this.audio.volume=this.volume;
    this.audio.src='assets/voice/'+VOICE_CLIPS[id].file;
    this.playing=id;this.lastStarted=performance.now();
    const event={clip:id,...details,requestedAt:this.lastStarted,started:false};
    this.history.push(event);if(this.history.length>32)this.history.shift();
    this.audio.play().then(()=>{if(this.sequence===sequence)event.started=true}).catch(error=>{
      if(this.sequence!==sequence||(this.paused&&error.name==='AbortError'))return;
      this.error=error.message;this.playing=null;
    });return true;
  }
  pause(){
    if(this.paused)return;this.paused=true;
    this.wasPlaying=!this.audio.paused&&!this.audio.ended;this.audio.pause();
  }
  resume(){
    if(!this.paused)return;this.paused=false;
    if(this.wasPlaying&&this.enabled&&this.volume>0){
      const sequence=this.sequence;
      this.audio.play().catch(error=>{if(this.sequence===sequence)this.error=error.message});
    }
    this.wasPlaying=false;
  }
  react(kind='tap'){
    const now=performance.now();if(now-this.lastReaction<1800)return false;
    this.lastReaction=now;return this.play(kind==='wake'?'oh':this.choose('reaction'),{kind},true);
  }
  preview(id=this.choose('reaction')){return this.play(id,{kind:'preview'},true)}
  status(){return {enabled:this.enabled,volume:this.volume,playing:this.playing,paused:this.paused,
    mediaPaused:this.audio.paused,time:this.audio.currentTime,error:this.error,history:this.history.map(item=>({...item}))}}
}
const petVoice=new PetVoice();
