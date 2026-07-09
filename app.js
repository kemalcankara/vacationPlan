const STORAGE_KEY = "londonPlannerSimple.v1";
const NAME_KEY = "londonPlannerName.v1";
const SEED_VERSION_KEY = "londonPlannerSeedVersion.v1";
const planId = window.LONDON_PLAN_ID || "london-trip";
const firebaseConfig = window.LONDON_PLANNER_FIREBASE;

const days = [
  { value: "common", date: "Ortak", weekday: "Güne bağlanmadı" },
  { value: "20", date: "20 July", weekday: "Pazartesi" },
  { value: "21", date: "21 July", weekday: "Salı" },
  { value: "22", date: "22 July", weekday: "Çarşamba" },
  { value: "23", date: "23 July", weekday: "Perşembe" },
  { value: "24", date: "24 July", weekday: "Cuma" },
  { value: "25", date: "25 July", weekday: "Cumartesi" },
  { value: "26", date: "26 July", weekday: "Pazar" },
];

const defaultStarterEvents = [
  {
    id: uid(),
    day: "common",
    time: "",
    title: "Sky Garden bak",
    area: "City of London",
    address: "https://skygarden.london",
    notes: "Ücretsiz rezervasyon slotları kontrol edilecek.",
    comments: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    updatedBy: "Sistem",
  },
  {
    id: uid(),
    day: "common",
    time: "",
    title: "British Museum",
    area: "Bloomsbury",
    address: "",
    notes: "Yağmurlu gün alternatifi olabilir.",
    comments: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    updatedBy: "Sistem",
  },
];

const externalStarterEvents = Array.isArray(window.LONDON_STARTER_EVENTS)
  ? window.LONDON_STARTER_EVENTS
  : null;
const starterEvents = (externalStarterEvents?.length ? externalStarterEvents : defaultStarterEvents).map(
  normalizeEvent,
);

let state = loadState();
let personName = localStorage.getItem(NAME_KEY) || "";
let firebaseApi = null;
let suppressSave = false;

const els = {
  board: document.querySelector("#dayBoard"),
  personName: document.querySelector("#personName"),
  saveNameBtn: document.querySelector("#saveNameBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  quickTitle: document.querySelector("#quickTitle"),
  quickDay: document.querySelector("#quickDay"),
  quickAddBtn: document.querySelector("#quickAddBtn"),
  eventDialog: document.querySelector("#eventDialog"),
  eventForm: document.querySelector("#eventForm"),
  formTitle: document.querySelector("#formTitle"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  deleteEventBtn: document.querySelector("#deleteEventBtn"),
  eventId: document.querySelector("#eventId"),
  eventTitle: document.querySelector("#eventTitle"),
  eventDay: document.querySelector("#eventDay"),
  eventTime: document.querySelector("#eventTime"),
  eventArea: document.querySelector("#eventArea"),
  eventAddress: document.querySelector("#eventAddress"),
  eventNotes: document.querySelector("#eventNotes"),
  eventAttachmentsBlock: document.querySelector("#eventAttachmentsBlock"),
  attachmentName: document.querySelector("#attachmentName"),
  attachmentUrl: document.querySelector("#attachmentUrl"),
  addAttachmentLinkBtn: document.querySelector("#addAttachmentLinkBtn"),
  eventAttachmentList: document.querySelector("#eventAttachmentList"),
  commentDialog: document.querySelector("#commentDialog"),
  commentForm: document.querySelector("#commentForm"),
  commentTitle: document.querySelector("#commentTitle"),
  commentMeta: document.querySelector("#commentMeta"),
  commentEventId: document.querySelector("#commentEventId"),
  commentList: document.querySelector("#commentList"),
  commentText: document.querySelector("#commentText"),
  closeCommentBtn: document.querySelector("#closeCommentBtn"),
  nameDialog: document.querySelector("#nameDialog"),
  nameForm: document.querySelector("#nameForm"),
  dialogName: document.querySelector("#dialogName"),
};

init();

async function init() {
  els.personName.value = personName;
  cleanupDemoEvents();
  bindShell();
  render();
  askNameIfNeeded();
  await initFirebase();
}

function bindShell() {
  els.saveNameBtn.addEventListener("click", () => saveName(els.personName.value));
  els.personName.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveName(els.personName.value);
  });

  els.nameForm.addEventListener("submit", () => saveName(els.dialogName.value));

  els.quickAddBtn.addEventListener("click", quickAdd);
  els.quickTitle.addEventListener("keydown", (event) => {
    if (event.key === "Enter") quickAdd();
  });

  els.closeDialogBtn.addEventListener("click", () => els.eventDialog.close());
  els.deleteEventBtn.addEventListener("click", deleteSelectedFromDialog);
  els.eventForm.addEventListener("submit", saveEventFromDialog);
  els.addAttachmentLinkBtn.addEventListener("click", () => {
    const id = els.eventId.value;
    if (id) addAttachmentLink(id);
  });
  els.closeCommentBtn.addEventListener("click", () => els.commentDialog.close());
  els.commentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addComment(els.commentEventId.value, els.commentText.value);
  });
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      events: [...starterEvents],
      selectedEventId: null,
      updatedAt: new Date().toISOString(),
    };
  }

  try {
    return mergeStarterEvents(normalizeState(JSON.parse(raw)));
  } catch {
    return {
      events: [...starterEvents],
      selectedEventId: null,
      updatedAt: new Date().toISOString(),
    };
  }
}

function mergeStarterEvents(nextState, { persistVersion = true } = {}) {
  if (!externalStarterEvents?.length) return nextState;

  const seedVersion = window.LONDON_STARTER_EVENTS_VERSION || "default";
  if (persistVersion) localStorage.setItem(SEED_VERSION_KEY, seedVersion);

  let changed = false;
  const mergedEvents = [...nextState.events];
  const existingIndexesById = new Map(mergedEvents.map((event, index) => [event.id, index]));
  const existingIndexesByKey = new Map(mergedEvents.map((event, index) => [eventKey(event), index]));

  starterEvents.forEach((starterEvent) => {
    const existingIndex = existingIndexesById.has(starterEvent.id)
      ? existingIndexesById.get(starterEvent.id)
      : existingIndexesByKey.get(eventKey(starterEvent));

    if (existingIndex === undefined) {
      mergedEvents.push(starterEvent);
      existingIndexesById.set(starterEvent.id, mergedEvents.length - 1);
      existingIndexesByKey.set(eventKey(starterEvent), mergedEvents.length - 1);
      changed = true;
      return;
    }

    const mergedEvent = mergeSeedEvent(mergedEvents[existingIndex], starterEvent);
    if (JSON.stringify(mergedEvent) !== JSON.stringify(mergedEvents[existingIndex])) {
      mergedEvents[existingIndex] = mergedEvent;
      changed = true;
    }
  });

  if (!changed) return nextState;

  return {
    ...nextState,
    events: mergedEvents,
    updatedAt: new Date().toISOString(),
  };
}

function mergeSeedEvent(existingEvent, starterEvent) {
  return {
    ...existingEvent,
    ...starterEvent,
    comments: existingEvent.comments,
    attachments: mergeAttachments(starterEvent.attachments, existingEvent.attachments).filter(
      (attachment) => !isSensitiveAttachment(attachment),
    ),
  };
}

function mergeAttachments(seedAttachments = [], existingAttachments = []) {
  const seen = new Set();
  return [...seedAttachments, ...existingAttachments].filter((attachment) => {
    const key = attachment.id || attachment.url || attachment.name;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isSensitiveAttachment(attachment) {
  const url = String(attachment.url || "");
  return /^data\/Screenshot%20/i.test(url) || /^data\/Screenshot /i.test(url);
}

function eventKey(event) {
  return `${event.day}::${event.title.trim().toLocaleLowerCase("tr-TR")}`;
}

function normalizeState(nextState) {
  const events = Array.isArray(nextState.events) ? nextState.events : [];
  return {
    events: events.map(normalizeEvent),
    selectedEventId: nextState.selectedEventId || null,
    updatedAt: nextState.updatedAt || new Date().toISOString(),
  };
}

function normalizeEvent(event) {
  const migratedDay = event.day || (event.date ? String(event.date).slice(-2) : "20");
  return {
    id: event.id || uid(),
    day: days.some((day) => day.value === migratedDay) ? migratedDay : "20",
    time: event.time || "",
    title: event.title || "Adsız plan",
    area: event.area || "",
    address: event.address || "",
    notes: event.notes || "",
    comments: Array.isArray(event.comments) ? event.comments : [],
    attachments: Array.isArray(event.attachments) ? event.attachments : [],
    updatedAt: event.updatedAt || new Date().toISOString(),
    updatedBy: event.updatedBy || "Bilinmiyor",
  };
}

function cleanupDemoEvents({ persistChanges = true } = {}) {
  let changed = false;
  state.events = state.events
    .filter((event) => {
      const keep = event.title !== "Otele yerleşme";
      if (!keep) changed = true;
      return keep;
    })
    .map((event) => {
      if (/sky garden|british museum/i.test(event.title) && event.day !== "common") {
        changed = true;
        return {
          ...event,
          day: "common",
          updatedAt: new Date().toISOString(),
          updatedBy: event.updatedBy || "Sistem",
        };
      }
      return event;
    });

  if (changed && persistChanges) persist();
  return changed;
}

function askNameIfNeeded() {
  if (!personName && typeof els.nameDialog.showModal === "function") {
    els.nameDialog.showModal();
    setTimeout(() => els.dialogName.focus(), 50);
  }
}

function saveName(value) {
  const clean = value.trim();
  if (!clean) return;
  personName = clean;
  localStorage.setItem(NAME_KEY, clean);
  els.personName.value = clean;
  if (els.nameDialog.open) els.nameDialog.close();
}

function quickAdd() {
  const title = els.quickTitle.value.trim();
  if (!title) return;

  const event = {
    id: uid(),
    day: els.quickDay.value,
    time: "",
    title,
    area: "",
    address: "",
    notes: "",
    comments: [],
    attachments: [],
    updatedAt: new Date().toISOString(),
    updatedBy: personName || "İsimsiz",
  };

  state.events = [...state.events, event];
  state.selectedEventId = event.id;
  els.quickTitle.value = "";
  render();
  persist();
}

function openNewEvent(day) {
  els.formTitle.textContent = `${dayLabel(day)} için plan`;
  els.eventForm.reset();
  els.eventId.value = "";
  els.eventDay.value = day;
  els.eventAttachmentsBlock.hidden = true;
  els.eventAttachmentList.innerHTML = "";
  els.attachmentName.value = "";
  els.attachmentUrl.value = "";
  els.deleteEventBtn.style.visibility = "hidden";
  els.eventDialog.showModal();
  setTimeout(() => els.eventTitle.focus(), 50);
}

function openEditEvent(id) {
  const event = getEvent(id);
  if (!event) return;

  state.selectedEventId = id;
  els.formTitle.textContent = "Planı düzenle";
  els.eventId.value = event.id;
  els.eventTitle.value = event.title;
  els.eventDay.value = event.day;
  els.eventTime.value = event.time;
  els.eventArea.value = event.area;
  els.eventAddress.value = event.address;
  els.eventNotes.value = event.notes;
  els.eventAttachmentsBlock.hidden = false;
  renderEventAttachments(event);
  els.attachmentName.value = "";
  els.attachmentUrl.value = "";
  els.deleteEventBtn.style.visibility = "visible";
  render();
  persist(false);
  els.eventDialog.showModal();
}

function saveEventFromDialog(event) {
  event.preventDefault();
  const id = els.eventId.value || uid();
  const existing = getEvent(id);
  const saved = {
    id,
    day: els.eventDay.value,
    time: els.eventTime.value,
    title: els.eventTitle.value.trim(),
    area: els.eventArea.value.trim(),
    address: els.eventAddress.value.trim(),
    notes: els.eventNotes.value.trim(),
    comments: existing?.comments || [],
    attachments: existing?.attachments || [],
    updatedAt: new Date().toISOString(),
    updatedBy: personName || "İsimsiz",
  };

  if (!saved.title) return;

  if (existing) {
    state.events = state.events.map((item) => (item.id === id ? saved : item));
  } else {
    state.events = [...state.events, saved];
  }

  state.selectedEventId = id;
  els.eventDialog.close();
  render();
  persist();
}

function deleteSelectedFromDialog() {
  const id = els.eventId.value;
  if (!id) return;
  state.events = state.events.filter((event) => event.id !== id);
  if (state.selectedEventId === id) state.selectedEventId = null;
  if (els.commentEventId.value === id && els.commentDialog.open) els.commentDialog.close();
  els.eventDialog.close();
  render();
  persist();
}

function selectEvent(id) {
  state.selectedEventId = id;
  openEditEvent(id);
  persist(false);
}

function render() {
  renderBoard();
}

function renderBoard() {
  els.board.innerHTML = days
    .map((day) => {
      const events = state.events.filter((event) => event.day === day.value).sort(sortEvents);
      const heading =
        day.value === "common"
          ? `<span class="day-date common-title">Ortak</span>`
          : `<span class="day-date"><strong>${day.value}</strong> July</span>`;
      return `
        <section class="day-card">
          <div class="day-head">
            <div>
              ${heading}
              <span class="day-name">${day.weekday}</span>
            </div>
            <button class="day-add" type="button" data-add-day="${day.value}" title="Bu güne plan ekle">+</button>
          </div>
          <div class="plans">
            ${
              events.length
                ? events.map(renderPlanItem).join("")
                : `<div class="empty-day">Boş</div>`
            }
          </div>
        </section>
      `;
    })
    .join("");

  els.board.querySelectorAll("[data-add-day]").forEach((button) => {
    button.addEventListener("click", () => openNewEvent(button.dataset.addDay));
  });

  els.board.querySelectorAll("[data-event-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest("[data-comment-id]")) return;
      selectEvent(button.dataset.eventId);
    });
    button.addEventListener("keydown", (event) => {
      if (event.key === "Enter") selectEvent(button.dataset.eventId);
    });
  });

  els.board.querySelectorAll("[data-comment-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      openComments(button.dataset.commentId);
    });
  });
}

function renderPlanItem(event) {
  const selected = state.selectedEventId === event.id ? " selected" : "";
  return `
    <article class="plan-item${selected}" data-event-id="${event.id}" tabindex="0">
      <span class="plan-time">${event.time || "Saat yok"}</span>
      <span class="plan-title">${escapeHtml(event.title)}</span>
      ${event.area ? `<span class="plan-place">${escapeHtml(event.area)}</span>` : ""}
      <button class="comment-button" type="button" data-comment-id="${event.id}" title="Yorumlar" aria-label="Yorumlar">
        <span class="comment-icon" aria-hidden="true"></span>${event.comments.length ? `<strong>${event.comments.length}</strong>` : ""}
      </button>
    </article>
  `;
}

function renderAttachment(file) {
  const url = file.url || "#";
  return `
    <div class="attachment">
      <a href="${escapeAttr(url)}" target="_blank" rel="noreferrer">${escapeHtml(file.name)}</a>
      <span class="small">${escapeHtml(file.addedBy || "")}</span>
    </div>
  `;
}

function renderEventAttachments(event) {
  els.eventAttachmentList.innerHTML = event.attachments.length
    ? event.attachments.map(renderAttachment).join("")
    : `<p class="small">Henüz link yok.</p>`;
}

function renderComment(comment) {
  return `
    <article class="comment">
      <strong>${escapeHtml(comment.author)}</strong>
      <span>${formatDateTime(comment.createdAt)}</span>
      <p>${escapeHtml(comment.text)}</p>
    </article>
  `;
}

function openComments(eventId) {
  const event = getEvent(eventId);
  if (!event) return;
  state.selectedEventId = eventId;
  els.commentEventId.value = eventId;
  els.commentTitle.textContent = "Yorumlar";
  els.commentMeta.textContent = `${event.title} · ${dayLabel(event.day)}`;
  els.commentText.value = "";
  renderCommentDialog(event);
  render();
  persist(false);
  els.commentDialog.showModal();
}

function renderCommentDialog(event) {
  const sorted = [...event.comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  els.commentList.innerHTML = sorted.length
    ? sorted.map(renderComment).join("")
    : `<p class="small">Henüz yorum yok.</p>`;
}

function addComment(eventId, text) {
  const clean = text.trim();
  if (!clean) return;

  state.events = state.events.map((event) =>
    event.id === eventId
      ? {
          ...event,
          comments: [
            ...event.comments,
            {
              id: uid(),
              author: personName || "İsimsiz",
              text: clean,
              createdAt: new Date().toISOString(),
            },
          ],
          updatedAt: new Date().toISOString(),
          updatedBy: personName || "İsimsiz",
        }
      : event,
  );

  const event = getEvent(eventId);
  if (event && els.commentDialog.open) {
    els.commentText.value = "";
    renderCommentDialog(event);
  }
  render();
  persist();
}

function addAttachmentLink(eventId) {
  const event = getEvent(eventId);
  if (!event) return;

  const url = els.attachmentUrl.value.trim();
  if (!url) return;

  const attachment = {
    id: uid(),
    name: els.attachmentName.value.trim() || "Rezervasyon linki",
    url,
    addedBy: personName || "İsimsiz",
    createdAt: new Date().toISOString(),
  };

  state.events = state.events.map((item) =>
    item.id === eventId
      ? {
          ...item,
          attachments: [...item.attachments, attachment],
          updatedAt: new Date().toISOString(),
          updatedBy: personName || "İsimsiz",
        }
      : item,
  );

  const updated = getEvent(eventId);
  if (updated && els.eventDialog.open && els.eventId.value === eventId) {
    els.attachmentName.value = "";
    els.attachmentUrl.value = "";
    renderEventAttachments(updated);
  }
  render();
  persist();
}

function persist(updateTimestamp = true) {
  if (suppressSave) return;
  if (updateTimestamp) state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (firebaseApi?.planRef) {
    firebaseApi.setDoc(firebaseApi.planRef, sharedState(state));
  }
}

function sharedState(nextState) {
  return {
    events: nextState.events,
    updatedAt: nextState.updatedAt,
  };
}

async function initFirebase() {
  if (!firebaseConfig?.apiKey) {
    els.syncStatus.textContent = "Yerel";
    return;
  }

  try {
    const [{ initializeApp }, firestoreModule] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js"),
    ]);

    const app = initializeApp(firebaseConfig);
    const db = firestoreModule.getFirestore(app);
    const planRef = firestoreModule.doc(db, "plans", planId);
    firebaseApi = {
      planRef,
      setDoc: firestoreModule.setDoc,
    };

    firestoreModule.onSnapshot(
      planRef,
      async (snapshot) => {
        if (!snapshot.exists()) {
          await firestoreModule.setDoc(planRef, sharedState(state));
          return;
        }

        suppressSave = true;
        const selectedEventId = state.selectedEventId;
        const remoteState = normalizeState(snapshot.data());
        const seededRemoteState = mergeStarterEvents(remoteState, { persistVersion: false });
        const starterEventsChanged = JSON.stringify(seededRemoteState.events) !== JSON.stringify(remoteState.events);
        state = {
          ...seededRemoteState,
          selectedEventId,
        };
        const changed = cleanupDemoEvents({ persistChanges: false });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        if (externalStarterEvents?.length) {
          localStorage.setItem(SEED_VERSION_KEY, window.LONDON_STARTER_EVENTS_VERSION || "default");
        }
        render();
        suppressSave = false;
        if (changed || starterEventsChanged) persist();
      },
      (error) => {
        console.error(error);
        suppressSave = false;
        els.syncStatus.textContent = "Yerel";
      },
    );

    els.syncStatus.textContent = "Ortak";
  } catch (error) {
    console.error(error);
    els.syncStatus.textContent = "Yerel";
  }
}

function getEvent(id) {
  return state.events.find((event) => event.id === id);
}

function dayLabel(value) {
  const day = days.find((item) => item.value === value);
  return day ? `${day.date} · ${day.weekday}` : value;
}

function sortEvents(a, b) {
  return `${a.time || "99:99"} ${a.title}`.localeCompare(`${b.time || "99:99"} ${b.title}`);
}

function formatDateTime(value) {
  if (!value) return "Tarih yok";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function uid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value = "") {
  return escapeHtml(value);
}
