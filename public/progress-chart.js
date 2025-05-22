// progress-chart.js
import { db, auth } from './firebase-setup.js';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";


document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    const uid = user.uid;

    const q = query(
      collection(db, "sessions"),
      where("userId", "==", uid),
      orderBy("date")
    );

    const snapshot = await getDocs(q);
    const labels = [];
    const data = [];

    snapshot.forEach(doc => {
      const session = doc.data();
      labels.push(session.date);
      data.push(session.accuracy);
    });

    const ctx = document.getElementById("progressChart").getContext("2d");
    new Chart(ctx, {
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
  });
});