const SIDE_SLEEP={seconds:180,release:178.6,wakeSeconds:1.4,tail:[829.2,1219.,916.6,1274.8],
 // Match the standing eye distance: 167 px / (195.2 source px * .62 registration).
 scale:1.38,anchor:[64,1518],shoulder:[585,1295,155,145],hand:[405,1472,76,55],
 click:[522,1428],shadowWidth:86};
const BACKPACK_SLEEP={"seconds": 180, "release": 178.2, "wakeSeconds": 1.8, "tail": [738.66, 1256.98, 803.14, 1193.74], "scale": 1.2544898462402263, "anchor": [64, 1518], "shoulder": [650.0, 1133.6, 90, 105], "hand": [805.0, 1397.1, 75, 45], "click": [572.5, 1164.6], "shadowWidth": 86, "enterStart": 0.18, "enterSeconds": 1.12, "eyeOpenSeconds": 0.46, "eyeHold": 0.68, "smoothTransitions": true, "eyeStages": 3};
const SLEEP_POSES={sidesleep:SIDE_SLEEP,backpacksleep:BACKPACK_SLEEP};
function sleepEase(from,to,time){
 const x=Math.max(0,Math.min(1,(time-from)/(to-from)));
 return x*x*x*(10+x*(-15+6*x));
}
function sideSleepMovement(time,releaseAt,config=SIDE_SLEEP){
 releaseAt??=config.release;
 const transition=config.smoothTransitions?sleepEase:ease;
 const active=transition(config.enterStart??0,config.enterSeconds??1,time)*
  (1-transition(releaseAt+(config.eyeHold??.35),releaseAt+config.wakeSeconds,time));
 const awake=transition(releaseAt,releaseAt+(config.eyeOpenSeconds??.34),time);
 const breathing=(1-awake)*1.8*Math.sin(time*Math.PI*2/4.8);
 const cuddle=(1-awake)*gesture(time%13,8.2,8.8,9.3,10.1)*.85;
 return {active,awake,breathing,cuddle};
}
