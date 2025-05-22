// session-handler.js
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

let sortField = "date";
let sortDirection = "desc";
let sessions = [];

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    document.getElementById("logForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const sessionId = document.getElementById("sessionId").value;
      const date = document.getElementById("date").value;
      const trainingType = document.getElementById("trainingType").value;
      const notes = document.getElementById("notes").value;

      const zoneNames = ["Left Corner", "Left Wing", "Top of Key", "Right Wing", "Right Corner"];
      const zones = {};

      zoneNames.forEach(zone => {
        const attemptedInput = document.querySelector(`[name="attempted_${zone}"]`);
        const madeInput = document.querySelector(`[name="made_${zone}"]`);
        const attempted = parseInt(attemptedInput?.value) || 0;
        const made = parseInt(madeInput?.value) || 0;
        if (attempted > 0 || made > 0) {
          zones[zone] = { attempted, made };
        }
      });

      const accuracy = Object.values(zones).reduce((sum, zone) => sum + (zone.attempted > 0 ? zone.made / zone.attempted : 0), 0);
      const avgAccuracy = Object.keys(zones).length > 0 ? (accuracy / Object.keys(zones).length * 100).toFixed(1) : 0;

      try {
        await addDoc(collection(db, "sessions"), {
          userId: uid,
          date,
          trainingType,
          zones,
          accuracy: Number(avgAccuracy),
          notes,
          timestamp: new Date()
        });
        alert("Session saved!");
        e.target.reset();
        loadSessionLog(uid);
      } catch (error) {
        alert("Failed to save session: " + error.message);
        console.error("Firestore error:", error);
      }
    });

    document.getElementById("editForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const sessionId = document.getElementById("editSessionId").value;
      const date = document.getElementById("editDate").value;
      const trainingType = document.getElementById("editTrainingType").value;
      const notes = document.getElementById("editNotes").value;

      const zoneNames = ["Left Corner", "Left Wing", "Top of Key", "Right Wing", "Right Corner"];
      const zones = {};

      zoneNames.forEach(zone => {
        const attemptedInput = document.querySelector(`[name="edit_attempted_${zone}"]`);
        const madeInput = document.querySelector(`[name="edit_made_${zone}"]`);
        const attempted = parseInt(attemptedInput?.value) || 0;
        const made = parseInt(madeInput?.value) || 0;
        if (attempted > 0 || made > 0) {
          zones[zone] = { attempted, made };
        }
      });

      const accuracy = Object.values(zones).reduce((sum, zone) => sum + (zone.attempted > 0 ? zone.made / zone.attempted : 0), 0);
      const avgAccuracy = Object.keys(zones).length > 0 ? (accuracy / Object.keys(zones).length * 100).toFixed(1) : 0;

      try {
        await setDoc(doc(db, "sessions", sessionId), {
          userId: uid,
          date,
          trainingType,
          zones,
          accuracy: Number(avgAccuracy),
          notes,
          timestamp: new Date()
        });
        alert("Session updated!");
        document.getElementById("editModal").classList.add("hidden");
        e.target.reset();
        loadSessionLog(uid);
      } catch (error) {
        alert("Failed to update session: " + error.message);
        console.error("Firestore error:", error);
      }
    });

    document.getElementById("cancelEdit").addEventListener("click", () => {
      document.getElementById("editModal").classList.add("hidden");
      document.getElementById("editForm").reset();
    });

    document.querySelectorAll("th[data-sort]").forEach(header => {
      header.addEventListener("click", () => {
        const field = header.getAttribute("data-sort");
        if (sortField === field) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortField = field;
          sortDirection = "asc";
        }
        loadSessionLog(uid);
      });
    });

    loadSessionLog(uid);
  });
});

async function loadSessionLog(uid) {
  const q = query(collection(db, "sessions"), where("userId", "==", uid));
  const snapshot = await getDocs(q);

  sessions = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));

  sessions.sort((a, b) => {
    let aVal = a[sortField] ?? "";
    let bVal = b[sortField] ?? "";

    if (sortField === "accuracy") {
      return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === "string") {
      return sortDirection === "asc"
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    return 0;
  });

  const tbody = document.getElementById("sessionTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  sessions.forEach(session => {
    const zoneStats = Object.entries(session.zones || {})
      .map(([zone, { attempted, made }]) => `${zone}: ${made}/${attempted}`)
      .join("<br>");

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-2 whitespace-nowrap">${session.date}</td>
      <td class="px-4 py-2 whitespace-nowrap">${session.trainingType || "—"}</td>
      <td class="px-4 py-2 text-xs">${zoneStats}</td>
      <td class="px-4 py-2 text-center">${session.accuracy}%</td>
      <td class="px-4 py-2 text-xs">${session.notes || ""}</td>
      <td class="px-4 py-2 text-center">
        <button class="text-blue-600 hover:underline" data-id="${session.id}" data-action="edit">Edit</button> |
        <button class="text-red-600 hover:underline" data-id="${session.id}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  document.querySelectorAll('button[data-action="delete"]').forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      if (confirm("Are you sure you want to delete this session?")) {
        try {
          await deleteDoc(doc(db, "sessions", id));
          loadSessionLog(auth.currentUser.uid);
        } catch (error) {
          console.error("Error deleting session:", error);
          alert("Failed to delete session.");
        }
      }
    });
  });

  document.querySelectorAll('button[data-action="edit"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const session = sessions.find(s => s.id === id);
      if (!session) {
        console.warn("Session not found for ID:", id);
        return;
      }

      document.getElementById("editSessionId").value = session.id;
      document.getElementById("editDate").value = session.date;
      document.getElementById("editTrainingType").value = session.trainingType;
      document.getElementById("editNotes").value = session.notes || "";

      Object.entries(session.zones || {}).forEach(([zone, data]) => {
        const attemptedInput = document.querySelector(`[name="edit_attempted_${zone}"]`);
        const madeInput = document.querySelector(`[name="edit_made_${zone}"]`);
        if (attemptedInput) attemptedInput.value = data.attempted;
        if (madeInput) madeInput.value = data.made;
      });

      document.getElementById("editModal").classList.remove("hidden");
    });
  });
}
