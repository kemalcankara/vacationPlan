const STORAGE_KEY = "londonPlannerSimple.v1";
const NAME_KEY = "londonPlannerName.v1";
const SEED_VERSION_KEY = "londonPlannerSeedVersion.v1";
const planId = window.LONDON_PLAN_ID || "london-trip";
const firebaseConfig = window.LONDON_PLANNER_FIREBASE;

const days = [
  { value: "common", date: "Ortak", weekday: "Güne bağlanmadı", short: "Ortak" },
  { value: "20", date: "20 Temmuz", weekday: "Pazartesi", short: "20 Pzt" },
  { value: "21", date: "21 Temmuz", weekday: "Salı", short: "21 Sal" },
  { value: "22", date: "22 Temmuz", weekday: "Çarşamba", short: "22 Çar" },
  { value: "23", date: "23 Temmuz", weekday: "Perşembe", short: "23 Per" },
  { value: "24", date: "24 Temmuz", weekday: "Cuma", short: "24 Cum" },
  { value: "25", date: "25 Temmuz", weekday: "Cumartesi", short: "25 Cts" },
  { value: "26", date: "26 Temmuz", weekday: "Pazar", short: "26 Paz" },
];

const iconClose =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/></svg>';
const iconPlus =
  '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="8" y1="2" x2="8" y2="14"/><line x1="2" y1="8" x2="14" y2="8"/></svg>';
const iconClock =
  '<svg class="mini-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 5v3l2 1.2"/></svg>';
const iconPin =
  '<svg class="mini-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 1c-2.8 0-5 2.1-5 4.9 0 3.6 5 8.6 5 8.6s5-5 5-8.6C13 3.1 10.8 1 8 1zm0 6.8a1.9 1.9 0 110-3.8 1.9 1.9 0 010 3.8z"/></svg>';
const iconFile =
  '<svg class="mini-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 2H4.5A1.5 1.5 0 003 3.5v9A1.5 1.5 0 004.5 14h7a1.5 1.5 0 001.5-1.5V6z"/><path d="M9 2v4h4"/></svg>';

// Attachments are embedded as data URIs (no file backend). Firestore caps the whole
// shared doc at ~1MB, so keep each file small and reject anything oversized.
const MAX_ATTACHMENT_BYTES = 900 * 1024;

const eventTypes = {
  todo: "Plan",
  flight: "Uçuş",
  hotel: "Otel",
  transfer: "Transfer",
  food: "Yemek",
  sight: "Gezilecek",
  reservation: "Rezervasyon",
};

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
let activeDay = days[0].value;
let suppressSave = false;

const els = {
  board: document.querySelector("#dayBoard"),
  dayTabs: document.querySelector("#dayTabs"),
  boardWrap: document.querySelector(".board-wrap"),
  personName: document.querySelector("#personName"),
  saveNameBtn: document.querySelector("#saveNameBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  quickTitle: document.querySelector("#quickTitle"),
  quickDay: document.querySelector("#quickDay"),
  quickAddBtn: document.querySelector("#quickAddBtn"),
  eventDialog: document.querySelector("#eventDialog"),
  eventView: document.querySelector("#eventView"),
  viewTitle: document.querySelector("#viewTitle"),
  viewBody: document.querySelector("#viewBody"),
  closeViewBtn: document.querySelector("#closeViewBtn"),
  viewDeleteBtn: document.querySelector("#viewDeleteBtn"),
  viewCommentsBtn: document.querySelector("#viewCommentsBtn"),
  editModeBtn: document.querySelector("#editModeBtn"),
  eventForm: document.querySelector("#eventForm"),
  formTitle: document.querySelector("#formTitle"),
  closeDialogBtn: document.querySelector("#closeDialogBtn"),
  deleteEventBtn: document.querySelector("#deleteEventBtn"),
  eventId: document.querySelector("#eventId"),
  eventTitle: document.querySelector("#eventTitle"),
  eventType: document.querySelector("#eventType"),
  eventDay: document.querySelector("#eventDay"),
  eventTime: document.querySelector("#eventTime"),
  eventArea: document.querySelector("#eventArea"),
  eventAddress: document.querySelector("#eventAddress"),
  eventNotes: document.querySelector("#eventNotes"),
  eventAudit: document.querySelector("#eventAudit"),
  eventAttachmentsBlock: document.querySelector("#eventAttachmentsBlock"),
  attachmentName: document.querySelector("#attachmentName"),
  attachmentUrl: document.querySelector("#attachmentUrl"),
  addAttachmentLinkBtn: document.querySelector("#addAttachmentLinkBtn"),
  attachmentFile: document.querySelector("#attachmentFile"),
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
  els.closeViewBtn.addEventListener("click", () => els.eventDialog.close());
  els.deleteEventBtn.addEventListener("click", deleteSelectedFromDialog);
  els.viewDeleteBtn.addEventListener("click", deleteSelectedFromDialog);
  els.editModeBtn.addEventListener("click", () => {
    const id = els.eventId.value;
    if (id) openEditEvent(id);
  });
  els.viewCommentsBtn.addEventListener("click", () => {
    const id = els.eventId.value;
    if (!id) return;
    els.eventDialog.close();
    openComments(id);
  });
  els.eventForm.addEventListener("submit", saveEventFromDialog);
  els.addAttachmentLinkBtn.addEventListener("click", () => {
    const id = els.eventId.value;
    if (id) addAttachmentLink(id);
  });
  els.attachmentFile.addEventListener("change", () => {
    const id = els.eventId.value;
    if (id) handleAttachmentFiles(id, els.attachmentFile.files);
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
  const userEdited = existingEvent.updatedBy && existingEvent.updatedBy !== "Sistem";
  const baseEvent = userEdited
    ? {
        ...starterEvent,
        ...existingEvent,
        type: existingEvent.type || starterEvent.type,
      }
    : {
        ...existingEvent,
        ...starterEvent,
      };

  return {
    ...baseEvent,
    comments: existingEvent.comments,
    attachments: mergeAttachments(starterEvent.attachments, existingEvent.attachments).filter(
      (attachment) => !isSensitiveAttachment(attachment),
    ),
    createdAt: existingEvent.createdAt || starterEvent.createdAt,
    createdBy: existingEvent.createdBy || starterEvent.createdBy,
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
    type: validEventType(event.type || inferEventType(event)),
    title: event.title || "Adsız plan",
    area: event.area || "",
    address: event.address || "",
    notes: event.notes || "",
    comments: Array.isArray(event.comments) ? event.comments : [],
    attachments: Array.isArray(event.attachments) ? event.attachments : [],
    createdAt: event.createdAt || event.updatedAt || new Date().toISOString(),
    createdBy: event.createdBy || event.updatedBy || "Bilinmiyor",
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
  const now = new Date().toISOString();

  const event = {
    id: uid(),
    day: els.quickDay.value,
    time: "",
    type: "todo",
    title,
    area: "",
    address: "",
    notes: "",
    comments: [],
    attachments: [],
    createdAt: now,
    createdBy: personName || "İsimsiz",
    updatedAt: now,
    updatedBy: personName || "İsimsiz",
  };

  state.events = [...state.events, event];
  state.selectedEventId = event.id;
  activeDay = event.day;
  els.quickTitle.value = "";
  render();
  persist();
}

function showEventView() {
  els.eventView.hidden = false;
  els.eventForm.hidden = true;
}

function showEventForm() {
  els.eventView.hidden = true;
  els.eventForm.hidden = false;
}

function openEventDialog() {
  if (!els.eventDialog.open) els.eventDialog.showModal();
}

function openNewEvent(day) {
  showEventForm();
  els.formTitle.textContent = `${dayLabel(day)} için plan`;
  els.eventForm.reset();
  els.eventId.value = "";
  els.eventType.value = "todo";
  els.eventDay.value = day;
  els.eventAttachmentsBlock.hidden = true;
  els.eventAttachmentList.innerHTML = "";
  els.eventAudit.textContent = "";
  els.attachmentName.value = "";
  els.attachmentUrl.value = "";
  els.deleteEventBtn.style.visibility = "hidden";
  openEventDialog();
  setTimeout(() => els.eventTitle.focus(), 50);
}

function openViewEvent(id) {
  const event = getEvent(id);
  if (!event) return;

  state.selectedEventId = id;
  els.eventId.value = event.id;
  els.viewTitle.textContent = event.title;
  els.viewBody.innerHTML = renderViewBody(event);
  const commentCount = event.comments.length;
  els.viewCommentsBtn.textContent = commentCount ? `Yorumlar (${commentCount})` : "Yorumlar";
  showEventView();
  render();
  persist(false);
  openEventDialog();
}

function openEditEvent(id) {
  const event = getEvent(id);
  if (!event) return;

  showEventForm();
  state.selectedEventId = id;
  els.formTitle.textContent = "Planı düzenle";
  els.eventId.value = event.id;
  els.eventTitle.value = event.title;
  els.eventType.value = event.type || "todo";
  els.eventDay.value = event.day;
  els.eventTime.value = event.time;
  els.eventArea.value = event.area;
  els.eventAddress.value = event.address;
  els.eventNotes.value = event.notes;
  els.eventAudit.textContent = eventAuditText(event);
  els.eventAttachmentsBlock.hidden = false;
  renderEventAttachments(event);
  els.attachmentName.value = "";
  els.attachmentUrl.value = "";
  els.deleteEventBtn.style.visibility = "visible";
  render();
  persist(false);
  openEventDialog();
}

function saveEventFromDialog(event) {
  event.preventDefault();
  const id = els.eventId.value || uid();
  const existing = getEvent(id);
  const now = new Date().toISOString();
  const saved = {
    id,
    day: els.eventDay.value,
    time: els.eventTime.value,
    type: els.eventType.value,
    title: els.eventTitle.value.trim(),
    area: els.eventArea.value.trim(),
    address: els.eventAddress.value.trim(),
    notes: els.eventNotes.value.trim(),
    comments: existing?.comments || [],
    attachments: existing?.attachments || [],
    createdAt: existing?.createdAt || now,
    createdBy: existing?.createdBy || personName || "İsimsiz",
    updatedAt: now,
    updatedBy: personName || "İsimsiz",
  };

  if (!saved.title) return;

  if (existing) {
    state.events = state.events.map((item) => (item.id === id ? saved : item));
  } else {
    state.events = [...state.events, saved];
  }

  state.selectedEventId = id;
  activeDay = saved.day;
  els.eventDialog.close();
  render();
  persist();
}

function deleteSelectedFromDialog() {
  const id = els.eventId.value;
  if (!id) return;
  confirmAndDeleteEvent(id);
}

function confirmAndDeleteEvent(id) {
  const event = getEvent(id);
  if (!event) return;
  if (!window.confirm(`"${event.title}" silinsin mi?`)) return;
  deleteEvent(id);
}

function deleteEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
  if (state.selectedEventId === id) state.selectedEventId = null;
  if (els.commentEventId.value === id && els.commentDialog.open) els.commentDialog.close();
  if (els.eventId.value === id && els.eventDialog.open) els.eventDialog.close();
  render();
  persist();
}

function selectEvent(id) {
  state.selectedEventId = id;
  openViewEvent(id);
}

function render() {
  renderBoard();
  renderDayTabs();
}

function renderBoard() {
  els.board.innerHTML = days
    .map((day) => {
      const events = state.events.filter((event) => event.day === day.value).sort(sortEvents);
      const noTimeCount = events.filter((event) => !event.time).length;
      const countLabel = `${events.length} plan${noTimeCount ? ` · ${noTimeCount} saatsiz` : ""}`;
      const heading =
        day.value === "common"
          ? `<span class="day-date common-title">Ortak</span>`
          : `<span class="day-date"><strong>${day.value}</strong> Temmuz</span>`;
      const active = day.value === activeDay ? " is-active" : "";
      return `
        <section class="day-card${active}" id="day-${day.value}" data-day-value="${day.value}">
          <div class="day-head">
            <div>
              ${heading}
              <span class="day-name">${day.weekday}</span>
              <span class="day-count">${countLabel}</span>
            </div>
            <button class="day-add" type="button" data-add-day="${day.value}" title="Bu güne plan ekle">${iconPlus}</button>
          </div>
          <div class="plans" data-drop-day="${day.value}">
            ${
              events.length
                ? events.map(renderPlanItem).join("")
                : `<div class="empty-day">Bu gün için henüz plan yok</div>`
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
      if (event.target.closest("[data-comment-id], [data-delete-id]")) return;
      selectEvent(button.dataset.eventId);
    });
    button.addEventListener("keydown", (event) => {
      if (event.target.closest("[data-comment-id], [data-delete-id]")) return;
      if (event.key === "Enter") selectEvent(button.dataset.eventId);
    });
    button.addEventListener("dragstart", handleDragStart);
    button.addEventListener("dragend", handleDragEnd);
  });

  els.board.querySelectorAll("[data-drop-day]").forEach((dropZone) => {
    dropZone.addEventListener("dragover", handleDragOver);
    dropZone.addEventListener("dragleave", handleDragLeave);
    dropZone.addEventListener("drop", handleDrop);
  });

  els.board.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      confirmAndDeleteEvent(button.dataset.deleteId);
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
  const type = validEventType(event.type);
  return `
    <article class="plan-item type-${type}${selected}" data-event-id="${event.id}" tabindex="0" draggable="true" title="${escapeAttr(typeLabel(type))}">
      <button class="delete-plan-button" type="button" data-delete-id="${event.id}" title="Sil" aria-label="Sil">${iconClose}</button>
      <span class="plan-title">${escapeHtml(event.title)}</span>
      <div class="plan-sub">
        <span class="plan-time">${iconClock}${event.time || "Saat yok"}</span>
        ${event.area ? `<span class="plan-place">${iconPin}${escapeHtml(event.area)}</span>` : ""}
      </div>
      <button class="comment-button" type="button" data-comment-id="${event.id}" title="Yorumlar" aria-label="Yorumlar">
        <span class="comment-icon" aria-hidden="true"></span>${event.comments.length ? `<strong>${event.comments.length}</strong>` : ""}
      </button>
    </article>
  `;
}

function renderDayTabs() {
  if (!els.dayTabs) return;
  els.dayTabs.innerHTML = days
    .map((day) => {
      const count = state.events.filter((event) => event.day === day.value).length;
      const active = day.value === activeDay ? " active" : "";
      return `
        <button type="button" class="day-tab${active}" data-tab-day="${day.value}">
          ${day.short}${count ? `<span class="day-tab-count">${count}</span>` : ""}
        </button>
      `;
    })
    .join("");

  els.dayTabs.querySelectorAll("[data-tab-day]").forEach((tab) => {
    tab.addEventListener("click", () => {
      if (activeDay === tab.dataset.tabDay) return;
      activeDay = tab.dataset.tabDay;
      render();
    });
  });

  centerActiveTab();
}

function centerActiveTab() {
  const activeTab = els.dayTabs?.querySelector(".day-tab.active");
  if (!activeTab) return;
  const target = activeTab.offsetLeft - els.dayTabs.clientWidth / 2 + activeTab.clientWidth / 2;
  els.dayTabs.scrollTo({ left: target, behavior: "smooth" });
}

function handleDragStart(event) {
  const item = event.currentTarget;
  item.classList.add("dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.dataset.eventId);
}

function handleDragEnd(event) {
  event.currentTarget.classList.remove("dragging");
  els.board.querySelectorAll(".plans.drag-over").forEach((dropZone) => {
    dropZone.classList.remove("drag-over");
  });
}

function handleDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add("drag-over");
  event.dataTransfer.dropEffect = "move";
}

function handleDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove("drag-over");
  }
}

function handleDrop(event) {
  event.preventDefault();
  const dropZone = event.currentTarget;
  dropZone.classList.remove("drag-over");

  const id = event.dataTransfer.getData("text/plain");
  const targetDay = dropZone.dataset.dropDay;
  const draggedEvent = getEvent(id);
  if (!draggedEvent || !targetDay || draggedEvent.day === targetDay) return;

  state.events = state.events.map((item) =>
    item.id === id
      ? {
          ...item,
          day: targetDay,
          createdAt: item.createdAt,
          createdBy: item.createdBy,
          type: item.type || "todo",
          updatedAt: new Date().toISOString(),
          updatedBy: personName || "İsimsiz",
        }
      : item,
  );
  state.selectedEventId = id;
  activeDay = targetDay;
  render();
  persist();
}

function attachmentSrc(file) {
  return file.dataUrl || file.url || "";
}

function isImageAttachment(file) {
  return file.kind === "image" || String(attachmentSrc(file)).startsWith("data:image");
}

function isPdfAttachment(file) {
  return file.kind === "pdf" || String(attachmentSrc(file)).startsWith("data:application/pdf");
}

function renderAttachment(file) {
  const src = attachmentSrc(file) || "#";
  const thumb = isImageAttachment(file)
    ? `<img class="attachment-thumb" src="${escapeAttr(src)}" alt="" />`
    : `<span class="attachment-badge">${isPdfAttachment(file) ? "PDF" : "LINK"}</span>`;
  return `
    <div class="attachment">
      ${thumb}
      <a href="${escapeAttr(src)}" target="_blank" rel="noreferrer">${escapeHtml(file.name)}</a>
      <button type="button" class="attachment-remove" data-remove-attachment="${escapeAttr(file.id)}" title="Kaldır" aria-label="Kaldır">${iconClose}</button>
    </div>
  `;
}

function renderEventAttachments(event) {
  els.eventAttachmentList.innerHTML = event.attachments.length
    ? event.attachments.map(renderAttachment).join("")
    : `<p class="small">Henüz ek yok.</p>`;

  els.eventAttachmentList.querySelectorAll("[data-remove-attachment]").forEach((button) => {
    button.addEventListener("click", () => removeAttachment(event.id, button.dataset.removeAttachment));
  });
}

function renderViewAttachment(file) {
  const src = attachmentSrc(file);
  if (!src) return "";
  if (isImageAttachment(file)) {
    return `
      <a class="view-image" href="${escapeAttr(src)}" target="_blank" rel="noreferrer">
        <img src="${escapeAttr(src)}" alt="${escapeAttr(file.name)}" loading="lazy" />
      </a>
    `;
  }
  return `
    <a class="view-file" href="${escapeAttr(src)}" target="_blank" rel="noreferrer">
      ${iconFile}<span>${escapeHtml(file.name)}</span>
    </a>
  `;
}

function renderViewBody(event) {
  const type = validEventType(event.type);
  const timeText = event.time || "Saat yok";
  const rows = [`<span class="view-badge">${escapeHtml(typeLabel(type))}</span>`];

  rows.push(`<div class="view-meta">${iconClock}<span>${escapeHtml(dayLabel(event.day))} · ${escapeHtml(timeText)}</span></div>`);

  if (event.area) {
    rows.push(`<div class="view-row">${iconPin}<span>${escapeHtml(event.area)}</span></div>`);
  }
  if (event.address) {
    rows.push(
      `<div class="view-row">${iconFile}<a href="${escapeAttr(event.address)}" target="_blank" rel="noreferrer">${escapeHtml(event.address)}</a></div>`,
    );
  }
  if (event.notes) {
    rows.push(`<p class="view-notes">${escapeHtml(event.notes)}</p>`);
  }
  if (event.attachments.length) {
    rows.push(`<div class="view-attachments">${event.attachments.map(renderViewAttachment).join("")}</div>`);
  }
  rows.push(`<p class="event-audit">${escapeHtml(eventAuditText(event))}</p>`);

  return rows.join("");
}

function eventAuditText(event) {
  const createdBy = event.createdBy || event.updatedBy || "Bilinmiyor";
  const updatedBy = event.updatedBy || "Bilinmiyor";
  return `Ekleyen: ${createdBy} · ${formatDateTime(event.createdAt)} | Son düzenleyen: ${updatedBy} · ${formatDateTime(event.updatedAt)}`;
}

function typeLabel(type) {
  return eventTypes[validEventType(type)] || eventTypes.todo;
}

function validEventType(type) {
  return Object.prototype.hasOwnProperty.call(eventTypes, type) ? type : "todo";
}

function inferEventType(event) {
  const text = `${event.title || ""} ${event.area || ""} ${event.notes || ""}`.toLocaleLowerCase("tr-TR");
  if (/uçuş|ucus|\bflight\b|\bpc\d+/i.test(text)) return "flight";
  if (/otel|hotel|check-in|check-out|inn|quarters/i.test(text)) return "hotel";
  if (/transfer|taxi|stansted'dan|havaalan/i.test(text)) return "transfer";
  if (/yemek|kahvaltı|kahvalti|restaurant|dinner|lunch|food/i.test(text)) return "food";
  if (/rezervasyon|reservation|booking/i.test(text)) return "reservation";
  if (/museum|müze|tour|studio|garden|gez/i.test(text)) return "sight";
  return "todo";
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

async function handleAttachmentFiles(eventId, fileList) {
  const event = getEvent(eventId);
  if (!event) return;

  const files = Array.from(fileList || []);
  if (!files.length) return;

  els.attachmentFile.disabled = true;
  const newAttachments = [];
  for (const file of files) {
    try {
      const attachment = await fileToAttachment(file);
      if (attachment) newAttachments.push(attachment);
    } catch (error) {
      console.error(error);
      window.alert(`"${file.name}" eklenemedi.`);
    }
  }
  els.attachmentFile.disabled = false;
  els.attachmentFile.value = "";
  if (!newAttachments.length) return;

  state.events = state.events.map((item) =>
    item.id === eventId
      ? {
          ...item,
          attachments: [...item.attachments, ...newAttachments],
          updatedAt: new Date().toISOString(),
          updatedBy: personName || "İsimsiz",
        }
      : item,
  );

  const updated = getEvent(eventId);
  if (updated && els.eventDialog.open && els.eventId.value === eventId) {
    renderEventAttachments(updated);
  }
  render();
  persist();
}

async function fileToAttachment(file) {
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";
  if (!isImage && !isPdf) {
    window.alert(`"${file.name}" desteklenmiyor. Sadece resim veya PDF eklenebilir.`);
    return null;
  }

  const dataUrl = isImage ? await compressImage(file) : await readFileAsDataUrl(file);

  if (dataUrl.length > MAX_ATTACHMENT_BYTES) {
    window.alert(
      `"${file.name}" çok büyük (ortak plan sınırı ~1MB). ${isPdf ? "Daha küçük bir PDF" : "Daha küçük bir resim"} deneyin.`,
    );
    return null;
  }

  return {
    id: uid(),
    name: file.name || (isImage ? "Resim" : "PDF"),
    kind: isImage ? "image" : "pdf",
    dataUrl,
    addedBy: personName || "İsimsiz",
    createdAt: new Date().toISOString(),
  };
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function compressImage(file, maxDim = 1400, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Resim okunamadı"));
      img.onload = () => {
        let { width, height } = img;
        const scale = Math.min(1, maxDim / Math.max(width, height));
        width = Math.round(width * scale);
        height = Math.round(height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch (error) {
          reject(error);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function removeAttachment(eventId, attachmentId) {
  const event = getEvent(eventId);
  if (!event) return;

  state.events = state.events.map((item) =>
    item.id === eventId
      ? {
          ...item,
          attachments: item.attachments.filter((attachment) => attachment.id !== attachmentId),
          updatedAt: new Date().toISOString(),
          updatedBy: personName || "İsimsiz",
        }
      : item,
  );

  const updated = getEvent(eventId);
  if (updated && els.eventDialog.open && els.eventId.value === eventId) {
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

function setSyncStatus(label, syncState) {
  els.syncStatus.textContent = label;
  els.syncStatus.dataset.state = syncState;
}

async function initFirebase() {
  if (!firebaseConfig?.apiKey) {
    setSyncStatus("Yerel", "local");
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
        setSyncStatus("Yerel", "local");
      },
    );

    setSyncStatus("Ortak", "shared");
  } catch (error) {
    console.error(error);
    setSyncStatus("Yerel", "local");
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
