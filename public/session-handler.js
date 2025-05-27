import { db, auth } from "./firebase-setup.js";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  deleteDoc,
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let sortField = "date";
let sortDirection = "desc";
let sessions = [];

const zoneMap = {
  "3pt": [
    "Left Corner",
    "Left Wing 3pt",
    "Top of Key 3pt",
    "Right Wing 3pt",
    "Right Corner",
  ],
  midrange: [
    "Left Baseline",
    "Left Wing",
    "Free Throw",
    "Right Wing",
    "Right Baseline",
  ],
};

document.addEventListener("DOMContentLoaded", () => {
  onAuthStateChanged(auth, (user) => {
    if (!user) return;
    const uid = user.uid;

    document.getElementById("logForm").addEventListener("submit", (e) => handleFormSubmit(e, uid));
    document.getElementById("editForm").addEventListener("submit", (e) => handleEditSubmit(e, uid));
    document.getElementById("cancelEdit").addEventListener("click", () => {
      document.getElementById("editModal").classList.add("hidden");
      document.getElementById("editForm").reset();
    });

    document.querySelectorAll("th[data-sort]").forEach((th) => {
      th.addEventListener("click", () => {
        const key = th.getAttribute("data-sort");
        if (sortField === key) {
          sortDirection = sortDirection === "asc" ? "desc" : "asc";
        } else {
          sortField = key;
          sortDirection = "asc";
        }
        loadSessionLog(uid);
        updateSortIndicators();
      });
    });

    loadSessionLog(uid);
  });

  document.getElementById("exportCsvBtn").addEventListener("click", () => {
  if (!sessions || sessions.length === 0) {
    alert("No sessions to export.");
    return;
  }

  const headers = ["Date", "Training Type", "Zone Type", "Rounds", "Accuracy", "Notes"];
  const rows = sessions.map(s => [
    s.date,
    s.trainingType || "",
    s.zoneType || "",
    s.rounds?.length || 0,
    s.accuracy + "%",
    `"${(s.notes || "").replace(/"/g, '""')}"`
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `training_sessions_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
});

});

function updateSortIndicators() {
  document.querySelectorAll("th[data-sort]").forEach((th) => {
    const key = th.getAttribute("data-sort");
    const span = th.querySelector(".sort-indicator");
    if (!span) return;
    span.textContent = (key === sortField) ? (sortDirection === "asc" ? "↑" : "↓") : "";
  });
}

async function handleFormSubmit(e, uid) {
  e.preventDefault();
  const form = e.target;

  // Get form fields
  const { date, trainingType, zoneType, notes } = Object.fromEntries(new FormData(form));

  // Validate required fields
  if (!date || !trainingType || !zoneType) {
    alert("Please fill in date, training type, and zone type.");
    return;
  }

  const roundCount = parseInt(document.getElementById("roundCount")?.value || 1);
  const zoneNames = zoneMap[zoneType] || [];
  const rounds = buildRounds("round", roundCount, zoneNames);
  const { totalMade, totalAttempted } = computeTotals(rounds);
  const accuracy = totalAttempted ? ((totalMade / totalAttempted) * 100).toFixed(1) : 0;

  try {
    await addDoc(collection(db, "sessions"), {
      userId: uid,
      date,
      trainingType,
      zoneType,
      rounds,
      accuracy: Number(accuracy),
      notes: notes || "",
      timestamp: new Date()
    });

    alert("Session saved!");
    form.reset();

    // Optionally restore today's date
    document.getElementById("date").valueAsDate = new Date();

    loadSessionLog(uid);
  } catch (error) {
    alert("Failed to save session: " + error.message);
    console.error("Firestore error:", error);
  }
}


async function handleEditSubmit(e, uid) {
  e.preventDefault();
  const sessionId = document.getElementById("editSessionId").value;
  const date = document.getElementById("editDate").value;
  const trainingType = document.getElementById("editTrainingType").value;
  const zoneType = document.getElementById("editZoneType").value;
  const notes = document.getElementById("editNotes").value;
  const roundCount = parseInt(document.getElementById("editRoundCount")?.value || 1);
  const zoneNames = zoneMap[zoneType] || [];
  const rounds = buildRounds("edit_round", roundCount, zoneNames);
  const { totalMade, totalAttempted } = computeTotals(rounds);
  const accuracy = totalAttempted ? ((totalMade / totalAttempted) * 100).toFixed(1) : 0;

  try {
    await setDoc(doc(db, "sessions", sessionId), {
      userId: uid, date, trainingType, zoneType, rounds, accuracy: Number(accuracy), notes, timestamp: new Date()
    });
    alert("Session updated!");
    document.getElementById("editModal").classList.add("hidden");
    e.target.reset();
    loadSessionLog(uid);
  } catch (error) {
    alert("Failed to update session: " + error.message);
    console.error("Firestore error:", error);
  }
}

function buildRounds(prefix, count, zones) {
  const rounds = [];
  for (let r = 1; r <= count; r++) {
    const roundZones = {};
    zones.forEach((zone) => {
      const attempted = parseInt(document.querySelector(`[name="${prefix}_${r}_attempted_${zone}"]`)?.value || 0);
      const made = parseInt(document.querySelector(`[name="${prefix}_${r}_made_${zone}"]`)?.value || 0);
      roundZones[zone] = { attempted, made };
    });
    rounds.push(roundZones);
  }
  return rounds;
}

function computeTotals(rounds) {
  let totalMade = 0, totalAttempted = 0;
  rounds.forEach((round) => {
    Object.values(round).forEach(({ attempted, made }) => {
      totalAttempted += attempted;
      totalMade += made;
    });
  });
  return { totalMade, totalAttempted };
}

async function loadSessionLog(uid) {
  const q = query(collection(db, "sessions"), where("userId", "==", uid));
  const snapshot = await getDocs(q);
  sessions = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));

  if (sortField) {
    sessions.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === "string") valA = valA.toLowerCase();
      if (typeof valB === "string") valB = valB.toLowerCase();
      valA = valA ?? "";
      valB = valB ?? "";
      return valA < valB ? (sortDirection === "asc" ? -1 : 1) : valA > valB ? (sortDirection === "asc" ? 1 : -1) : 0;
    });
  }

  const tbody = document.getElementById("sessionTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  sessions.forEach((session) => {
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

  document.querySelectorAll('button[data-action="delete"]').forEach((btn) => {
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

  document.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-id");
      const session = sessions.find((s) => s.id === id);
      if (!session) return;

      document.getElementById("editSessionId").value = session.id;
      document.getElementById("editDate").value = session.date;
      document.getElementById("editTrainingType").value = session.trainingType;
      document.getElementById("editZoneType").value = session.zoneType;
      document.getElementById("editZoneType").dispatchEvent(new Event("change"));
      document.getElementById("editRoundCount").value = session.rounds?.length || 1;
      document.getElementById("editNotes").value = session.notes || "";

      const zoneNames = zoneMap[session.zoneType] || [];
      session.rounds?.forEach((round, i) => {
        zoneNames.forEach((zone) => {
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