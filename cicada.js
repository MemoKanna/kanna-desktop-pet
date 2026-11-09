function cicadaMovement(t){
 let a=0;
 for(const [start,index] of [[1.64,1],[1.89,2],[2.02,3],[2.22,4],[2.38,5],[4.10,6],[4.40,0]]){
  if(t<start)break;a=index;
 }
 return {active:gesture(t,.16,.65,5.30,5.95),a,b:a,blend:0,pair:0,
  props:gesture(t,.20,.65,4.70,5.16),insect:1-ease(2.13,2.22,t)};
}
