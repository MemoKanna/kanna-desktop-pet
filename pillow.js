const PILLOW_RIG={roots:[310,741,630,739],elbows:[321,792,620,799],wrists:[441,815,450,866]};
function pillowMovement(t){
  const pose=gesture(t,.08,1.08,11.45,12.64);
  const squeeze=gesture(t,3.0,3.5,3.85,4.4)+.75*gesture(t,7.2,7.75,8.15,8.8);
  return {active:gesture(t,0,.30,12.50,12.8),pose,
    visible:gesture(t,.08,.52,11.95,12.63),
    lift:18*(1-pose)-1.4*squeeze,squeeze,roll:.006*squeeze};
}
