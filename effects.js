function alpha(ctx, value) {
  ctx.globalAlpha = Math.min(1, Math.max(0, value));
}

function ellipse(ctx, x, y, rx, ry, fill, stroke, angle = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 3; ctx.stroke(); }
}

function butterfly(ctx, t) {
  const x = mix(968, 623, ease(.18, 2.48, t)) + (1 - ease(2.05, 2.49, t)) * 18 * Math.sin(t * 8);
  const y = mix(525, 516, ease(.6, 2.48, t)) + (1 - ease(1.9, 2.49, t)) * 46 * Math.sin(t * 4.5);
  if (t < 2.5) {
    ctx.save();
    alpha(ctx, gesture(t, 0, .3, 2.44, 2.5));
    ctx.translate(x,y);
    ctx.rotate(-.32 + .25 * Math.sin(t * 6));
    ctx.scale(.32 + .68 * Math.abs(Math.sin(t * 22)), 1);
    for (const side of [-1, 1]) {
      ellipse(ctx, side * 13, -8, 16, 10, '#ffc08b', '#65394e', side * .68);
      ellipse(ctx, side * 11, 7, 10, 8, '#fa95a6', '#65394e', -side * .55);
      ellipse(ctx, side * 18, -13, 2.9, 2.9, '#fff1d9');
    }
    ellipse(ctx, 0, 0, 3.5, 12, '#574053');
    ctx.restore();
  }
  const chomp = gesture(t, 2.14, 2.36, 2.49, 2.59);
  if (chomp > 0) {
    ctx.save();
    alpha(ctx, chomp);
    ellipse(ctx, 623, 516, 11 + 6 * chomp, 10 + 9 * chomp, '#623540', '#41292e', .28);
    ellipse(ctx, 625, 524, 7 * chomp, 4 * chomp, '#ee8a94');
    ctx.restore();
  }
  const satisfied = gesture(t, 2.58, 2.74, 3.19, 3.65);
  if (satisfied > 0) {
    ctx.save();
    alpha(ctx, satisfied);
    star(ctx, 670, 478 - 12 * ease(2.58, 3.65, t), 15, '#f7bb69');
    star(ctx, 696, 454, 8, '#f7bb69');
    ctx.restore();
  }
}

function star(ctx, x, y, radius, color) {
  ctx.beginPath();
  for (let index = 0; index < 8; index++) {
    const angle = index * Math.PI / 4;
    const r = index % 2 === 0 ? radius : radius * .27;
    ctx.lineTo(x + r * Math.cos(angle), y + r * Math.sin(angle));
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function restingCharge(ctx,t,elapsed,dock) {
  const outlet = gesture(t,1.68,2.13,10.55,10.83);
  const connected = ease(.82,.99,dock);
  if (outlet > 0) {
    alpha(ctx,outlet);
    ctx.beginPath();
    ctx.roundRect(883,1471,76,44,11);
    ctx.fillStyle = '#ede5f3';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#584c69';
    ctx.stroke();
    ellipse(ctx,918,1485,12,8,'#c9bad8','#79678d');
    ellipse(ctx,943,1501,4,4,connected > .9 ? '#68b699' : '#a69ab3');
    alpha(ctx,outlet*connected);
    ctx.beginPath();
    ctx.moveTo(902,1438);
    ctx.bezierCurveTo(904,1462,927,1460,918,1483);
    ctx.lineCap = 'round';
    ctx.lineWidth = 11;
    ctx.strokeStyle = '#534264';
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#a992bd';
    ctx.stroke();
  }
  const burst = (elapsed-2.92)%4.6;
  const awake = ease(9.61,10.39,t);
  for (let i = 0; i < 2; i++) {
    const age = burst - i*.94;
    const show = gesture(age,0,.28,1.07,1.68)*(1-awake);
    if (!show) continue;
    alpha(ctx,show*.9);
    const radius = 13 + 10*ease(0,1.1,age) + (i%2)*8;
    const x = 175 - 40*age + 8*Math.sin(age*4+i);
    const y = 766 - 119*age;
    ellipse(ctx,x,y,radius,radius,'#e2e9ff85','#8b7fa9');
    ellipse(ctx,x-radius*.28,y-radius*.34,radius*.27,radius*.15,'#fffefa',null,-.61);
  }
}

function drawEffects(ctx,id,t,elapsed,settled,dock) {
  ctx.save();
  if (id === 'butterfly') butterfly(ctx,t);
  if (id === 'rest' && settled) restingCharge(ctx,t,elapsed,dock);
  ctx.restore();
}
