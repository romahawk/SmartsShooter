// ui-render.js
document.addEventListener("DOMContentLoaded", () => {
  const stage = new Konva.Stage({
    container: 'zoneChart',
    width: 600,
    height: 538
  });

  const layer = new Konva.Layer();
  stage.add(layer);

  const imageObj = new Image();
  imageObj.src = './assets/court.png';

  imageObj.onload = function () {
    const court = new Konva.Image({
      x: 0,
      y: 0,
      image: imageObj,
      width: stage.width(),
      height: stage.height()
    });

    layer.add(court);

    const zoneSize = { w: 50, h: 50 };

    const zones = [
      // 3pt Zones
      { id: 'Left Corner', x: 0, y: 430, ...zoneSize, type: '3pt' },
      { id: 'Left Wing 3pt', x: 90, y: 210, ...zoneSize, type: '3pt' },
      { id: 'Top of Key 3pt', x: 270, y: 150, ...zoneSize, type: '3pt' },
      { id: 'Right Wing 3pt', x: 460, y: 210, ...zoneSize, type: '3pt' },
      { id: 'Right Corner', x: 550, y: 430, ...zoneSize, type: '3pt' },

      // Midrange Zones
      { id: 'Left Baseline', x: 90, y: 430, ...zoneSize, type: 'midrange' },
      { id: 'Left Wing', x: 160, y: 280, ...zoneSize, type: 'midrange' },
      { id: 'Free Throw', x: 270, y: 250, ...zoneSize, type: 'midrange' },
      { id: 'Right Wing', x: 380, y: 280, ...zoneSize, type: 'midrange' },
      { id: 'Right Baseline', x: 470, y: 430, ...zoneSize, type: 'midrange' },
    ];

    zones.forEach(zone => {
      const rect = new Konva.Rect({
        x: zone.x,
        y: zone.y,
        width: zone.w,
        height: zone.h,
        fill: 'rgba(0, 128, 0, 0.3)',
        stroke: '#fff',
        strokeWidth: 1,
        cornerRadius: 4
      });

      const label = new Konva.Text({
        x: zone.x,
        y: zone.y + zone.h / 2 - 10,
        width: zone.w,
        align: 'center',
        text: zone.id,
        fontSize: 10,
        fill: '#fff'
      });

      rect.on('mouseover', () => {
        document.body.style.cursor = 'pointer';
        rect.opacity(0.6);
        layer.draw();
      });

      rect.on('mouseout', () => {
        document.body.style.cursor = 'default';
        rect.opacity(0.3);
        layer.draw();
      });

      layer.add(rect);
      layer.add(label);
    });

    layer.draw();
  };
});
