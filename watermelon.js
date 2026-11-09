function watermelonMovement(time) {
  const chew = gesture(time,3.35,3.65,5.50,5.90)*2.2*Math.sin((time-3.35)*9.5);
  const active = gesture(time,.12,.44,6.70,7.14);
  const lift = 70*gesture(time,1.55,2.35,2.60,3.35);
  const bitten = ease(2.60,2.92,time);
  const open = gesture(time,1.75,2.18,2.53,2.96);
  const food = gesture(time,.32,.58,6.18,6.55);
  return {chew,active,lift,bitten,open,food};
}
