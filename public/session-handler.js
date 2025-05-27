// session-handler.js (with full session loading)
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

const zoneMap = {
  "3pt": ["Left Corner", "Left Wing 3pt", "Top of Key 3pt", "Right Wing 3pt", "Right Corner"],
  "midrange": ["Left Baseline", "Left Wing", "Free Throw", "Right Wing", "Right Baseline"]
};

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    document.getElementById("logForm").addEventListener("submit", async (e) => {
      e.preventDefault();

      const date = document.getElementById("date").value;
      const trainingType = document.getElementById("trainingType").value;
      const zoneType = document.getElementById("zoneType").value;
      const notes = document.getElementById("notes").value;
      const roundCount = parseInt(document.getElementById("roundCount")?.value || 1);
      const zoneNames = zoneMap[zoneType] || [];

      const rounds = [];
      for (let r = 1; r <= roundCount; r++) {
        const roundZones = {};
        zoneNames.forEach(zone => {
          const attempted = parseInt(document.querySelector(`[name="round_${r}_attempted_${zone}"]`)?.value || 0);
          const made = parseInt(document.querySelector(`[name="round_${r}_made_${zone}"]`)?.value || 0);
          roundZones[zone] = { attempted, made };
        });
        rounds.push(roundZones);
      }

      let totalMade = 0, totalAttempted = 0;
      rounds.forEach(round => {
        Object.values(round).forEach(({ attempted, made }) => {
          totalAttempted += attempted;
          totalMade += made;
        });
      });
      const accuracy = totalAttempted > 0 ? ((totalMade / totalAttempted) * 100).toFixed(1) : 0;

      try {
        await addDoc(collection(db, "sessions"), {
          userId: uid,
          date,
          trainingType,
          zoneType,
          rounds,
          accuracy: Number(accuracy),
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
      const zoneType = document.getElementById("editZoneType").value;
      const notes = document.getElementById("editNotes").value;
      const roundCount = parseInt(document.getElementById("editRoundCount")?.value || 1);
      const zoneNames = zoneMap[zoneType] || [];

      const rounds = [];
      for (let r = 1; r <= roundCount; r++) {
        const roundZones = {};
        zoneNames.forEach(zone => {
          const attempted = parseInt(document.querySelector(`[name="edit_round_${r}_attempted_${zone}"]`)?.value || 0);
          const made = parseInt(document.querySelector(`[name="edit_round_${r}_made_${zone}"]`)?.value || 0);
          roundZones[zone] = { attempted, made };
        });
        rounds.push(roundZones);
      }

      let totalMade = 0, totalAttempted = 0;
      rounds.forEach(round => {
        Object.values(round).forEach(({ attempted, made }) => {
          totalAttempted += attempted;
          totalMade += made;
        });
      });
      const accuracy = totalAttempted > 0 ? ((totalMade / totalAttempted) * 100).toFixed(1) : 0;

      try {
        await setDoc(doc(db, "sessions", sessionId), {
          userId: uid,
          date,
          trainingType,
          zoneType,
          rounds,
          accuracy: Number(accuracy),
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

  // Apply sorting
  if (sortField) {
    sessions.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      // Normalize for strings
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();

      // Handle undefined/null
      valA = valA ?? '';
      valB = valB ?? '';

      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }

  const tbody = document.getElementById("sessionTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  sessions.forEach(session => {
    const zoneLabel = session.zoneType ? session.zoneType.charAt(0).toUpperCase() + session.zoneType.slice(1) : "—";
    const roundCount = session.rounds ? session.rounds.length : 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td class="px-4 py-2 whitespace-nowrap">${session.date}</td>
      <td class="px-4 py-2 whitespace-nowrap">${session.trainingType || "—"}</td>
      <td class="px-4 py-2 text-xs">${zoneLabel}</td>
      <td class="px-4 py-2 text-center">${roundCount}</td>
      <td class="px-4 py-2 text-center">${session.accuracy}%</td>
      <td class="px-4 py-2 text-xs">${session.notes || ""}</td>
      <td class="px-4 py-2 text-center">
        <button class="text-blue-600 hover:underline" data-id="${session.id}" data-action="edit">Edit</button> |
        <button class="text-red-600 hover:underline" data-id="${session.id}" data-action="delete">Delete</button>
      </td>
    `;
    tbody.appendChild(row);
  });

  // Rebind delete/edit listeners
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
      if (!session) return;

      // Fill modal with session data...
      document.getElementById("editSessionId").value = session.id;
      document.getElementById("editDate").value = session.date;
      document.getElementById("editTrainingType").value = session.trainingType;
      document.getElementById("editZoneType").value = session.zoneType;
      document.getElementById("editZoneType").dispatchEvent(new Event("change"));
      document.getElementById("editRoundCount").value = session.rounds?.length || 1;
      document.getElementById("editNotes").value = session.notes || "";

      const zoneNames = zoneMap[session.zoneType] || [];
      session.rounds?.forEach((round, i) => {
        zoneNames.forEach(zone => {
          const attemptedInput = document.querySelector(`[name="edit_round_${i + 1}_attempted_${zone}"]`);
          const madeInput = document.querySelector(`[name="edit_round_${i + 1}_made_${zone}"]`);
          if (attemptedInput) attemptedInput.value = round[zone]?.attempted || 0;
          if (madeInput) madeInput.value = round[zone]?.made || 0;
        });
      });

      document.getElementById("editModal").classList.remove("hidden");
    });
  });
}

