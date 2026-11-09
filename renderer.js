const pet = document.getElementById('pet');
const effects = document.getElementById('effects');
const stageElement = document.getElementById('pet-stage');
const shadow = document.getElementById('ground-shadow');
const stage = effects.getContext('2d');
const width = 1024, height = 1536;
const hit = document.createElement('canvas');
hit.width = 128;
hit.height = 192;
const hitContext = hit.getContext('2d', {willReadFrequently:true});
let hitPixels;
let gl;
let mipmaps;
let uniforms;
let textures;
let seating;
let watermelon;
let headshake;
let pillow;
let homework;
let sideSleep;
let backpackSleep;
let cicada;
let peace;
let rice;
let sittingHit;
let blinkTextures;
let sittingFaceTexture;
let state;
let current;
let queued;
let wardrobe;
let nextTimer;
let lastPlayed;
const rotation = [];
let nextBlink = 0;
let startTime = 0;
let swayStart = 0;
let lastPaint = -Infinity;
let qaPose;
let pointer;
let dragPausedAt = null;
let dragFrameTime = 0;
let tiltTarget = 0;
let tilt = 0;
let pixelRatio;
let passThrough;
const turnIn = .52;
const turnOut = .60;
// Keep the original entrance and exit animation, and insert a seated hold between them.
const seatTiming = {
  rest:{hold:3.34,release:9.51,end:12.40},
  kneel:{hold:5.47,release:9.37,end:11.30},
};
const tailPeriod = 5.6;

const mix = (a, b, t) => a + (b - a) * t;
const range = (a, b, random = Math.random) => mix(a, b, random());

function ease(from, to, time) {
  const x = Math.max(0, Math.min(1, (time - from) / (to - from)));
  return x * x * (3 - 2 * x);
}

function gesture(t, start, full, release, end) {
  return ease(start, full, t) * (1 - ease(release, end, t));
}

function nextAction(queue,outfit,previous,random=Math.random) {
  if (!queue.length) {
    queue.push(...ACTIONS.filter(action=>canPlay(action,outfit)).map(action=>action.id));
    for (let i = queue.length-1; i > 0; i--) {
      const j = Math.floor(random()*(i+1));
      [queue[i],queue[j]] = [queue[j],queue[i]];
    }
  }
  if (queue[0] === previous && queue.length > 1) [queue[0],queue[1]] = [queue[1],queue[0]];
  return queue.shift();
}

const vertexSource = `
  attribute vec2 vertex;
  varying vec2 uv;
  void main() {
    uv = vertex * vec2(.5, -.5) + .5;
    gl_Position = vec4(vertex, 0., 1.);
  }
`;
const fragmentSource = `
  precision highp float;
  uniform sampler2D portrait;
  uniform sampler2D front;
  uniform sampler2D oldFront;
  uniform sampler2D sideLids;
  uniform sampler2D frontLids;
  uniform sampler2D seatA;
  uniform sampler2D seatB;
  uniform sampler2D warpMap;
  uniform vec4 frontEyes;
  uniform vec4 sideEyes;
  uniform vec2 frontShift;
  uniform vec2 oldFrontShift;
  uniform vec3 tail;
  uniform vec4 tailFront;
  uniform vec4 tailSide;
  uniform vec4 tailOld;
  uniform float tailVisible;
  uniform float standingIdle;
  uniform float standingPhase;
  uniform float snackAmount;
  uniform float snackLift;
  uniform float snackBitten;
  uniform float snackOpen;
  uniform float snackFood;
  uniform float snackChew;
  uniform float shakeAmount;
  uniform float shakeFrame;
  uniform float hugAmount;
  uniform float hugVisible;
  uniform vec3 hugMotion;
  uniform vec4 hugRoots;
  uniform vec4 hugElbows;
  uniform vec4 hugWrists;
  uniform float workAmount;
  uniform float workStroke;
  uniform float workTravel;
  uniform float workBlink;
  uniform float sleepAmount;
  uniform vec3 sleepMotion;
  uniform vec4 sleepTail;
  uniform vec3 sleepLayout;
  uniform float canvasSpan;
  uniform vec4 sleepShoulder;
  uniform vec4 sleepHand;
  uniform float sleepEyeStages;
  uniform float cicadaAmount;
  uniform vec4 cicadaMotion;
  uniform vec2 cicadaProps;
  uniform float peaceAmount;
  uniform vec2 peaceMotion;
  uniform float riceAmount;
  uniform vec3 ricePose;
  uniform vec4 tailA;
  uniform vec4 tailB;
  uniform float angle;
  uniform float clothes;
  uniform float showEyes;
  uniform float mapTiles;
  uniform float seatAmount;
  uniform float seatPair;
  uniform float seatNod;
  uniform float headTilt;
  uniform float napTilt;
  uniform float tailDock;
  uniform vec3 anchorsA;
  uniform vec3 anchorsB;
  uniform vec2 seatShift;
  uniform float faceAmount;
  uniform vec4 faceRect;
  varying vec2 uv;
  const vec2 size = vec2(1024., 1536.);

  vec4 blinkLayer(vec4 color, sampler2D lids, vec2 p, vec4 box) {
    vec2 local = (p - box.xy) / box.zw;
    if (all(greaterThanEqual(local, vec2(0.))) && all(lessThan(local, vec2(1.)))) {
      vec4 layer = texture2D(lids, local);
      return layer + color * (1. - layer.a);
    }
    return color;
  }

  vec2 matchLids(vec2 p, vec4 actual, vec4 canonical) {
    vec2 delta = p.x < (actual.x + actual.z) * .5
      ? canonical.xy - actual.xy : canonical.zw - actual.zw;
    return p + delta;
  }

  vec2 vectorAt(vec2 p, float tile) {
    vec2 inset = vec2(.5 / 256., .5 / 384.);
    vec2 local = clamp(p / size, inset, 1. - inset);
    vec2 encoded = texture2D(warpMap, vec2(local.x, (tile + local.y) / mapTiles)).rg;
    return (encoded * 255. - 128.) * 2.5;
  }

  vec2 inverseWarp(vec2 p, float fraction, float tile) {
    vec2 source = p;
    for (int i = 0; i < 3; i++) {
      source = mix(source, p - fraction * vectorAt(source, tile), .8);
    }
    return source;
  }

  vec4 poseMix(vec4 a, vec4 b, float progress) {
    vec4 difference = abs(a - b);
    float contrast = max(max(difference.r, difference.g), max(difference.b, difference.a));
    // Keep a single outline where the warped paintings have different occluding edges.
    float edge = smoothstep(.09, .23, contrast);
    float blend = mix(smoothstep(.28, .72, progress), step(.5, progress), edge);
    return mix(a, b, blend);
  }

  vec4 part(sampler2D art, vec2 p, float layer) {
    if (any(lessThan(p,vec2(0.))) || any(greaterThanEqual(p,size))) return vec4(0.);
    vec2 local = clamp(p, vec2(.5), size-.5) / size;
    return texture2D(art, vec2((local.x + layer) * .5, local.y));
  }

#if __VERSION__ >= 300
  vec2 tailDx;
  vec2 tailDy;
#endif

  vec4 tailPart(sampler2D art,vec2 p) {
    if (any(lessThan(p,vec2(0.))) || any(greaterThanEqual(p,size))) return vec4(0.);
#if __VERSION__ >= 300
    // Use the stage footprint so the edge of a projected tail cannot select a coarse mip.
    return textureGrad(art,vec2((p.x/size.x+1.)*.5,p.y/size.y),tailDx,tailDy);
#else
    return part(art,p,1.);
#endif
  }

  vec2 bendTail(vec2 point, vec4 rig) {
    vec2 direction = normalize(rig.zw - rig.xy);
    vec2 normal = vec2(-direction.y, direction.x);
    float span = distance(rig.zw, rig.xy);
    vec2 source = point;
    for (int i = 0; i < 3; i++) {
      float progress = clamp(dot(source-rig.xy,direction)/span,0.,1.);
      float bend = smoothstep(.015, .79, progress);
      float wave = 6.2 * sin(tail.z - 1.5 * bend) + tail.x * sin(tail.y - 2.0 * bend);
      float follow = 0.24 * (tail.x*sin(tail.y-2.0*bend-.85) + 6.2*sin(tail.z-1.5*bend-.85));
      float leftRight = 16. * sin(tail.z-1.65*bend-.44);
      source = point - bend * (normal * wave + direction * follow + vec2(leftRight,0.));
    }
    return source;
  }

  vec2 swingFromRoot(vec2 point,vec4 rig) {
    vec2 direction = normalize(rig.zw-rig.xy);
    float span = distance(rig.zw,rig.xy);
    vec2 normal = vec2(-direction.y,direction.x);
    vec2 middleJoint = mix(rig.xy,rig.zw,.44)+normal*span*.29;
    vec2 tipJoint = mix(rig.xy,rig.zw,.77)+normal*span*.20;
    float rootAngle = .135*sin(standingPhase)+.012*sin(2.*standingPhase-.45);
    float middleAngle = .125*sin(standingPhase-.7)+.016*sin(2.*standingPhase-1.1);
    float tipAngle = .058*sin(standingPhase-1.25)+.009*sin(2.*standingPhase-2.1);
    float c1 = cos(rootAngle), s1 = sin(rootAngle);
    float c2 = cos(rootAngle+middleAngle), s2 = sin(rootAngle+middleAngle);
    float c3 = cos(rootAngle+middleAngle+tipAngle), s3 = sin(rootAngle+middleAngle+tipAngle);
    mat2 rootTurn = mat2(c1,s1,-s1,c1);
    mat2 middleTurn = mat2(c2,s2,-s2,c2);
    mat2 endTurn = mat2(c3,s3,-s3,c3);
    vec2 movedMiddle = rig.xy+rootTurn*(middleJoint-rig.xy);
    vec2 movedTip = movedMiddle+middleTurn*(tipJoint-middleJoint);
    vec2 rootOffset=rig.xy-rootTurn*rig.xy;
    vec2 middleOffset=movedMiddle-middleTurn*middleJoint;
    vec2 endOffset=movedTip-endTurn*tipJoint;
    vec2 source=point;
    for (int i=0;i<5;i++) {
      float along=clamp(dot(source-rig.xy,direction)/span,0.,1.);
      float middle=smoothstep(.12,.50,along);
      float end=smoothstep(.50,.76,along);
      vec2 column1=mix(mix(rootTurn[0],middleTurn[0],middle),endTurn[0],end);
      vec2 column2=mix(mix(rootTurn[1],middleTurn[1],middle),endTurn[1],end);
      vec2 offset=mix(mix(rootOffset,middleOffset,middle),endOffset,end);
      vec2 local=point-offset;
      float determinant=column1.x*column2.y-column2.x*column1.y;
      source=vec2(column2.y*local.x-column2.x*local.y,
        -column1.y*local.x+column1.x*local.y)/determinant;
    }
    return source;
  }

  vec4 visibleFigure(sampler2D art,vec2 p,vec4 rig,float visibility,float backAxis,float dock) {
    vec4 body = part(art,p,0.);
    if (rig.x <= 0. || visibility <= 0. || tailVisible <= 0.) return body;
    if (backAxis > 0. && standingIdle > .5) {
      return body+tailPart(art,swingFromRoot(p,rig))*(1.-body.a)*visibility;
    }
    if (body.a >= .999) return body;
    if (p.y < min(rig.y,rig.w)-78. || p.y > max(rig.y,rig.w)+160.) return body;
    if (p.x < min(rig.x,rig.z)-110. || p.x > max(rig.x,rig.z)+130.) return body;
    vec2 source = bendTail(p,rig);
    if (dock > 0.) {
      float tip = smoothstep(0.,1.,clamp((p.x-rig.x)/(rig.z-rig.x-36.),0.,1.));
      source = mix(source,p-vec2(0.,100.*tip),dock);
    }
    vec4 end = tailPart(art,source);
    return body + end * (1.-body.a) * visibility * tailVisible;
  }

  vec4 figure(sampler2D art,vec2 p,vec4 rig,float backAxis) {
    return visibleFigure(art,p,rig,1.,backAxis,0.);
  }

  float remapHeight(float y, vec3 from, vec3 to) {
    if (y < from.x) return y + to.x-from.x;
    if (y >= from.z) return y + to.z-from.z;
    if (y <= from.y) return mix(to.x,to.y,(y-from.x)/(from.y-from.x));
    return mix(to.y,to.z,(y-from.y)/(from.z-from.y));
  }

  vec2 turnHead(vec2 p,vec2 neck,float tilt) {
    if (tilt == 0. || p.y >= neck.y+38.) return p;
    float roll = tilt * (1.-smoothstep(neck.y-20.,neck.y+38.,p.y));
    vec2 d = p-neck;
    float c = cos(roll), s = sin(roll);
    return neck+vec2(c*d.x+s*d.y,-s*d.x+c*d.y);
  }

  vec4 sitting(vec2 point) {
    float f = clamp(seatAmount,0.,1.);
    vec3 canonical = vec3(30.,560.,1524.);
    vec3 pose = mix(anchorsA + vec3(1524.-anchorsA.z),anchorsB + vec3(1524.-anchorsB.z),f);
    vec2 normalized = vec2(point.x, remapHeight(point.y, pose, canonical));
    vec2 a = normalized, b = normalized;
    if (f > 0. && f < 1.) {
      a = inverseWarp(normalized,f,seatPair*2.);
      b = inverseWarp(normalized,1.-f,seatPair*2.+1.);
    }
    a = vec2(a.x,remapHeight(a.y,canonical,anchorsA))+seatShift;
    b.y = remapHeight(b.y,canonical,anchorsB);
    b.y -= seatNod * (1.-smoothstep(anchorsB.y-25.,anchorsB.y+68.,b.y));
    a = turnHead(a,vec2(540.,anchorsA.y+22.),headTilt);
    b = turnHead(b,vec2(540.,anchorsB.y+22.),headTilt+napTilt);
    // The profile's tail passes behind her skirt while moving to the other side.
    bool crossesBody = abs(tailA.z-tailB.z) > 400.;
    float visibleA = crossesBody ? 1.-smoothstep(.08,.52,f) : 1.;
    float visibleB = crossesBody ? smoothstep(.48,.92,f) : 1.;
    float standingAxis = seatPair < .5 ? 492.+seatShift.x : 0.;
    vec4 result;
    if (f <= 0.) result = visibleFigure(seatA,a,tailA,visibleA,standingAxis,0.);
    else if (f >= 1.) result = visibleFigure(seatB,b,tailB,visibleB,0.,tailDock);
    else result = poseMix(visibleFigure(seatA,a,tailA,visibleA,standingAxis,0.),
      visibleFigure(seatB,b,tailB,visibleB,0.,tailDock),f);
    if (faceAmount > 0.) result = blinkLayer(result, sideLids, b, faceRect);
    return result;
  }

  vec4 snackLayer(sampler2D art,vec2 p,float layer) {
    if (any(lessThan(p,vec2(0.))) || any(greaterThanEqual(p,size))) return vec4(0.);
    vec2 tile=vec2(mod(layer,2.),floor(layer/2.));
    vec2 local=(clamp(p,vec2(.5),size-.5)/size+tile)*.5;
#if __VERSION__ >= 300
    // The arm-side branch has a coordinate discontinuity at the centerline.
    // Its implicit derivatives would select distant atlas mips and leak ink.
    return textureGrad(art,local,tailDx*vec2(1.,.5),tailDy*vec2(1.,.5));
#else
    return texture2D(art,local);
#endif
  }

  vec2 rotateSnack(vec2 p,vec2 source,vec2 target) {
    // Unit rotations only: forearm length and line width cannot stretch.
    float roll=atan(source.y,source.x)-atan(target.y,target.x);
    float c=cos(roll),s=sin(roll);
    return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
  }

  vec4 snackJoint(vec2 p,vec2 center,float radius) {
    float d=length(p-center);
    float alpha=1.-smoothstep(radius-.5,radius+.5,d);
    vec3 color=mix(vec3(.998,.902,.843),vec3(.20,.15,.15),
      smoothstep(radius-3.,radius-2.,d));
    return vec4(color*alpha,alpha);
  }

  vec4 snackArm(vec2 point,bool rightArm) {
    vec2 p=rightArm ? vec2(1024.-point.x,point.y) : point;
    vec2 sourceRoot=vec2(354.,746.),root=vec2(365.,765.);
    vec2 elbow=vec2(361.,794.),wrist=vec2(420.,713.);
    vec2 hand=wrist+vec2(0.,70.-snackLift);
    float upper=length(elbow-sourceRoot),fore=length(wrist-elbow);
    vec2 axis=hand-root;
    float span=length(axis);
    vec2 direction=axis/span;
    float along=(upper*upper-fore*fore+span*span)/(2.*span);
    float across=sqrt(max(0.,upper*upper-along*along));
    vec2 joint=root+direction*along+vec2(-direction.y,direction.x)*across;
    vec2 a=sourceRoot+rotateSnack(p-root,elbow-sourceRoot,joint-root);
    vec2 b=elbow+rotateSnack(p-joint,wrist-elbow,hand-joint);
    float upperVisible=a.x<512. ? 1. : 0.;
    float foreVisible=b.x<512. ? 1. : 0.;
    if (rightArm) { a.x=1024.-a.x; b.x=1024.-b.x; }
    vec4 upperArt=snackLayer(seatA,a,1.)*upperVisible;
    vec4 foreArt=snackLayer(seatA,b,2.)*foreVisible;
    vec4 joints=snackJoint(p,joint,24.);
    vec4 wristJoint=snackJoint(p,hand,24.);
    joints=wristJoint+joints*(1.-wristJoint.a);
    vec4 result=upperArt+joints*(1.-upperArt.a);
    return foreArt+result*(1.-foreArt.a);
  }

  vec4 eatingWatermelon(vec2 point) {
    vec2 native=turnHead(point+frontShift,vec2(512.,578.),headTilt);
    vec4 body=snackLayer(seatA,native,0.);
    vec4 arm=snackArm(native,native.x>512.);
    body=arm+body*(1.-arm.a);
    vec2 mouthPoint=native-vec2(0.,snackChew);
    vec4 face=snackLayer(seatB,mouthPoint,3.)*snackBitten*(1.-snackOpen);
    body=face+body*(1.-face.a);
    face=snackLayer(seatB,native,2.)*snackOpen;
    body=face+body*(1.-face.a);
    // Fruit and gripping hands share one translation, with no scale or flow warp.
    vec2 foodPoint=native+vec2(0.,snackLift);
    vec4 fruit=mix(snackLayer(seatB,foodPoint,0.),
                   snackLayer(seatB,foodPoint,1.),snackBitten)*snackFood;
    body=fruit+body*(1.-fruit.a);
    vec4 hands=snackLayer(seatA,native-vec2(0.,70.-snackLift),3.);
    body=hands+body*(1.-hands.a);
    body=mix(part(front,native,0.),body,snackAmount);
    vec4 end=tailPart(front,swingFromRoot(native,tailFront));
    body+=end*(1.-body.a)*tailVisible;
    if (showEyes > 0.) body=blinkLayer(body,frontLids,
      matchLids(native,frontEyes,vec4(431.,409.,598.,411.)),vec4(343.,333.,340.,125.));
    return body;
  }

  vec4 hugLayer(sampler2D art,vec2 p,float layer,vec2 grid) {
    if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,size)))return vec4(0.);
    vec2 tile=vec2(mod(layer,grid.x),floor(layer/grid.x));
    vec2 local=clamp(p/size,vec2(.5)/size,1.-vec2(.5)/size);
    return texture2D(art,(tile+local)/grid);
  }
  vec2 hugRotate(vec2 p,float angle) {
    float c=cos(angle),s=sin(angle);return vec2(c*p.x-s*p.y,s*p.x+c*p.y);
  }
  vec2 hugForward(vec2 p) {
    vec2 q=p-vec2(512.,800.);
    q*=vec2(1.-.014*hugMotion.y,1.+.006*hugMotion.y);
    return hugRotate(q,hugMotion.z)+vec2(512.,800.+hugMotion.x);
  }
  vec4 hugSkin(vec2 p,vec2 a,vec2 b,float ra,float rb) {
    float t=clamp(dot(p-a,b-a)/max(dot(b-a,b-a),.01),0.,1.);
    float d=length(p-mix(a,b,t)),r=mix(ra,rb,t);
    float alpha=1.-smoothstep(r-.6,r+.6,d);
    vec3 color=mix(vec3(1.,.91,.85),vec3(.25,.18,.20),smoothstep(r-2.5,r-1.5,d));
    return vec4(color*alpha,alpha);
  }
  vec4 hugArm(vec2 p,bool right) {
    vec2 root=right?hugRoots.zw:hugRoots.xy;
    vec2 elbow=right?hugElbows.zw:hugElbows.xy;
    vec2 wrist=right?hugWrists.zw:hugWrists.xy;
    float upper=length(elbow-root),fore=length(wrist-elbow);
    vec2 hand=hugForward(wrist),axis=hand-root;
    float distance=length(axis),span=clamp(distance,abs(upper-fore)+.05,upper+fore-.05);
    vec2 direction=axis/max(distance,.001);hand=root+direction*span;
    float along=(upper*upper-fore*fore+span*span)/(2.*span);
    float cross=axis.x*(elbow.y-root.y)-axis.y*(elbow.x-root.x);
    vec2 joint=root+direction*along+vec2(-direction.y,direction.x)*sqrt(max(0.,upper*upper-along*along))*sign(cross);
    vec2 a=root+rotateSnack(p-root,elbow-root,joint-root);
    vec2 b=elbow+rotateSnack(p-joint,wrist-elbow,hand-joint);
    vec4 upperArt=hugLayer(seatA,a,right?2.:1.,vec2(2.));
    vec4 foreArt=hugLayer(seatB,b,right?2.:1.,vec2(3.,2.));
    vec4 handArt=hugLayer(seatB,wrist+hugRotate(p-hand,-hugMotion.z),right?4.:3.,vec2(3.,2.));
    vec4 skin=hugSkin(p,root,joint,16.,18.);
    vec4 lower=hugSkin(p,joint,hand,17.,13.);
    skin=lower+skin*(1.-lower.a);
    skin*=smoothstep(-1.,2.,dot(p-root,normalize(joint-root)));
    vec4 result=upperArt+skin*(1.-upperArt.a);
    result=foreArt+result*(1.-foreArt.a);
    return handArt+result*(1.-handArt.a);
  }
  vec4 huggingPillow(vec2 point) {
    vec2 native=point+frontShift;
    vec2 bodyPoint=turnHead(native,vec2(512.,578.),headTilt);
    vec4 scene=hugLayer(seatA,bodyPoint,0.,vec2(2.));
    vec2 q=hugRotate(native-vec2(512.,800.+hugMotion.x),-hugMotion.z);
    q/=vec2(1.-.014*hugMotion.y,1.+.006*hugMotion.y);
    vec4 cushion=hugLayer(seatB,q+vec2(512.,800.),0.,vec2(3.,2.))*hugVisible;
    scene=cushion+scene*(1.-cushion.a);
    vec4 arm=hugArm(native,false);scene=arm+scene*(1.-arm.a);
    arm=hugArm(native,true);scene=arm+scene*(1.-arm.a);
    vec4 cuffs=hugLayer(seatA,native,3.,vec2(2.));scene=cuffs+scene*(1.-cuffs.a);
    vec4 result=mix(part(front,bodyPoint,0.),scene,hugAmount);
    vec4 end=tailPart(front,swingFromRoot(native,tailFront));
    result+=end*(1.-result.a)*tailVisible;
    if(showEyes>0.)result=blinkLayer(result,frontLids,
      matchLids(bodyPoint,frontEyes,vec4(431.,409.,598.,411.)),vec4(343.,333.,340.,125.));
    return result;
  }
  vec4 homeworkTail(vec2 point) {
    if(any(lessThan(point,vec2(0.)))||any(greaterThanEqual(point,size)))return vec4(0.);
#if __VERSION__ >= 300
    vec2 local=clamp(point,vec2(.5),size-.5)/size;
    return textureGrad(seatA,(vec2(1.,0.)+local)*.5,
      tailDx*vec2(1.,.5)/(sleepAmount>=0.?sleepLayout.x:1.),
      tailDy*vec2(1.,.5)/(sleepAmount>=0.?sleepLayout.x:1.));
#else
    return hugLayer(seatA,point,1.,vec2(2.));
#endif
  }
  vec4 studying(vec2 point) {
    vec2 bodyPoint=turnHead(point,vec2(482.,1018.),headTilt);
    // The pencil is beside the face. Drag tilts the head without moving the pencil.
    if(point.x<300. && point.y>950.)bodyPoint=point;
    vec2 tip=vec2(210.2,1132.);
    float hand=(1.-smoothstep(290.,380.,point.x))*smoothstep(175.,188.,point.x)*
      smoothstep(950.,972.,point.y)*(1.-smoothstep(1135.,1147.,point.y));
    vec2 moved=tip+hugRotate(point-tip,-workStroke)-vec2(workTravel,0.);
    bodyPoint+=hand*(moved-point);
    vec4 body=mix(hugLayer(seatA,bodyPoint,0.,vec2(2.)),
      hugLayer(seatA,bodyPoint,2.,vec2(2.)),workBlink);
    vec2 tailPoint=swingFromRoot(point,vec4(752.,1379.,892.,1105.));
    vec4 end=homeworkTail(tailPoint);
    vec4 scene=body+end*(1.-body.a);
    vec2 native=point+frontShift;
    vec4 neutral=part(front,native,0.);
    neutral+=tailPart(front,swingFromRoot(native,tailFront))*(1.-neutral.a);
    if(showEyes>0.)neutral=blinkLayer(neutral,frontLids,
      matchLids(native,frontEyes,vec4(431.,409.,598.,411.)),vec4(343.,333.,340.,125.));
    return mix(neutral,scene,workAmount);
  }
  vec4 sleepingOnPillow(vec2 point) {
    // Only shoulder cloth and the near cuff move. Head, pillow and sock feet
    // keep their dimensions and contact points throughout the breathing cycle.
    vec2 sprite=(point-sleepLayout.yz)/sleepLayout.x+sleepLayout.yz;
    vec2 shoulder=(sprite-sleepShoulder.xy)/sleepShoulder.zw;
    float breath=pow(max(0.,1.-dot(shoulder,shoulder)),2.);
    vec2 hand=(sprite-sleepHand.xy)/sleepHand.zw;
    float cuddle=pow(max(0.,1.-dot(hand,hand)),2.);
    vec2 p=sprite-vec2(0.,breath*sleepMotion.x+cuddle*sleepMotion.y);
    vec4 closed=hugLayer(seatA,p,0.,vec2(2.));
    vec4 opened=hugLayer(seatA,p,2.,vec2(2.));
    vec4 body=mix(closed,opened,sleepMotion.z);
    if(sleepEyeStages>2.5){
      vec4 middle=hugLayer(seatA,p,3.,vec2(2.));
      body=sleepMotion.z<.5?mix(closed,middle,smoothstep(0.,.5,sleepMotion.z)):
        mix(middle,opened,smoothstep(.5,1.,sleepMotion.z));
    }
    vec4 end=homeworkTail(swingFromRoot(sprite,sleepTail));
    vec4 sleeping=body+end*(1.-body.a);
    vec2 native=turnHead(point+frontShift,vec2(512.,578.),headTilt);
    vec4 neutral=part(front,native,0.);
    neutral+=tailPart(front,swingFromRoot(native,tailFront))*(1.-neutral.a);
    if(showEyes>0.)neutral=blinkLayer(neutral,frontLids,
      matchLids(native,frontEyes,vec4(431.,409.,598.,411.)),vec4(343.,333.,340.,125.));
    return mix(neutral,sleeping,sleepAmount);
  }
  vec4 cicadaLayer(sampler2D art,vec2 p,float tile,float columns){
    if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,size)))return vec4(0.);
    vec2 local=clamp(p/size,vec2(.5)/size,1.-vec2(.5)/size);
    local=(local+vec2(mod(tile,columns),floor(tile/columns)))/vec2(columns,2.);
#if __VERSION__ >= 300
    return textureGrad(art,local,tailDx*vec2(2./columns,.5),tailDy*vec2(2./columns,.5));
#else
    return texture2D(art,local);
#endif
  }
  vec4 cicadaProp(vec2 p,vec4 source,vec4 destination){
    vec2 local=(p-destination.xy)/destination.zw;
    if(any(lessThan(local,vec2(0.)))||any(greaterThanEqual(local,vec2(1.))))return vec4(0.);
    vec2 samplePoint=(source.xy+local*source.zw)/size;
#if __VERSION__ >= 300
    vec2 footprint=vec2(2.,1.)*source.zw/destination.zw;
    return textureGrad(warpMap,samplePoint,tailDx*footprint,tailDy*footprint);
#else
    return texture2D(warpMap,samplePoint);
#endif
  }
  vec4 peaceShoulder(vec2 p,vec2 root,vec2 elbow){
    vec2 axis=elbow-root;
    float along=clamp(dot(p-root,axis)/dot(axis,axis),0.,1.);
    float radius=mix(25.,31.,along);
    float distanceToBone=length(p-mix(root,elbow,along));
    float alpha=1.-smoothstep(radius-.7,radius+.7,distanceToBone);
    float ink=smoothstep(radius-3.5,radius-2.,distanceToBone);
    vec3 color=mix(vec3(1.,.887,.824),vec3(.19,.145,.17),ink);
    return vec4(color*alpha,alpha);
  }
  vec4 peaceArm(vec2 p,bool rightArm,bool behind){
    vec2 local=rightArm?vec2(1024.-p.x,p.y):p;
    vec2 root=vec2(410.,652.),sourceElbow=vec2(307.,782.),sourceWrist=vec2(322.,632.);
    float upperLength=length(sourceElbow-root),foreLength=length(sourceWrist-sourceElbow);
    float upperAngle=mix(1.93,atan(130.,-103.),peaceMotion.x);
    // Unwrap the forearm angle through the OUTSIDE of the body when raising.
    float foreAngle=mix(1.70,atan(-150.,15.)+6.28318530718,peaceMotion.x);
    vec2 elbow=root+upperLength*vec2(cos(upperAngle),sin(upperAngle));
    vec2 wrist=elbow+foreLength*vec2(cos(foreAngle),sin(foreAngle));
    if(behind)return peaceShoulder(local,root,elbow);
    vec2 source=sourceElbow+rotateSnack(local-elbow,sourceWrist-sourceElbow,wrist-elbow);
    float ownSide=1.-step(512.,source.x);
    if(rightArm)source.x=1024.-source.x;
    return snackLayer(seatA,source,1.)*ownSide;
  }
  vec4 posingPeace(vec2 point){
    vec2 p=point+frontShift;
    vec2 headPoint=turnHead(p,vec2(512.,578.),headTilt);
    vec4 rear=peaceArm(p,false,true);
    vec4 right=peaceArm(p,true,true);rear=right+rear*(1.-right.a);
    vec4 body=snackLayer(seatA,headPoint,0.);
    body+=rear*(1.-body.a);
    vec4 arms=peaceArm(p,false,false);
    right=peaceArm(p,true,false);arms=right+arms*(1.-right.a);
    body=arms+body*(1.-arms.a);
    vec4 mouth=snackLayer(seatA,headPoint,2.)*peaceMotion.y;
    body=mouth+body*(1.-mouth.a);
    vec4 end=tailPart(front,swingFromRoot(p,tailFront));
    body+=end*(1.-body.a);
    vec4 neutral=part(front,headPoint,0.);neutral+=end*(1.-neutral.a);
    vec4 result=mix(neutral,body,peaceAmount);
    if(showEyes>0.)result=blinkLayer(result,frontLids,headPoint,vec4(343.,333.,340.,150.));
    return result;
  }
  vec4 eatingCicada(vec2 point){
    vec2 p=point+frontShift;
    vec2 headPoint=turnHead(p,vec2(512.,670.),headTilt);
    vec4 body=cicadaLayer(seatA,headPoint,cicadaMotion.x,4.);
    vec4 end=tailPart(front,swingFromRoot(p,tailFront));
    body+=end*(1.-body.a);
    vec4 trunk=cicadaProp(p,vec4(60.,25.,350.,1490.),vec4(60.,140.,270.,1378.))*cicadaProps.x;
    body+=trunk*(1.-body.a);
    vec4 bug=cicadaProp(p,vec4(650.,430.,270.,490.),vec4(225.,485.,61.,110.))*cicadaProps.x*cicadaProps.y;
    body=bug+body*(1.-bug.a);
    vec4 neutral=part(front,p,0.);
    neutral+=end*(1.-neutral.a);
    return mix(neutral,body,cicadaAmount);
  }
  vec4 riceLayer(vec2 p,float tile){
    if(any(lessThan(p,vec2(0.)))||any(greaterThanEqual(p,size)))return vec4(0.);
    vec2 local=clamp(p/size,vec2(.5)/size,1.-vec2(.5)/size);
    local=(local+vec2(mod(tile,4.),floor(tile/4.)))/vec2(4.,3.);
#if __VERSION__ >= 300
    return textureGrad(seatA,local,tailDx*vec2(.5,1./3.),tailDy*vec2(.5,1./3.));
#else
    return texture2D(seatA,local);
#endif
  }
  vec4 eatingRice(vec2 point){
    vec2 p=point+frontShift;
    // Correspondence only follows the chopstick arm. A face remains one
    // complete authored head, including the changing jaw and hair silhouette.
    vec2 aPoint=p,bPoint=p;
    float fraction=ricePose.z;
    if(ricePose.x!=ricePose.y){
      float arm=(1.-smoothstep(315.,380.,p.x))*smoothstep(485.,535.,p.y)*(1.-smoothstep(845.,884.,p.y));
      if(arm>.001){
        aPoint=mix(p,inverseWarp(p,fraction,2.*ricePose.x),arm);
        bPoint=mix(p,inverseWarp(p,1.-fraction,2.*ricePose.x+1.),arm);
      }
    }
    vec4 body=poseMix(riceLayer(aPoint,ricePose.x),riceLayer(bPoint,ricePose.y),fraction);
    vec4 end=riceLayer(swingFromRoot(p,vec4(638.,1191.,834.,1168.)),11.);
    body+=end*(1.-body.a);
    vec2 headPoint=turnHead(p,vec2(512.,578.),headTilt);
    vec4 neutral=part(front,headPoint,0.);
    neutral+=tailPart(front,swingFromRoot(p,tailFront))*(1.-neutral.a);
    return mix(neutral,body,riceAmount);
  }
  void main() {
#if __VERSION__ >= 300
    tailDx = dFdx(uv)*vec2(.5*canvasSpan,1.);
    tailDy = dFdy(uv)*vec2(.5*canvasSpan,1.);
#endif
    vec2 stagePoint = uv * size * vec2(canvasSpan,1.);
    vec2 point = stagePoint;
    if(riceAmount>=0.){gl_FragColor=eatingRice(point);return;}
    if(peaceAmount>=0.){gl_FragColor=posingPeace(point);return;}
    if(cicadaAmount>=0.){gl_FragColor=eatingCicada(point);return;}
    if(sleepAmount>=0.){gl_FragColor=sleepingOnPillow(stagePoint);return;}
    if(workAmount>=0.){gl_FragColor=studying(stagePoint);return;}
    if(hugAmount>=0.){gl_FragColor=huggingPillow(stagePoint);return;}
    if (shakeAmount >= 0.) {
      // The approved full-body frames play at their original aspect ratio.
      // One atlas tile is a complete pose; no body scaling or flow is applied.
      vec2 native = turnHead(stagePoint + frontShift,vec2(512.,578.),headTilt);
      vec2 tile = vec2(mod(shakeFrame,4.),floor(shakeFrame/4.));
      vec2 local = clamp(native/size,vec2(.5/384.,.5/576.),vec2(1.-.5/384.,1.-.5/576.));
      vec4 animated = texture2D(seatA,(tile+local)/4.);
      if (any(lessThan(native,vec2(0.))) || any(greaterThanEqual(native,size))) animated=vec4(0.);
      vec4 neutral = figure(front,native,tailFront,492.+frontShift.x);
      gl_FragColor = mix(neutral,animated,shakeAmount);
      return;
    }
    if (snackAmount >= 0.) {
      gl_FragColor = eatingWatermelon(stagePoint);
      return;
    }
    if (seatAmount >= 0.) {
      gl_FragColor = sitting(stagePoint);
      return;
    }
    vec2 frontPoint = point + frontShift;
    vec2 sidePoint = point;
    if (angle > 0. && angle < 1.) {
      frontPoint = inverseWarp(point, angle, 0.) + frontShift;
      sidePoint = inverseWarp(point, 1. - angle, 1.);
    }
    frontPoint = turnHead(frontPoint,vec2(512.,578.),headTilt);
    sidePoint = turnHead(sidePoint,vec2(553.,578.),headTilt);
    vec4 forward = vec4(0.);
    vec4 side = vec4(0.);
    if (angle < 1.) forward = figure(front,frontPoint,tailFront,492.+frontShift.x);
    if (angle > 0.) side = figure(portrait,sidePoint,tailSide,492.);
    if (showEyes > 0.) {
      if (angle < 1.) forward = blinkLayer(forward, frontLids,
        matchLids(frontPoint, frontEyes, vec4(431.,409.,598.,411.)), vec4(343.,333.,340.,125.));
      if (angle > 0.) side = blinkLayer(side, sideLids,
        matchLids(sidePoint, sideEyes, vec4(516.,423.,675.,397.)), vec4(428.,323.,308.,147.));
    }
    vec4 color = poseMix(forward, side, angle);
    if (clothes < 1.) {
      vec2 old = point + oldFrontShift;
      color = poseMix(figure(oldFront,old,tailOld,492.+oldFrontShift.x), color, clothes);
    }
    gl_FragColor = color;
  }
`;

function compile(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw Error(gl.getShaderInfoLog(shader));
  return shader;
}

function texture(source, artwork = false) {
  const image = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, artwork && mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (artwork && !mipmaps && source.width === width * 2 && source.height === height) {
    const reduced = document.createElement('canvas');
    reduced.width = source.width / 2;
    reduced.height = source.height / 2;
    const painter = reduced.getContext('2d');
    painter.imageSmoothingQuality = 'high';
    painter.drawImage(source, 0, 0, reduced.width, reduced.height);
    source = reduced;
  }
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  if (artwork && mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  return image;
}

function useTexture(unit, image) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, image);
}

function bitmap(source) {
  const image = new Image();
  image.src = source;
  return image.decode().then(() => image);
}

function paintHit(image) {
  const half = image.width / 2;
  hitContext.drawImage(image,0,0,half,image.height,0,0,hit.width,hit.height);
  hitContext.drawImage(image,half,0,half,image.height,0,0,hit.width,hit.height);
}

function setHitMask(front, side) {
  hitContext.clearRect(0, 0, hit.width, hit.height);
  paintHit(front);
  paintHit(side);
  hitPixels = hitContext.getImageData(0, 0, hit.width, hit.height).data;
}

function resize() {
  pixelRatio = devicePixelRatio;
  const unit = state.stagePixels / 2;
  stageElement.style.setProperty('--stage-width', state.stagePixels * CANVAS_SPAN / pixelRatio + 'px');
  stageElement.style.setProperty('--stage-left', Math.round((innerWidth*pixelRatio-state.stagePixels*CANVAS_SPAN)/2)/pixelRatio+'px');
  stageElement.style.setProperty('--stage-ratio', String(CANVAS_SPAN*2/3));
  stageElement.style.setProperty('--foot-room', Math.round(state.stagePixels*.036)/pixelRatio+'px');
  if (pet.width === unit * 2 * CANVAS_SPAN && pet.height === unit * 3) return;
  pet.width = effects.width = unit * 2 * CANVAS_SPAN;
  pet.height = effects.height = unit * 3;
  gl.viewport(0, 0, pet.width, pet.height);
  const now = performance.now();
  draw(lastScene,dragPausedAt === null ? now : dragFrameTime,now);
}

function motion(id, t) {
  if(id==='peace')return {swish:0,phase:0,blink:peaceMovement(t).face};
  if (id === 'idle') {
    const swish = 29 * gesture(t,.43,1.02,1.43,3.38)
      + 8 * gesture(t,2.12,2.39,2.54,3.19);
    return {swish, phase:1.1 + t * 4.65,
      blink:gesture(t,.25,.34,.367,.505)};
  }
  if (id === 'butterfly') {
    return {swish:17 * gesture(t,.6,1.6,2.4,3.55), phase:2.8+t*3.2,
      blink:gesture(t,2.42,2.52,2.58,2.76)};
  }
  if (id === 'watermelon') return {swish:0,phase:0,
    blink:gesture(t,4.05,4.15,4.20,4.34)};
  if (id === 'pillow') return {swish:0,phase:0,
    blink:Math.max(gesture(t,2.15,2.24,2.29,2.43),gesture(t,6.05,6.14,6.19,6.34),gesture(t,10.15,10.24,10.29,10.44))};
  if(id==='backpacksleep')return {swish:0,phase:0,blink:gesture(t,.06,.18,.28,.48)};
  if (id === 'rest' || id === 'kneel') {
    return {swish:(id === 'rest' ? 15 : 30) * gesture(t,1.71,2.44,4.67,5.47),
      phase:.65+t*(id === 'rest' ? 2.15 : 3.75)};
  }
  return {swish:0, phase:0};
}

function paintTexture(unit, image, painter, ...values) {
  painter.paint(...values);
  useTexture(unit,image);
  gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,painter.canvas);
}

const resting = {id:null, time:0, angle:0};
let lastScene = resting;

function draw(scene, now, swayTime = now) {
  const {id,time,elapsed=time,angle,turnBlink=0,strength=1,clothes=1,oldOutfit,releaseAt} = scene;
  const display = state.outfit;
  gl.uniform1f(uniforms.canvasSpan,CANVAS_SPAN);
  const seat = seating.get(id);
  const sit = seat && seatMovement(id,time,strength);
  const isSitting = Boolean(sit && sit.progress > 0);
  const {swish, phase, blink = 0} = motion(id,time);
  if (now > nextBlink + 360) nextBlink = now + range(3200,5700);
  const ambientBlink = id ? gesture((now-nextBlink)/1000,0,.086,.116,.243) : 0;
  const eyelids = Math.max(blink*strength, turnBlink, ambientBlink);
  const outfit = textures.get(display);
  const rig = RIGS[display];
  const frontTail = TAIL_RIGS[display + '-front'];
  const sideTail = TAIL_RIGS[display];
  useTexture(0,outfit.side);
  useTexture(1,outfit.front);
  useTexture(2,blinkTextures[2]);
  useTexture(3,blinkTextures[3]);
  useTexture(4,outfit.front);
  useTexture(5,outfit.front);
  useTexture(6,oldOutfit ? textures.get(oldOutfit).front : outfit.front);
  useTexture(7,outfit.warp);
  gl.uniform4fv(uniforms.frontEyes,rig.front);
  gl.uniform4fv(uniforms.sideEyes,rig.side);
  gl.uniform2fv(uniforms.frontShift,rig.shift);
  gl.uniform2fv(uniforms.oldFrontShift,oldOutfit ? RIGS[oldOutfit].shift : rig.shift);
  const sway = (swayTime-swayStart)/1000*1.65;
  gl.uniform3f(uniforms.tail,swish*strength,phase,sway);
  const standing = (id === null || id === 'idle') && angle === 0 && !isSitting && !wardrobe &&
    (!current || current.action.id === 'idle');
  gl.uniform1f(uniforms.standingIdle,standing ? 1 : 0);
  gl.uniform1f(uniforms.standingPhase,(swayTime-swayStart)/1000*Math.PI*2/tailPeriod);
  gl.uniform1f(uniforms.tailVisible,1);
  gl.uniform1f(uniforms.headTilt,tilt);
  gl.uniform4fv(uniforms.tailFront,frontTail);
  gl.uniform4fv(uniforms.tailSide,sideTail);
  if (oldOutfit) gl.uniform4fv(uniforms.tailOld,TAIL_RIGS[oldOutfit+'-front']);
  gl.uniform1f(uniforms.angle,angle);
  gl.uniform1f(uniforms.clothes,clothes);
  gl.uniform1f(uniforms.showEyes,eyelids);
  gl.uniform1f(uniforms.mapTiles,display === 'classic' ? 6 : 2);
  gl.uniform1f(uniforms.seatAmount,-1);
  gl.uniform1f(uniforms.faceAmount,0);
  gl.uniform1f(uniforms.snackAmount,-1);
  gl.uniform1f(uniforms.shakeAmount,-1);
  gl.uniform1f(uniforms.hugAmount,-1);
  gl.uniform1f(uniforms.workAmount,-1);
  gl.uniform1f(uniforms.sleepAmount,-1);
  gl.uniform1f(uniforms.cicadaAmount,-1);
  gl.uniform1f(uniforms.peaceAmount,-1);
  gl.uniform1f(uniforms.riceAmount,-1);
  sittingHit = null;
  if(id==='rice'){
    const move=riceMovement(time);
    useTexture(4,rice.art);useTexture(7,rice.flow);
    gl.uniform1f(uniforms.mapTiles,20);
    gl.uniform1f(uniforms.riceAmount,move.active*strength);
    gl.uniform3f(uniforms.ricePose,move.a,move.b,move.blend);
  }
  if(id==='peace'){
    const move=peaceMovement(time);
    useTexture(4,peace.art);
    paintTexture(3,peace.lids,peaceBlink,eyelids);
    gl.uniform1f(uniforms.peaceAmount,move.active*strength);
    gl.uniform2f(uniforms.peaceMotion,move.raise,move.face*strength);
  }
  if(id==='cicada'){
    const move=cicadaMovement(time);
    useTexture(4,cicada.body);useTexture(5,cicada.faces);useTexture(7,cicada.props);
    gl.uniform1f(uniforms.cicadaAmount,move.active*strength);
    gl.uniform4f(uniforms.cicadaMotion,move.a,move.b,move.blend,move.pair);
    gl.uniform2f(uniforms.cicadaProps,move.props,move.insect);
  }
  const dock = id === 'rest' && sit?.settled ? chargingDock(time) : 0;
  gl.uniform1f(uniforms.tailDock,dock);
  gl.uniform1f(uniforms.napTilt,sit?.settled ? sit.napTilt : 0);
  if(SLEEP_POSES[id]){
    const config=SLEEP_POSES[id],art=id==='sidesleep'?sideSleep:backpackSleep;
    const sleep=sideSleepMovement(time,releaseAt,config);
    useTexture(4,art.art);
    gl.uniform1f(uniforms.sleepAmount,sleep.active*strength);
    gl.uniform3f(uniforms.sleepMotion,sleep.breathing*strength,sleep.cuddle*strength,sleep.awake);
    gl.uniform4fv(uniforms.sleepTail,config.tail);
    gl.uniform3f(uniforms.sleepLayout,config.scale,...config.anchor);
    gl.uniform4fv(uniforms.sleepShoulder,config.shoulder);
    gl.uniform4fv(uniforms.sleepHand,config.hand);
    gl.uniform1f(uniforms.sleepEyeStages,config.eyeStages??2);
    sittingHit=art.hit;
  }
  if(id==='homework'){
    const work=homeworkMovement(time);
    useTexture(4,homework.art);
    gl.uniform1f(uniforms.workAmount,work.active*strength);
    gl.uniform1f(uniforms.workStroke,work.stroke*strength);
    gl.uniform1f(uniforms.workTravel,work.travel*strength);
    gl.uniform1f(uniforms.workBlink,work.blink);
    sittingHit=homework.hit;
  }
  if(id==='pillow'){
    const hug=pillowMovement(time);
    useTexture(4,pillow.body);useTexture(5,pillow.details);
    gl.uniform1f(uniforms.hugAmount,hug.active*strength);
    gl.uniform1f(uniforms.hugVisible,hug.visible);
    gl.uniform3f(uniforms.hugMotion,hug.lift,hug.squeeze*strength,hug.roll*strength);
    gl.uniform4fv(uniforms.hugRoots,PILLOW_RIG.roots);
    gl.uniform4fv(uniforms.hugElbows,PILLOW_RIG.elbows);
    gl.uniform4fv(uniforms.hugWrists,PILLOW_RIG.wrists);
    sittingHit=pillow.hit;
  }
  if (id === 'headshake') {
    useTexture(4,headshake.art);
    const active = gesture(time,0,.22,3.38,3.6)*strength;
    const frame = Math.floor(Math.max(0,time-.22)*50+1e-6)%15;
    gl.uniform1f(uniforms.shakeAmount,active);
    gl.uniform1f(uniforms.shakeFrame,frame);
    sittingHit = headshake.hit[frame];
  }
  if (id === 'watermelon') {
    const snack=watermelonMovement(time);
    useTexture(4,watermelon.limbs);
    useTexture(5,watermelon.details);
    gl.uniform1f(uniforms.snackAmount,snack.active*strength);
    gl.uniform1f(uniforms.snackLift,snack.lift);
    gl.uniform1f(uniforms.snackBitten,snack.bitten);
    gl.uniform1f(uniforms.snackOpen,snack.open);
    gl.uniform1f(uniforms.snackFood,snack.food);
    gl.uniform1f(uniforms.snackChew,snack.chew*strength);
  }
  if (isSitting) {
    const afterKnees = sit.progress >= 1;
    const pair = afterKnees ? 1 : 0;
    const profile = id === 'kneel';
    const face = SEAT_FACES[id];
    useTexture(4,afterKnees ? seat.mid : (profile ? outfit.side : outfit.front));
    useTexture(5,afterKnees ? seat.art : seat.mid);
    useTexture(7,seat.flow);
    gl.uniform1f(uniforms.mapTiles,4);
    gl.uniform1f(uniforms.seatAmount,sit.progress-pair);
    gl.uniform1f(uniforms.seatPair,pair);
    gl.uniform3fv(uniforms.anchorsA,seat.anchors[pair]);
    gl.uniform3fv(uniforms.anchorsB,seat.anchors[pair+1]);
    gl.uniform2f(uniforms.seatShift,!afterKnees && !profile ? rig.shift[0] : 0,0);
    gl.uniform4fv(uniforms.tailA,afterKnees ? seat.midTail : (profile ? sideTail : frontTail));
    gl.uniform4fv(uniforms.tailB,afterKnees ? seat.tail : seat.midTail);
    gl.uniform1f(uniforms.seatNod,sit.settled ? Math.sin(elapsed*1.8)*(profile ? 2.3 : 3.9) : 0);
    if (sit.settled) {
      sittingHit = seat.hit;
      const open = profile ? Math.min(sit.open,1-ambientBlink) : sit.open;
      if ((profile ? open < 1 : open > 0) || sit.smile > 0) {
        paintTexture(2,sittingFaceTexture[id],face,open,sit.smile);
        gl.uniform4fv(uniforms.faceRect,face.rect);
        gl.uniform1f(uniforms.faceAmount,1);
      }
    }
  } else if (eyelids > 0 && id!=='peace') {
    if (angle > .15) paintTexture(2,blinkTextures[2],sideBlink,eyelids);
    if (angle < .85) paintTexture(3,blinkTextures[3],frontBlink,eyelids);
  }
  gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
  if((id==='cicada'&&cicadaMovement(time).active*strength>.5)||
    (id==='peace'&&peaceMovement(time).active*strength>.5)||
    (id==='rice'&&riceMovement(time).active*strength>.5)){
    hitContext.clearRect(0,0,hit.width,hit.height);
    hitContext.drawImage(pet,0,0,pet.width/CANVAS_SPAN,pet.height,0,0,hit.width,hit.height);
    sittingHit=hitContext.getImageData(0,0,hit.width,hit.height).data;
  }
  const seated = (sit?.progress ?? 0) / 2;
  shadow.style.width = (43+seated*(id === 'kneel' ? 18 : 13))/CANVAS_SPAN+'%';
  shadow.style.left = (50+seated*(id === 'kneel' ? 3 : 0))/CANVAS_SPAN+'%';
  if(id==='rice')shadow.style.width=(43+49*riceMovement(time).active*strength)/CANVAS_SPAN+'%';
  if(id==='homework'){
    const active=homeworkMovement(time).active*strength;
    shadow.style.width=(43+35*active)/CANVAS_SPAN+'%';shadow.style.left=(50-2*active)/CANVAS_SPAN+'%';
  }
  if(SLEEP_POSES[id]){
    const config=SLEEP_POSES[id];
    const active=sideSleepMovement(time,releaseAt,config).active*strength;
    const center=config.anchor[0]+config.scale*(512-config.anchor[0]);
    shadow.style.width=(43+(config.shadowWidth*config.scale-43)*active)/CANVAS_SPAN+'%';
    shadow.style.left=(50+(center/width*100-50)*active)/CANVAS_SPAN+'%';
  }
  stage.setTransform(effects.width/(width*CANVAS_SPAN),0,0,effects.height/height,0,0);
  stage.clearRect(0,0,width*CANVAS_SPAN,height);
  effects.style.opacity = strength;
  if (id) drawEffects(stage,id,time,elapsed,Boolean(sit?.settled),dock);
  if(id==='rice')drawRicePuff(stage,time);
}
function schedule() {
  clearTimeout(nextTimer);
  if (!state.interval || current || wardrobe || dragPausedAt !== null) return;
  nextTimer = setTimeout(() => {
    play(nextAction(rotation,state.outfit,lastPlayed),true);
  }, range(...state.interval) * 1000);
}

function play(id,automatic=false) {
  const action = ACTIONS.find(item => item.id === id);
  if (!action || !canPlay(action,wardrobe?.target.outfit ?? state.outfit)) return;
  if (current || wardrobe) {
    queued = {id,automatic};
    return;
  }
  clearTimeout(nextTimer);
  current = {action,start:performance.now(),turns:id === 'butterfly' || id === 'kneel'};
  petVoice.begin(id,automatic);
  lastPlayed = id;
}

function resume() {
  const next = queued;
  queued = undefined;
  if (next) play(next.id,next.automatic);
  schedule();
}

function poseScene({action,turns,wakeAt}, elapsed) {
  if(SLEEP_POSES[action.id]){
    const config=SLEEP_POSES[action.id];
    const releaseAt=Math.min(config.release,wakeAt??config.release);
    if(elapsed>=Math.min(action.seconds,releaseAt+config.wakeSeconds))return null;
    return {id:action.id,time:elapsed,elapsed,angle:0,releaseAt};
  }
  if (seatTiming[action.id] && elapsed >= action.seconds) return null;
  const enter = turns ? turnIn : 0;
  const exitDuration = turns ? turnOut : 0;
  const clock = Math.max(0,elapsed-enter);
  const seat = seatTiming[action.id];
  const end = seat?.end ?? action.seconds;
  let time = clock;
  if (seat && clock > seat.hold) {
    const automatic = action.seconds-enter-exitDuration-(end-seat.release);
    const release = Math.min(automatic,wakeAt ?? automatic);
    time = clock < release ? seat.hold : seat.release + clock-release;
  }
  if (time >= end+exitDuration) return null;
  if (turns && elapsed < enter) {
    return { ...resting, angle:ease(0, turnIn, elapsed), turnBlink:gesture(elapsed,.09,.22,.27,.45) };
  }
  if (turns && time >= end) {
    const exit = time-end;
    return { ...resting, angle:1 - ease(0,turnOut,exit), turnBlink:gesture(exit,.11,.25,.32,.54) };
  }
  return {id:action.id,time,elapsed:clock,angle:turns ? 1 : 0};
}

function sceneAt(now, images) {
  if (wardrobe) {
    const elapsed = Math.max(0, (now-wardrobe.start)/1000);
    if (elapsed < wardrobe.settle) {
      if(wardrobe.sleepExit)return {...wardrobe.sleepExit,
        time:wardrobe.sleepExit.time+elapsed,elapsed:(wardrobe.sleepExit.elapsed??wardrobe.sleepExit.time)+elapsed};
      const strength = 1 - ease(0, wardrobe.settle, elapsed);
      return {...wardrobe.from, angle:wardrobe.from.angle * strength, strength};
    }
    if (state.outfit !== wardrobe.target.outfit) {
      rotation.length = 0;
      state = wardrobe.target;
      setHitMask(images.get(state.outfit).front, images.get(state.outfit).side);
    } else state = wardrobe.target;
    const changeTime = elapsed - wardrobe.settle;
    if (changeTime < .22) {
      return {...resting, clothes:ease(0,.22,changeTime), oldOutfit:wardrobe.oldOutfit};
    }
    wardrobe = undefined;
    resume();
  }
  if (!current) return resting;
  const scene = poseScene(current,(now-current.start)/1000);
  if (scene) return scene;
  current = null;
  petVoice.finish(true);
  resume();
  return resting;
}

function change(next) {
  petVoice.configure(next.voice);
  if (next.stagePixels !== state.stagePixels) {
    state.stagePixels = next.stagePixels;
    resize();
  }
  if (wardrobe) {
    wardrobe.target = next;
    return;
  }
  if (state.outfit === next.outfit) {
    state = next;
    schedule();
    return;
  }
  clearTimeout(nextTimer);
  petVoice.finish();
  const config=SLEEP_POSES[lastScene.id];
  const releaseAt=config?.smoothTransitions?Math.min(lastScene.time,lastScene.releaseAt??lastScene.time):undefined;
  wardrobe = {target:next,oldOutfit:state.outfit,from:lastScene,start:performance.now(),
    sleepExit:releaseAt===undefined?undefined:{...lastScene,releaseAt},
    settle:releaseAt===undefined?(SEAT_RIGS[lastScene.id]?1.10:(lastScene.angle>0||lastScene.id?.length? .36:0)):
      Math.max(.08,config.wakeSeconds-(lastScene.time-releaseAt))};
  current = null;
  queued = undefined;
}

function onPet(event) {
  const bounds = pet.getBoundingClientRect();
  let worldX=(event.clientX-bounds.left)/bounds.width*width*CANVAS_SPAN;
  let worldY=(event.clientY-bounds.top)/bounds.height*height;
  const config=SLEEP_POSES[lastScene.id];
  const sleeping=config&&sideSleepMovement(lastScene.time,lastScene.releaseAt,config).active>.5;
  if(sleeping){
    worldX=(worldX-config.anchor[0])/config.scale+config.anchor[0];
    worldY=(worldY-config.anchor[1])/config.scale+config.anchor[1];
  }
  const x=Math.floor(worldX/width*hit.width),y=Math.floor(worldY/height*hit.height);
  const mask=config&&!sleeping?hitPixels:(sittingHit??hitPixels);
  return x >= 0 && x < hit.width && y >= 0 && y < hit.height &&
    mask[(y * hit.width + x) * 4 + 3] > 20;
}

function setPass(value) {
  if (value === passThrough) return;
  passThrough = value;
  petHost.pass(value);
}

function freezeDrag() {
  petVoice.pause();
  dragPausedAt = performance.now();
  dragFrameTime = Number.isFinite(lastPaint) ? lastPaint : dragPausedAt;
  clearTimeout(nextTimer);
}

function thawDrag() {
  if (dragPausedAt === null) return;
  const pause = performance.now() - dragPausedAt;
  startTime += pause;
  nextBlink += pause;
  if (current) current.start += pause;
  if (wardrobe) wardrobe.start += pause;
  dragPausedAt = null;
  petVoice.resume();
  tiltTarget = 0;
  schedule();
}

function bindInput() {
  window.addEventListener('pointermove', event => {
    if (pointer) {
      if (!pointer.moving && Math.hypot(event.screenX-pointer.x, event.screenY-pointer.y) >= 4) {
        pointer.moving = true;
        freezeDrag();
      }
      if (pointer.moving) {
        const dx = event.screenX-pointer.x;
        tiltTarget = Math.abs(dx) >= 3 ? Math.sign(dx)*.105 : -.078;
        petHost.drag('move');
      }
    } else setPass(!onPet(event));
  });
  pet.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !onPet(event)) return;
    pointer = {x:event.screenX, y:event.screenY, moving:false};
    pet.setPointerCapture(event.pointerId);
    petHost.drag('start');
  });
  function finishPointer(event) {
    if (!pointer) return;
    const clicked = !pointer.moving && event.type === 'pointerup';
    pointer = null;
    petHost.drag('end');
    thawDrag();
    if (clicked && !current) play('idle');
    else if (clicked && current.wakeAt === undefined) {
      const timing = seatTiming[current.action.id];
      if (timing) {
        const elapsed = (performance.now()-current.start)/1000 - (current.turns ? turnIn : 0);
        current.wakeAt = Math.max(timing.hold,elapsed);
        petVoice.react('wake');
      } else if(SLEEP_POSES[current.action.id]){
        current.wakeAt=Math.max(1.2,SLEEP_POSES[current.action.id].enterSeconds??0,(performance.now()-current.start)/1000);
        petVoice.react('wake');
      }
    }
  }
  pet.addEventListener('pointerup', finishPointer);
  pet.addEventListener('pointercancel', finishPointer);
  pet.addEventListener('lostpointercapture', finishPointer);
  window.addEventListener('contextmenu', event => {
    event.preventDefault();
    if (onPet(event)) { setPass(false); petHost.menu(); }
  });
  petHost.menuClosed(() => { passThrough = undefined; });
}

async function start() {
  const [initial,loaded,seats,snackImages,shakeImage,pillowImages,homeworkImages,sideSleepImages,backpackImages,cicadaImages,peaceImage,riceImages] = await Promise.all([
    petHost.initial(),
    Promise.all(OUTFITS.map(async ({id}) => {
      const [side,front,warp] = await Promise.all([
        bitmap('assets/'+id+'-rig.png'),bitmap('assets/'+id+'-front-rig.png'),bitmap('assets/'+id+'-motion.png'),
      ]);
      return [id,{side,front,warp}];
    })),
    Promise.all(Object.entries(SEAT_RIGS).map(async ([id,config]) => {
      const [mid,art,flow] = await Promise.all([
        bitmap('assets/'+config.mid),bitmap('assets/'+config.seat),bitmap('assets/'+config.flow),
      ]);
      return [id,config,mid,art,flow];
    })),
    Promise.all(['limbs','details'].map(name=>bitmap('assets/watermelon-'+name+'.png'))),
    bitmap('assets/headshake-summer.png'),
    Promise.all(['body','details','hit'].map(name=>bitmap('assets/pillow-'+name+'.png'))),
    Promise.all(['summer','hit'].map(name=>bitmap('assets/homework-'+name+'.png'))),
    Promise.all(['side-sleep.png','side-sleep-hit.png'].map(name=>bitmap('assets/'+name))),
    Promise.all(['backpack-sleep.png','backpack-sleep-hit.png'].map(name=>bitmap('assets/'+name))),
    Promise.all(['body','faces','props'].map(name=>bitmap('assets/cicada-'+name+'.png'))),
    bitmap('assets/peace-pose.png'),Promise.all(['pose','motion'].map(name=>bitmap('assets/rice-'+name+'-v2.png'))),peaceBlink.ready,
    sideBlink.ready,frontBlink.ready,SEAT_FACES.rest.ready,SEAT_FACES.kneel.ready,
  ]);
  state = initial;
  petVoice.configure(initial.voice);
  const images = new Map(loaded);
  const contextOptions = {alpha:true, antialias:false};
  gl = pet.getContext('webgl2', contextOptions);
  mipmaps = Boolean(gl);
  gl ??= pet.getContext('webgl', contextOptions);
  if (!gl) throw Error('WebGL unavailable');
  const vertexCode = mipmaps ? '#version 300 es\n' + vertexSource
    .replace('attribute ', 'in ').replace('varying ', 'out ') : vertexSource;
  const fragmentCode = mipmaps ? '#version 300 es\n' + fragmentSource
    .replace('varying ', 'in ').replace('precision highp float;', 'precision highp float;\n  out vec4 fragColor;')
    .replaceAll('texture2D(', 'texture(').replaceAll('gl_FragColor', 'fragColor') : fragmentSource;
  const program = gl.createProgram();
  gl.attachShader(program, compile(gl.VERTEX_SHADER, vertexCode));
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, fragmentCode));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw Error(gl.getProgramInfoLog(program));
  gl.useProgram(program);
  const geometry = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  const vertex = gl.getAttribLocation(program, 'vertex');
  gl.enableVertexAttribArray(vertex);
  gl.vertexAttribPointer(vertex, 2, gl.FLOAT, false, 0, 0);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
  textures = new Map(loaded.map(([id, image]) => [id, {
    side:texture(image.side,true), front:texture(image.front,true), warp:texture(image.warp),
  }]));
  watermelon = {limbs:texture(snackImages[0],true),details:texture(snackImages[1],true)};
  cicada={body:texture(cicadaImages[0],true),faces:texture(cicadaImages[1],true),props:texture(cicadaImages[2],true)};
  peace={art:texture(peaceImage,true),lids:texture(peaceBlink.canvas)};
  rice={art:texture(riceImages[0],true),flow:texture(riceImages[1])};
  const shakeHit = Array.from({length:15},(_,frame)=>{
    hitContext.clearRect(0,0,hit.width,hit.height);
    hitContext.drawImage(shakeImage,(frame%4)*384,Math.floor(frame/4)*576,384,576,
      -RIGS.green.shift[0]/width*hit.width,-RIGS.green.shift[1]/height*hit.height,hit.width,hit.height);
    return hitContext.getImageData(0,0,hit.width,hit.height).data;
  });
  headshake = {art:texture(shakeImage,true),hit:shakeHit};
  hitContext.clearRect(0,0,hit.width,hit.height);
  hitContext.drawImage(pillowImages[2],-RIGS.pajamas.shift[0]/width*hit.width,0,hit.width,hit.height);
  pillow={body:texture(pillowImages[0],true),details:texture(pillowImages[1],true),
    hit:hitContext.getImageData(0,0,hit.width,hit.height).data};
  blinkTextures = {2:texture(sideBlink.canvas),3:texture(frontBlink.canvas)};
  sittingFaceTexture = Object.fromEntries(Object.entries(SEAT_FACES).map(([id,face]) => [id,texture(face.canvas)]));
  seating = new Map(seats.map(([id,config,mid,art,flow]) => {
    hitContext.clearRect(0,0,hit.width,hit.height);
    paintHit(art);
    return [id,{...config,mid:texture(mid,true),art:texture(art,true),flow:texture(flow),
      hit:hitContext.getImageData(0,0,hit.width,hit.height).data}];
  }));
  const samplers = ['portrait','front','sideLids','frontLids','seatA','seatB','oldFront','warpMap'];
  hitContext.clearRect(0,0,hit.width,hit.height);
  hitContext.drawImage(homeworkImages[1],0,0,hit.width,hit.height);
  homework={art:texture(homeworkImages[0],true),hit:hitContext.getImageData(0,0,hit.width,hit.height).data};
  hitContext.clearRect(0,0,hit.width,hit.height);
  hitContext.drawImage(sideSleepImages[1],0,0,hit.width,hit.height);
  sideSleep={art:texture(sideSleepImages[0],true),hit:hitContext.getImageData(0,0,hit.width,hit.height).data};
  hitContext.clearRect(0,0,hit.width,hit.height);
  hitContext.drawImage(backpackImages[1],0,0,hit.width,hit.height);
  backpackSleep={art:texture(backpackImages[0],true),hit:hitContext.getImageData(0,0,hit.width,hit.height).data};
  uniforms = Object.fromEntries([...samplers,'frontEyes','sideEyes','frontShift','oldFrontShift',
    'tail','tailFront','tailSide','tailOld','tailA','tailB','tailVisible','standingIdle','standingPhase',
    'snackAmount','snackLift','snackBitten','snackOpen','snackFood','snackChew',
    'shakeAmount','shakeFrame',
    'hugAmount','hugVisible','hugMotion','hugRoots','hugElbows','hugWrists',
    'workAmount','workStroke','workTravel','workBlink',
    'sleepAmount','sleepMotion','sleepTail','sleepLayout','canvasSpan','sleepShoulder','sleepHand','sleepEyeStages','cicadaAmount','cicadaMotion','cicadaProps',
    'peaceAmount','peaceMotion',
    'riceAmount','ricePose',
    'angle','clothes','showEyes','mapTiles',
    'seatAmount','seatPair','anchorsA','anchorsB','seatShift','seatNod','headTilt','napTilt','tailDock','faceAmount','faceRect']
    .map(name => [name,gl.getUniformLocation(program,name)]));
  samplers.forEach((name, unit) => gl.uniform1i(uniforms[name], unit));
  setHitMask(images.get(state.outfit).front, images.get(state.outfit).side);
  startTime = performance.now();
  swayStart = startTime;
  nextBlink = startTime + range(1500, 3100);
  resize();
  bindInput();
  window.addEventListener('resize', resize);
  petHost.settings(change);
  petHost.action(play);
  petHost.voicePreview?.(id=>petVoice.preview(id));
  schedule();
  let previousFrame = startTime;
  function frame(now) {
    if (pixelRatio !== devicePixelRatio) resize();
    const delta = Math.max(0,Math.min(now-previousFrame,75));
    previousFrame = now;
    tilt += (tiltTarget-tilt)*(1-Math.exp(-delta/92));
    if (Math.abs(tilt-tiltTarget) < .00025) tilt = tiltTarget;
    if (!qaPose && (dragPausedAt !== null || tilt !== 0 || current || wardrobe || now-lastPaint >= 29)) {
      if (dragPausedAt === null) lastScene = sceneAt(now,images);
      if(current&&!wardrobe&&dragPausedAt===null)petVoice.tick((now-current.start)/1000);
      draw(lastScene,dragPausedAt === null ? now : dragFrameTime,now);
      lastPaint = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if (!initial.qa) return;
  window.kannaCheck = {
    ready:true,
    status:() => ({outfit:state.outfit,
      action:current?.action.id,angle:lastScene.angle,dressing:Boolean(wardrobe),tilt,
      waking:current?.wakeAt !== undefined,
      sit:SLEEP_POSES[lastScene.id]?2*sideSleepMovement(lastScene.time,lastScene.releaseAt,SLEEP_POSES[lastScene.id]).active:
        seatMovement(lastScene.id,lastScene.time,lastScene.strength ?? 1)?.progress ?? 0}),
    seek(seconds) {
      if (current) current.start = performance.now()-seconds*1000;
    },
    clickPoint() {
      const bounds = pet.getBoundingClientRect();
      if(SLEEP_POSES[lastScene.id]){
        const config=SLEEP_POSES[lastScene.id];
        const x=config.anchor[0]+config.scale*(config.click[0]-config.anchor[0]);
        const y=config.anchor[1]+config.scale*(config.click[1]-config.anchor[1]);
        return {x:bounds.left+bounds.width*x/(width*CANVAS_SPAN),y:bounds.top+bounds.height*y/height};
      }
      return {x:bounds.left+bounds.width*.53/CANVAS_SPAN,y:bounds.top+bounds.height*.55};
    },
    pose(id, t, angle = id === 'butterfly' || id === 'kneel' ? 1 : 0, turnBlink = 0) {
      qaPose = true;
      clearTimeout(nextTimer);
      current = null;
      draw({id,time:t,angle,turnBlink}, startTime);
    },
    sweep(phase,angle=0,tail=true) {
      qaPose = true;
      current = null;
      clearTimeout(nextTimer);
      draw({...resting,angle},startTime,swayStart+phase/(Math.PI*2)*tailPeriod*1000);
      if (!tail) {
        gl.uniform1f(uniforms.tailVisible,0);
        gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
      }
    },
    resumeFrames() { qaPose = false; current = null; queued = undefined; },
    freezeDrag(direction = 0) {freezeDrag();tiltTarget=direction*.105;},
    thawDrag,
    geometry() {
      const area = pet.getBoundingClientRect();
      const footprint = shadow.getBoundingClientRect();
      return {css:[area.width,area.height],pixels:[pet.width,pet.height],mipmaps,span:CANVAS_SPAN,
        dpr:devicePixelRatio,shadow:[footprint.width,footprint.height]};
    },
    testRandom() {
      qaPose = false;
      current = null;
      change({...state, interval:[.05,.05]});
    },
    stopRandom() {
      qaPose = false;
      current = null;
      queued = undefined;
      change({...state, interval:null});
    },
    testLocked() {
      const outfit=wardrobe?.target.outfit ?? state.outfit;
      for (const action of ACTIONS.filter(action=>!canPlay(action,outfit))) play(action.id);
      return current === null && !queued;
    },
    verify() {
      const bag = [];
      const picks = [];
      const classicCount=ACTIONS.filter(action=>canPlay(action,'classic')).length;
      for (let i=0;i<classicCount*3;i++) picks.push(nextAction(bag,'classic',picks.at(-1),()=>.37));
      const complete = [0,1,2].every(i=>new Set(picks.slice(i*classicCount,(i+1)*classicCount)).size===classicCount);
      const greenBag=[], greenPicks=[];
      const greenCount=ACTIONS.filter(action=>canPlay(action,'green')).length;
      for (let i=0;i<greenCount*2;i++) greenPicks.push(nextAction(greenBag,'green',greenPicks.at(-1),()=>.37));
      const summerOnly=['watermelon','headshake'].every(id=>greenPicks.includes(id) && !picks.includes(id)) &&
        [0,1].every(i=>new Set(greenPicks.slice(i*greenCount,(i+1)*greenCount)).size===greenCount);
      const snackTimeline=watermelonMovement(0).active===0 &&
        watermelonMovement(2.4).lift===70 && watermelonMovement(4).bitten===1 &&
        watermelonMovement(7.19).active===0;
      const rest = [.1,.65,1.64,8.7,11.1,12.39].map(t=>seatMovement('rest',t,1).progress);
      const kneel = [.1,.65,1.58,8.9,10.1,11.29].map(t=>seatMovement('kneel',t,1).progress);
      const chargeCycle = chargingDock(1.65) === 0 && chargingDock(4) === 1 &&
        chargingDock(10.9) === 0 && seatMovement('rest',5,1).napTilt < -.09;
      const duration = ACTIONS.filter(action=>seatTiming[action.id]).every(action=>{
        const playback = {action,turns:action.id==='kneel'};
        const held = poseScene(playback,120);
        return action.seconds===180 && held.time===seatTiming[action.id].hold &&
          seatMovement(held.id,held.time,1).progress===2 &&
          poseScene(playback,179.9) && !poseScene(playback,180);
      });
      const valid = list => list[0] === 0 && list[1] > 0 && list[1] < 1 &&
        list[2] === 2 && list[3] === 2 && list[4] > 0 && list[4] < 2 && list[5] === 0;
      return {ok:loaded.length === 5 && complete && picks.every((id,i)=>!i || id!==picks[i-1]) &&
        valid(rest) && valid(kneel) && chargeCycle && duration && summerOnly && snackTimeline &&
        loaded.flatMap(([,image]) => [image.side,image.front])
          .every(image => image.naturalWidth === width*2 && image.naturalHeight === height),
        outfits:loaded.length,rotation:picks,greenRotation:greenPicks,summerOnly,snackTimeline,
        rest,kneel,chargeCycle,duration,moderateRange:[16,32]};
    },
  };
}

start().catch(error => { console.error(error); });


