    function makeBlink(file, rect, shapes) {
      const image = new Image();
      image.src = 'assets/' + file;
      const [left, top, width, height] = rect;
      const mask = document.createElement('canvas');
      const canvas = document.createElement('canvas');
      canvas.width = mask.width = width;
      canvas.height = mask.height = height;
      const maskBrush = mask.getContext('2d');
      maskBrush.translate(-left, -top);
      maskBrush.filter = 'blur(3px)';
      for (const eye of shapes) maskBrush.fill(new Path2D(eye.mask));
      const brush = canvas.getContext('2d');

      function paint(amount) {
        brush.clearRect(0, 0, width, height);
        brush.save();
        brush.translate(-left, -top);
        const closedBlend = ease(.79, .99, amount);
        if (closedBlend < 1) {
          const startBlend = ease(0, .17, amount);
          for (const eye of shapes) {
            const [x0,y0,x1,y1,x2,y2,x3,y3] =
              eye.open.map((coordinate, index) => mix(coordinate, eye.closed[index], amount));
            brush.save();
            const aboveLid = new Path2D();
            aboveLid.moveTo(eye.edge, top-4);
            aboveLid.lineTo(eye.edge, y3);
            aboveLid.lineTo(x3, y3);
            aboveLid.bezierCurveTo(x2,y2,x1,y1,x0,y0);
            aboveLid.lineTo(x0 - 24, y0);
            aboveLid.lineTo(x0 - 24, top-4);
            aboveLid.closePath();
            brush.clip(aboveLid);
            brush.globalAlpha = startBlend;
            brush.drawImage(image, left, top);
            brush.restore();

            const lash = mix(10, 6, amount);
            brush.globalAlpha = startBlend * (1 - closedBlend);
            brush.fillStyle = '#2b1a18';
            brush.beginPath();
            brush.moveTo(x0,y0);
            brush.bezierCurveTo(x1,y1-lash*.6,x2,y2-lash*.6,x3,y3);
            brush.bezierCurveTo(x2,y2+lash*.65,x1,y1+lash*.65,x0,y0);
            brush.fill();
          }
        }
        if (closedBlend > 0) {
          brush.globalAlpha = closedBlend;
          brush.drawImage(image, left, top);
        }
        brush.restore();
        brush.globalCompositeOperation = 'destination-in';
        brush.drawImage(mask, 0, 0);
        brush.globalCompositeOperation = 'source-over';
      }

      return {canvas, ready:image.decode(), paint};
    }

    const sideBlink = makeBlink('closed.png', [428, 323, 308, 147], [
      {
        mask: 'M 430 390 C 443 376 511 347 550 348 C 565 350 572 372 572 407 C 571 437 554 460 519 463 C 485 463 454 449 439 420 Z',
        open: [435, 398, 467, 373, 525, 360, 564, 365],
        closed: [451, 439, 483, 453, 525, 443, 561, 422],
        edge: 568,
      },
      {
        mask: 'M 632 354 C 640 335 689 322 718 324 C 733 324 735 344 730 371 C 724 403 706 433 677 436 C 649 434 635 418 633 389 Z',
        open: [634, 366, 655, 343, 697, 331, 729, 340],
        closed: [641, 417, 666, 430, 698, 423, 723, 400],
        edge: 733,
      },
    ]);
    const frontBlink = makeBlink('closed-front.png', [343, 333, 340, 125], [
      {
        mask: 'M 346 370 C 370 347 438 346 472 354 C 488 367 484 409 467 433 C 449 454 406 455 383 438 C 365 424 351 395 346 370 Z',
        open: [352, 376, 386, 351, 445, 348, 476, 368],
        closed: [363, 416, 397, 435, 448, 435, 474, 416],
        edge: 484,
      },
      {
        mask: 'M 547 360 C 573 343 636 345 674 365 C 675 395 662 426 639 442 C 614 458 576 452 557 432 C 542 411 537 379 547 360 Z',
        open: [550, 371, 582, 347, 639, 351, 674, 378],
        closed: [551, 416, 578, 436, 628, 435, 661, 416],
        edge: 679,
      },
    ]);
