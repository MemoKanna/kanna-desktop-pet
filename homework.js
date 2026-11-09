// Pause briefly between short writing strokes. Never scale the character or desk.
function homeworkMovement(t){
 const active=gesture(t,0,.65,35.25,36);
 const cycle=t%4.6;
 const writing=gesture(cycle,.3,.7,3.3,3.8);
 const blink=Math.max(...[4.25,10.3,16.4,23.1,30.4].map(start=>
  gesture(t,start,start+.09,start+.13,start+.26)));
 return {active,stroke:writing*(.024*Math.sin(t*8)+.008*Math.sin(t*14.2)),
  travel:writing*1.6*Math.sin(t*3.1),blink};
}
