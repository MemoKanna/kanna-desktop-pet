// Author whole heads for each expression; never stretch the standing portrait.
function riceMovement(t) {
  let a=0,b=0,blend=0;
  const changes=[
    [1.00,1.19,0,1], [1.23,1.48,1,2],
    [1.54,1.68,2,3], [1.73,1.88,3,4], [1.99,2.18,4,5],
    [2.38,2.50,5,6], [2.56,2.69,6,7], [2.75,2.88,7,8],
    [3.04,3.15,8,9], [3.21,3.34,9,10],
  ];
  for(const [start,end,from,to] of changes){
    if(t<start)break;
    if(t>=end){a=to;b=to;blend=0;continue;}
    a=from;b=to;blend=ease(start,end,t);break;
  }
  return {active:gesture(t,.08,.58,6.72,7.38),a,b,blend};
}

function drawRicePuff(ctx,t){
  const age=t-4.55,visible=gesture(age,0,.12,.50,.90);
  if(!visible)return;
  ctx.save();ctx.globalAlpha=.86*visible;
  const x=540+115*age,y=570-38*age;
  for(const [dx,dy,r] of [[0,0,13],[16,-8,17],[32,-5,12]])
    ellipse(ctx,x+dx,y+dy,r,r*.75,'#fffdf3');
  ctx.restore();
}
