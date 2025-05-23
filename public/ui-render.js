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

function setupStage() {
  stage = new Konva.Stage({
    container: 'zoneChart',
    width: 600,
    height: 538
  });

  layer = new Konva.Layer();
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
  const zoneSize = { w: 50, h: 50 };
  zones = [
    { id: 'Left Corner', x: 0, y: 430, ...zoneSize, type: '3pt' },
    { id: 'Left Wing 3pt', x: 90, y: 210, ...zoneSize, type: '3pt' },
    { id: 'Top of Key 3pt', x: 270, y: 150, ...zoneSize, type: '3pt' },
    { id: 'Right Wing 3pt', x: 460, y: 210, ...zoneSize, type: '3pt' },
    { id: 'Right Corner', x: 550, y: 430, ...zoneSize, type: '3pt' },
    { id: 'Left Baseline', x: 90, y: 430, ...zoneSize, type: 'midrange' },
    { id: 'Left Wing', x: 160, y: 280, ...zoneSize, type: 'midrange' },
    { id: 'Free Throw', x: 270, y: 250, ...zoneSize, type: 'midrange' },
    { id: 'Right Wing', x: 380, y: 280, ...zoneSize, type: 'midrange' },
    { id: 'Right Baseline', x: 470, y: 430, ...zoneSize, type: 'midrange' }
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

  visibleZones.forEach(zone => {
    const { id, x, y, w, h } = zone;
    const { attempted = 0, made = 0 } = stats[id] || {};
    const accuracy = attempted > 0 ? made / attempted : 0;
    const fill = getZoneColor(accuracy);

    const rect = new Konva.Rect({
      x, y, width: w, height: h, fill,
      stroke: '#fff', strokeWidth: 1, cornerRadius: 4
    });

    const label = new Konva.Text({
      x, y: y + h / 2 - 10, width: w,
      align: 'center',
      text: `${Math.round(accuracy * 100)}%`,
      fontSize: 10, fill: '#fff'
    });

    rect.on('mouseover', () => {
      document.body.style.cursor = 'pointer';
      rect.opacity(0.6);
      layer.draw();
    });

    rect.on('mouseout', () => {
      document.body.style.cursor = 'default';
      rect.opacity(1);
      layer.draw();
    });

    layer.add(rect);
    layer.add(label);
  });

  layer.draw();
}

function getZoneColor(accuracy) {
  if (accuracy < 0.3) return 'rgba(255, 0, 0, 0.4)';
  if (accuracy < 0.5) return 'rgba(228, 224, 0, 0.76)';
  if (accuracy < 0.7) return 'rgba(141, 228, 0, 0.76)';
  return 'rgba(109, 252, 109, 0.66)';
}

function getZoneStatsFromSessions(sessions) {
  const totals = {};
  sessions.forEach(doc => {
    const zones = doc.zones || {};
    for (const [zoneId, { attempted, made }] of Object.entries(zones)) {
      if (!totals[zoneId]) totals[zoneId] = { attempted: 0, made: 0 };
      totals[zoneId].attempted += attempted;
      totals[zoneId].made += made;
    }
  });
  return totals;
}

// Initial render with all sessions after auth
onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const q = query(collection(db, "sessions"), where("userId", "==", user.uid));
  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  window.allSessions = sessions;
  renderZonesChart(sessions);
});
