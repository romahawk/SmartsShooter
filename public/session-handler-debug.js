// session-handler-debug.js
import { db, auth } from './firebase-setup.js';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const zoneMap = {
  "3pt": ["Left Corner", "Left Wing 3pt", "Top of Key 3pt", "Right Wing 3pt", "Right Corner"],
  "midrange": ["Left Baseline", "Left Wing", "Free Throw", "Right Wing", "Right Baseline"]
};

let sessions = [];

function log(msg, data) {
  console.log(`DEBUG: ${msg}`, data || '');
}

document.addEventListener("DOMContentLoaded", () => {
  log("DOM loaded");

  onAuthStateChanged(auth, (user) => {
    if (!user) {
      console.warn("Not logged in.");
      return;
    }
    const uid = user.uid;
    log("User authenticated", uid);

    const form = document.getElementById("logForm");
    if (!form) {
      console.error("#logForm not found");
      return;
    }

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      log("Submit clicked");

      const date = document.getElementById("date")?.value;
      const trainingType = document.getElementById("trainingType")?.value;
      const zoneType = document.getElementById("zoneType")?.value;
      const notes = document.getElementById("notes")?.value;
      log("Form values", { date, trainingType, zoneType, notes });

      const zoneNames = zoneMap[zoneType] || [];
      log("Resolved zoneNames", zoneNames);

      const zones = {};
      zoneNames.forEach(zone => {
        const attempted = parseInt(document.querySelector(`[name="attempted_${zone}"]`)?.value || 0);
        const made = parseInt(document.querySelector(`[name="made_${zone}"]`)?.value || 0);
        if (attempted > 0 || made > 0) {
          zones[zone] = { attempted, made };
        }
      });
      log("Zones data", zones);

      const accuracy = Object.values(zones).reduce((sum, z) => sum + (z.attempted > 0 ? z.made / z.attempted : 0), 0);
      const avgAccuracy = Object.keys(zones).length > 0 ? (accuracy / Object.keys(zones).length * 100).toFixed(1) : 0;
      log("Calculated accuracy", avgAccuracy);

      try {
        await addDoc(collection(db, "sessions"), {
          userId: uid,
          date,
          trainingType,
          zoneType,
          zones,
          accuracy: Number(avgAccuracy),
          notes,
          timestamp: new Date()
        });
        alert("Session saved!");
        e.target.reset();
      } catch (error) {
        console.error("Firestore error:", error);
        alert("Failed to save session: " + error.message);
      }
    });
  });
});
