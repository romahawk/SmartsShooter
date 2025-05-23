// progress-chart.js (refactored to support filters)
import { db, auth } from './firebase-setup.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let accuracyChart = null;

export function renderProgressChartFromSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(s => s.date);
  const data = sorted.map(s => s.accuracy);

  const canvas = document.getElementById("progressChart");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");

  // 🧼 Destroy existing chart instance before re-rendering
  if (accuracyChart) {
    accuracyChart.destroy();
  }

  accuracyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: "Shooting Accuracy (%)",
        data,
        borderColor: "green",
        backgroundColor: "rgba(0,128,0,0.2)",
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 10 }
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}


onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  const q = query(
    collection(db, "sessions"),
    where("userId", "==", user.uid),
    orderBy("date")
  );

  const snapshot = await getDocs(q);
  const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  window.allSessions = sessions;
  renderProgressChartFromSessions(sessions);
});
