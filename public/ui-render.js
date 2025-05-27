// ui-render.js (filterable heatmap by selected sessions)
import { db, auth } from './firebase-setup.js';
import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let stage, layer, zones;
let tooltip, tooltipText;

function setupStage() {
  stage = new Konva.Stage({
    container: 'zoneChart',
    width: 600,
    height: 538
  });

  layer = new Konva.Layer();
  tooltip = new Konva.Label({
    opacity: 0,
    visible: false,
    listening: false
  });
  tooltip.add(new Konva.Tag({
    fill: 'black',
    pointerDirection: 'down',
    pointerWidth: 8,
    pointerHeight: 8,
    lineJoin: 'round',
    cornerRadius: 4
  }));
  tooltipText = new Konva.Text({
    text: '',
    fontFamily: 'Arial',
    fontSize: 12,
    padding: 6,
    fill: 'white'
  });
  tooltip.add(tooltipText);
  layer.add(tooltip);
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
    layer.draw();
  };
}

function initZones() {
  const zoneSize = { w: 44, h: 44 };
  zones = [
    // 3pt Zones
    { id: 'Left Corner',        x: -5,   y: 430, ...zoneSize, type: '3pt' },
    { id: 'Left Wing 3pt',      x: 90,  y: 220, ...zoneSize, type: '3pt' },
    { id: 'Top of Key 3pt',     x: 270, y: 150, ...zoneSize, type: '3pt' },  
    { id: 'Right Wing 3pt',     x: 460, y: 220, ...zoneSize, type: '3pt' },
    { id: 'Right Corner',       x: 560, y: 430, ...zoneSize, type: '3pt' },

    // Midrange Zones
    { id: 'Left Baseline',      x: 90,  y: 430, ...zoneSize, type: 'midrange' },  // Moved down slightly
    { id: 'Left Wing',          x: 150, y: 300, ...zoneSize, type: 'midrange' },  // Moved out left
    { id: 'Free Throw',         x: 270, y: 250, ...zoneSize, type: 'midrange' },
    { id: 'Right Wing',         x: 400, y: 300, ...zoneSize, type: 'midrange' },  // Moved out right
    { id: 'Right Baseline',     x: 470, y: 430, ...zoneSize, type: 'midrange' }   // Moved down slightly
  ];
  
}



export async function renderZonesChart(sessions) {
  if (!stage || !layer || !zones) {
    setupStage();
    initZones();
  } else {
    layer.destroyChildren();
    setupStage();
    initZones();
  }

  const stats = getZoneStatsFromSessions(sessions);
  const activeZoneTypes = new Set(sessions.map(s => s.zoneType));
  const visibleZones = zones.filter(z => activeZoneTypes.has(z.type));

  const mode = window.hotZoneMode || '%';

  visibleZones.forEach(zone => {
    const { id, x, y, w, h } = zone;
    const { attempted = 0, made = 0 } = stats[id] || {};
    const accuracy = attempted > 0 ? made / attempted : 0;
    const fill = getZoneColor(accuracy);

    const rect = new Konva.Rect({
      x, y, width: w, height: h, fill,
      stroke: '#fff', strokeWidth: 1, cornerRadius: 4
    });

    let labelText = '';
    if (mode === '%') labelText = `${Math.round(accuracy * 100)}%`;
    else if (mode === 'made') labelText = `${made} made`;
    else if (mode === 'attempted') labelText = `${attempted} att`;

    const label = new Konva.Text({
      x, y: y + h / 2 - 10, width: w,
      align: 'center',
      text: labelText,
      fontSize: 12,
      fontStyle: 'bold',
      fill: '#fff',
      shadowColor: '#000',
      shadowBlur: 1,
      shadowOffset: { x: 0.5, y: 0.5 },
      shadowOpacity: 0.8
    });

    rect.on('mouseover', () => {
      const percent = Math.round(accuracy * 100);
      const text = `${made}/${attempted} made (${percent}%)`;
      tooltipText.text(text);
      tooltip.position({ x: x + w / 2, y: y - 10 });
      tooltip.opacity(1);
      tooltip.show();
      layer.batchDraw();
      document.body.style.cursor = 'pointer';
      rect.opacity(0.6);
    });

    rect.on('mouseout', () => {
      tooltip.hide();
      tooltip.opacity(0);
      layer.batchDraw();
      document.body.style.cursor = 'default';
      rect.opacity(1);
    });

    layer.add(rect);
    layer.add(label);
  });

  layer.draw();
}

function getZoneColor(accuracy) {
  if (accuracy === 0) return 'rgba(239, 68, 68, 0.9)';      // 🔴 Tailwind red-500
  if (accuracy < 0.3) return 'rgba(244, 63, 94, 0.9)';       // 🌺 rose-500
  if (accuracy < 0.5) return 'rgba(251, 191, 36, 0.9)';      // 🟧 amber-400
  if (accuracy < 0.7) return 'rgba(163, 230, 53, 0.9)';      // 🟨 lime-400
  if (accuracy < 0.9) return 'rgba(34, 197, 94, 0.9)';       // 🟩 green-500
  return 'rgba(22, 163, 74, 0.95)';                          // ✅ green-600
}


function getZoneStatsFromSessions(sessions) {
  const totals = {};
  sessions.forEach(doc => {
    const rounds = doc.rounds || [];
    rounds.forEach(round => {
      for (const [zoneId, { attempted = 0, made = 0 }] of Object.entries(round)) {
        if (!totals[zoneId]) totals[zoneId] = { attempted: 0, made: 0 };
        totals[zoneId].attempted += attempted;
        totals[zoneId].made += made;
      }
    });
  });
  return totals;
}


onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const q = query(collection(db, "sessions"), where("userId", "==", user.uid));
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  window.allSessions = sessions;
  renderZonesChart(sessions);
});
