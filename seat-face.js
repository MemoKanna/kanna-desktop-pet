const restingEyes = makeBlink('rest-eyes-closed.png', [348,784,312,73], [
  {
    mask:'M 357 798 Q 411 787 462 798 Q 479 816 455 840 Q 403 855 372 837 Z',
    open:[362,807,391,793,438,791,465,803],
    closed:[368,825,391,833,437,832,463,820],
    edge:473,
  },
  {
    mask:'M 540 800 Q 586 787 645 800 Q 655 822 631 842 Q 584 852 544 833 Z',
    open:[542,804,565,792,616,794,645,809],
    closed:[545,821,569,832,612,833,641,825],
    edge:649,
  },
]);
const kneelEye = makeBlink('kneel-eye-closed.png', [588,784,101,104], [
  {
    mask:'M 596 827 C 613 809 653 794 674 798 C 684 807 690 849 681 866 Q 663 888 641 878 C 615 868 605 850 596 827 Z',
    open:[600,835,621,816,652,807,675,805],
    closed:[603,864,624,874,659,870,682,847],
    edge:685,
  },
]);

function makeSeatFace(id, rect, lids, openFile, mouth) {
  const canvas = document.createElement('canvas');
  const [left,top,width,height] = rect;
  canvas.width = width;
  canvas.height = height;
  const brush = canvas.getContext('2d');
  const eyes = openFile ? new Image() : null;
  let eyeMask;
  if (eyes) {
    eyes.src = 'assets/' + openFile;
    eyeMask = document.createElement('canvas');
    eyeMask.width = lids.canvas.width;
    eyeMask.height = lids.canvas.height;
    const mask = eyeMask.getContext('2d');
    mask.filter = 'blur(3px)';
    mask.beginPath();
    mask.ellipse(68,36,62,30,0,0,Math.PI*2);
    mask.ellipse(242,36,62,30,0,0,Math.PI*2);
    mask.fill();
  }
  const openLayer = eyes ? document.createElement('canvas') : null;
  if (openLayer) {
    openLayer.width = lids.canvas.width;
    openLayer.height = lids.canvas.height;
  }
  const lidOffset = id === 'rest' ? [348-left,784-top] : [588-left,784-top];

  function paint(open, smile) {
    brush.clearRect(0,0,width,height);
    if (eyes && open > 0) {
      const painter = openLayer.getContext('2d');
      painter.clearRect(0,0,openLayer.width,openLayer.height);
      painter.drawImage(eyes,0,0);
      if (open < 1) {
        lids.paint(1-open);
        painter.drawImage(lids.canvas,0,0);
      }
      painter.globalCompositeOperation = 'destination-in';
      painter.drawImage(eyeMask,0,0);
      painter.globalCompositeOperation = 'source-over';
      brush.globalAlpha = ease(0,.2,open);
      brush.drawImage(openLayer,...lidOffset);
      brush.globalAlpha = 1;
    } else if (!eyes && open < 1) {
      lids.paint(1-open);
      brush.drawImage(lids.canvas,...lidOffset);
    }
    if (smile > 0) {
      const [x,y,skin,tilt] = mouth;
      brush.save();
      brush.translate(x-left,y-top);
      brush.rotate(tilt);
      brush.globalAlpha = smile;
      brush.fillStyle = skin;
      brush.beginPath();
      brush.ellipse(0,0,10,7,0,0,Math.PI*2);
      brush.fill();
      brush.strokeStyle = '#4d2e2b';
      brush.lineWidth = 2.4;
      brush.lineCap = 'round';
      brush.beginPath();
      brush.moveTo(-7,0);
      brush.quadraticCurveTo(0,5,7,-1);
      brush.stroke();
      brush.restore();
    }
  }
  return {rect,canvas,paint,ready:Promise.all([lids.ready,eyes?.decode()])};
}

const SEAT_FACES = {
  rest:makeSeatFace('rest',[343,778,322,151],restingEyes,'rest-eyes-open.png',[503,912,'#fde7dc',0]),
  kneel:makeSeatFace('kneel',[584,780,113,184],kneelEye,null,[681,950,'#fde9e0',-.53]),
};

function chargingDock(t) {
  return gesture(t,1.83,2.60,10.21,10.83);
}

function seatMovement(id, time, strength) {
  if (!SEAT_RIGS[id]) return null;
  const rest = id === 'rest';
  const down = ease(.10,rest ? 1.64 : 1.58,time);
  const up = ease(rest ? 10.83 : 9.67, rest ? 12.34 : 11.24,time);
  const progress = 2 * down * (1-up) * strength;
  const settled = progress > 1.999;
  const open = rest
    ? Math.max(gesture(time,1.66,1.94,2.58,3.02) *
        (1-.76*gesture(time,2.02,2.10,2.13,2.27)), ease(9.61,10.07,time))
    : 1 - Math.max(gesture(time,2.14,2.23,2.26,2.40),gesture(time,4.33,4.41,4.44,4.58),
        gesture(time,7.67,7.77,7.81,7.97));
  const smile = rest ? gesture(time,9.80,10.08,10.44,10.73)
    : Math.max(gesture(time,2.55,2.85,3.92,4.28),gesture(time,7.94,8.24,8.85,9.37));
  const napTilt = rest ? -.10*gesture(time,2.42,3.34,9.51,10.39) : 0;
  return {progress,settled,open,smile,napTilt};
}
