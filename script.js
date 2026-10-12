async function startApp() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js"
  );
  const {
    get,
    getDatabase,
    onValue,
    push,
    ref,
    remove,
    serverTimestamp,
    set,
    update,
  } = await import(
    "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js"
  );

  const firebaseConfig = {
    apiKey: "AIzaSyCirR2CstlC0D6yTdpCS4XvvHBC3CUf4ns",
    authDomain: "coalnu-3-revised.firebaseapp.com",
    projectId: "coalnu-3-revised",
    storageBucket: "coalnu-3-revised.firebasestorage.app",
    messagingSenderId: "877881696953",
    appId: "1:877881696953:web:8ce2f60bd30943b4183168",
    databaseURL: "https://coalnu-3-revised-default-rtdb.firebaseio.com/",
  };

  const app = initializeApp(firebaseConfig);
  const db = getDatabase(app);
  const todosRef = ref(db, "todos");
  const API_URL = "firebase://todos";

const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const deadlineInput = document.querySelector("#deadline-input");
const priorityInput = document.querySelector("#priority-input");
const todoList = document.querySelector("#todo-list");
const statusMessage = document.querySelector("#status");
const allFilterCount = document.querySelector("#all-filter-count");
const activeFilterCount = document.querySelector("#active-filter-count");
const completedFilterCount = document.querySelector("#completed-filter-count");
const filterButtons = document.querySelectorAll(".filter-button");
const deadlineFilterButtons = document.querySelectorAll(
  ".deadline-summary-button",
);
const clearCompletedButton = document.querySelector("#clear-completed-button");
const deadlineSummary = document.querySelector("#deadline-summary");
const overdueCount = document.querySelector("#overdue-count");
const todayDueCount = document.querySelector("#today-due-count");
const searchInput = document.querySelector("#search-input");
const searchClearButton = document.querySelector("#search-clear-button");
const sortSelect = document.querySelector("#sort-select");
const lastSync = document.querySelector("#last-sync");
const syncButton = document.querySelector("#sync-button");
const syncLabel = document.querySelector("#sync-label");
const todayDate = document.querySelector("#today-date");
const addButton = todoForm.querySelector(".add-button");
const addLabel = document.querySelector("#add-label");
const undoToast = document.querySelector("#undo-toast");
const undoMessage = document.querySelector("#undo-message");
const undoButton = document.querySelector("#undo-button");
const connectionBanner = document.querySelector("#connection-banner");
const connectionRetryButton = document.querySelector(
  "#connection-retry-button",
);

let currentTodos = [];
let currentFilter = "all";
let deadlineFilter = "all";
let sortMode = "recommended";
let searchQuery = "";
let statusTimer;
let isLoadingTodos = false;
let undoTimer;
let pendingUndoTodos = [];
let pendingUndoReadyPromise = Promise.resolve();
let pendingUndoVersion = 0;

sortSelect.value = sortMode;
searchInput.value = "";

const PRIORITIES = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

const PRIORITY_ORDER = {
  high: 3,
  medium: 2,
  low: 1,
};

todayDate.dateTime = new Date().toISOString().slice(0, 10);
todayDate.textContent = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

function showStatus(message, { error = false, empty = false, loading = false } = {}) {
  clearTimeout(statusTimer);
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", error);
  statusMessage.classList.toggle("empty-state", empty);
  statusMessage.classList.toggle("loading", loading);

  if (message && !error && !empty && !loading) {
    statusTimer = setTimeout(() => {
      if (statusMessage.textContent === message) showStatus("");
    }, 2400);
  }
}

function setConnectionState(connected) {
  connectionBanner.hidden = connected;
  connectionRetryButton.disabled = connected;
  connectionRetryButton.textContent = "다시 연결";
}

function toClientTodo(id, data = {}) {
  return {
    _id: id,
    content: data.content ?? data.text ?? "제목 없는 할 일",
    completed: Boolean(data.completed ?? data.done),
    deadline: data.deadline ?? null,
    priority: data.priority ?? null,
    createdAt: data.createdAt ?? null,
  };
}

function toFirebaseDeadline(value) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function getTodoId(url) {
  if (!url.startsWith(`${API_URL}/`)) return null;
  return decodeURIComponent(url.slice(API_URL.length + 1));
}

async function request(url = API_URL, options = {}) {
  const method = (options.method || "GET").toUpperCase();

  try {
    if (method === "GET" && url === API_URL) {
      const snapshot = await get(todosRef);
      const savedTodos = snapshot.val() ?? {};
      const todos = Object.entries(savedTodos).map(([id, todo]) =>
        toClientTodo(id, todo),
      );
      setConnectionState(true);
      return todos;
    }

    const body = options.body ? JSON.parse(options.body) : {};

    if (method === "POST" && url === API_URL) {
      const newTodoRef = push(todosRef);
      await set(newTodoRef, {
        text: body.content,
        completed: Boolean(body.completed),
        deadline: toFirebaseDeadline(body.deadline),
        priority: body.priority || null,
        createdAt: serverTimestamp(),
      });
      const snapshot = await get(newTodoRef);
      setConnectionState(true);
      return toClientTodo(newTodoRef.key, snapshot.val());
    }

    const id = getTodoId(url);
    if (!id) throw new Error("올바르지 않은 할 일 주소입니다.");

    const todoRef = ref(db, `todos/${id}`);

    if (method === "PUT") {
      await update(todoRef, {
        text: body.content,
        completed: Boolean(body.completed),
        deadline: toFirebaseDeadline(body.deadline),
        priority: body.priority || null,
      });
      const snapshot = await get(todoRef);
      if (!snapshot.exists()) throw new Error("할 일을 찾을 수 없습니다.");
      setConnectionState(true);
      return toClientTodo(id, snapshot.val());
    }

    if (method === "DELETE") {
      const snapshot = await get(todoRef);
      if (!snapshot.exists()) throw new Error("할 일을 찾을 수 없습니다.");
      const deletedTodo = toClientTodo(id, snapshot.val());
      await remove(todoRef);
      setConnectionState(true);
      return deletedTodo;
    }

    throw new Error("지원하지 않는 Firebase 작업입니다.");
  } catch (error) {
    setConnectionState(false);
    throw new Error(
      error.message || "Firebase 요청을 처리하지 못했습니다.",
      { cause: error },
    );
  }
}

function formatCreatedAt(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeTodo(todo) {
  return {
    ...todo,
    completed: Boolean(todo.completed),
    deadline: todo.deadline || null,
    priority: PRIORITIES[todo.priority] ? todo.priority : null,
  };
}

function dedupeTodos(todos) {
  const seenIds = new Set();

  return todos.filter((todo) => {
    if (!todo?._id || seenIds.has(todo._id)) return false;
    seenIds.add(todo._id);
    return true;
  });
}

function parseDeadline(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toDateTimeLocal(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDeadline(value) {
  if (!value) return "마감 없음";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "마감 없음";

  const today = new Date();
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dayDifference = Math.round((dueDay - todayStart) / 86400000);
  const time = new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (dayDifference === 0) return `오늘 ${time}`;
  if (dayDifference === 1) return `내일 ${time}`;

  return `마감 ${new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

function isOverdue(todo) {
  if (todo.completed || !todo.deadline) return false;
  return new Date(todo.deadline).getTime() < Date.now();
}

function getDeadlineState(todo) {
  if (!todo.deadline) return "none";
  if (isOverdue(todo)) return "overdue";

  const date = new Date(todo.deadline);
  if (Number.isNaN(date.getTime())) return "none";

  const today = new Date();
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dayDifference = Math.round((dueDay - todayStart) / 86400000);

  if (dayDifference === 0) return "today";
  if (dayDifference === 1) return "tomorrow";
  return "default";
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) {
      return Number(a.completed) - Number(b.completed);
    }

    const priorityDifference =
      (PRIORITY_ORDER[b.priority] ?? 0) - (PRIORITY_ORDER[a.priority] ?? 0);
    const aDeadline = a.deadline
      ? new Date(a.deadline).getTime()
      : Number.POSITIVE_INFINITY;
    const bDeadline = b.deadline
      ? new Date(b.deadline).getTime()
      : Number.POSITIVE_INFINITY;
    const deadlineDifference = aDeadline - bDeadline;
    const newestDifference =
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

    if (sortMode === "deadline") {
      if (deadlineDifference) return deadlineDifference;
      if (priorityDifference) return priorityDifference;
    } else if (sortMode === "priority") {
      if (priorityDifference) return priorityDifference;
      if (deadlineDifference) return deadlineDifference;
    } else if (sortMode === "newest") {
      return newestDifference;
    } else {
      if (priorityDifference) return priorityDifference;
      if (deadlineDifference) return deadlineDifference;
    }

    return newestDifference;
  });
}

function filterTodos(todos) {
  let filteredTodos = todos;

  if (currentFilter === "active") {
    filteredTodos = filteredTodos.filter((todo) => !todo.completed);
  } else if (currentFilter === "completed") {
    filteredTodos = filteredTodos.filter((todo) => todo.completed);
  }

  if (deadlineFilter !== "all") {
    filteredTodos = filteredTodos.filter(
      (todo) => !todo.completed && getDeadlineState(todo) === deadlineFilter,
    );
  }

  if (searchQuery) {
    filteredTodos = filteredTodos.filter((todo) =>
      todo.content.toLocaleLowerCase("ko-KR").includes(searchQuery),
    );
  }

  return filteredTodos;
}

function updateLastSyncTime() {
  const now = new Date();
  lastSync.dateTime = now.toISOString();
  lastSync.textContent = `마지막 업데이트 ${new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(now)}`;
}

function renderTodos() {
  currentTodos = dedupeTodos(currentTodos);

  const remaining = currentTodos.filter((todo) => !todo.completed).length;
  const completed = currentTodos.length - remaining;
  const overdue = currentTodos.filter(
    (todo) => !todo.completed && getDeadlineState(todo) === "overdue",
  ).length;
  const dueToday = currentTodos.filter(
    (todo) => !todo.completed && getDeadlineState(todo) === "today",
  ).length;

  if (
    (deadlineFilter === "overdue" && overdue === 0) ||
    (deadlineFilter === "today" && dueToday === 0)
  ) {
    deadlineFilter = "all";
  }

  const visibleTodos = filterTodos(sortTodos(currentTodos));

  todoList.replaceChildren(...visibleTodos.map(createTodoElement));
  allFilterCount.textContent = currentTodos.length;
  activeFilterCount.textContent = remaining;
  completedFilterCount.textContent = completed;
  overdueCount.textContent = overdue;
  todayDueCount.textContent = dueToday;
  deadlineSummary.hidden = overdue === 0 && dueToday === 0;
  clearCompletedButton.hidden = completed === 0 || currentFilter !== "completed";
  clearCompletedButton.textContent = `완료 ${completed}개 삭제`;
  searchClearButton.hidden = !searchQuery;

  filterButtons.forEach((button) => {
    const isActive = button.dataset.filter === currentFilter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  deadlineFilterButtons.forEach((button) => {
    const isActive = button.dataset.deadlineFilter === deadlineFilter;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });

  if (!currentTodos.length) {
    showStatus("아직 등록된 할 일이 없습니다. 첫 할 일을 추가해 보세요.", {
      empty: true,
    });
  } else if (!visibleTodos.length) {
    const message = searchQuery
      ? `“${searchInput.value.trim()}” 검색 결과가 없습니다.`
      : deadlineFilter === "overdue"
        ? "기한이 지난 할 일이 없습니다."
        : deadlineFilter === "today"
          ? "오늘 마감인 할 일이 없습니다."
      : currentFilter === "completed"
        ? "완료한 일이 없습니다."
        : "진행 중인 일이 없습니다.";
    showStatus(message, { empty: true });
  } else if (
    statusMessage.classList.contains("loading") ||
    statusMessage.classList.contains("empty-state")
  ) {
    showStatus("");
  }
}

async function loadTodos({ silent = false, manual = false } = {}) {
  if (isLoadingTodos) return false;

  isLoadingTodos = true;
  if (!silent) showStatus("할 일을 불러오는 중...", { loading: true });
  if (manual) {
    syncButton.disabled = true;
    syncButton.classList.add("syncing");
    syncLabel.textContent = "불러오는 중...";
  }

  try {
    const todos = await request();
    currentTodos = Array.isArray(todos) ? todos.map(normalizeTodo) : [];
    renderTodos();
    updateLastSyncTime();
    return true;
  } catch (error) {
    showStatus(error.message, { error: true });
    console.error(error);
    return false;
  } finally {
    isLoadingTodos = false;
    if (manual) {
      syncButton.disabled = false;
      syncButton.classList.remove("syncing");
      syncLabel.textContent = "새로고침";
    }
  }
}

function createTodoElement(todo) {
  const item = document.createElement("li");
  const main = document.createElement("div");
  const title = document.createElement("label");
  const checkbox = document.createElement("input");
  const content = document.createElement("span");
  const statusBadge = document.createElement("span");
  const meta = document.createElement("p");
  const priorityBadge = document.createElement("span");
  const deadline = document.createElement("span");
  const createdAt = document.createElement("time");
  const actions = document.createElement("div");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  item.className = [
    "todo-item",
    todo.priority ? `priority-${todo.priority}` : "",
    todo.completed ? "completed" : "",
    isOverdue(todo) ? "overdue" : "",
  ]
    .filter(Boolean)
    .join(" ");
  item.dataset.id = todo._id;
  main.className = "todo-main";
  title.className = "todo-title-row";
  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.setAttribute("aria-label", `${todo.content} 완료 여부`);
  content.className = "todo-content";
  content.textContent = todo.content;
  statusBadge.className = `todo-status-badge ${
    todo.completed ? "status-completed" : "status-active"
  }`;
  statusBadge.textContent = todo.completed ? "완료" : "진행 중";
  meta.className = "todo-meta";
  priorityBadge.className = "priority-badge";
  priorityBadge.textContent = todo.priority
    ? PRIORITIES[todo.priority]
    : "우선순위 없음";
  deadline.className = `deadline-text deadline-${getDeadlineState(todo)}`;
  deadline.textContent = `${formatDeadline(todo.deadline)}${
    isOverdue(todo) ? " · 기한 지남" : ""
  }`;
  createdAt.className = "todo-created-at";
  createdAt.textContent = formatCreatedAt(todo.createdAt);
  if (todo.createdAt) createdAt.dateTime = todo.createdAt;

  actions.className = "item-actions";
  editButton.type = "button";
  editButton.className = "edit-button";
  editButton.textContent = "수정";
  editButton.setAttribute("aria-label", `${todo.content} 수정`);
  editButton.addEventListener("click", () => startEditing(item, todo));

  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "삭제";
  deleteButton.setAttribute("aria-label", `${todo.content} 삭제`);
  deleteButton.addEventListener("click", () => deleteTodo(todo, deleteButton));

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;

    try {
      const updatedTodo = await request(`${API_URL}/${todo._id}`, {
        method: "PUT",
        body: JSON.stringify({
          content: todo.content,
          deadline: todo.deadline,
          priority: todo.priority,
          completed: checkbox.checked,
        }),
      });
      currentTodos = currentTodos.map((currentTodo) =>
        currentTodo._id === todo._id ? normalizeTodo(updatedTodo) : currentTodo,
      );
      renderTodos();
      showStatus(
        checkbox.checked
          ? "할 일을 완료했습니다."
          : "할 일을 다시 진행 중으로 변경했습니다.",
      );
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      checkbox.disabled = false;
      showStatus(error.message, { error: true });
      console.error(error);
    }
  });

  meta.append(priorityBadge, deadline);
  title.append(checkbox, content, statusBadge);
  main.append(title, meta);
  if (createdAt.textContent) main.append(createdAt);
  actions.append(editButton, deleteButton);
  item.append(main, actions);

  return item;
}

function createPrioritySelect(selectedPriority) {
  const select = document.createElement("select");
  const emptyOption = document.createElement("option");

  emptyOption.value = "";
  emptyOption.textContent = "선택 안 함";
  emptyOption.selected = !selectedPriority;
  select.append(emptyOption);

  Object.entries(PRIORITIES).forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = value === selectedPriority;
    select.append(option);
  });

  return select;
}

function startEditing(item, todo) {
  const editFields = document.createElement("div");
  const editInput = document.createElement("input");
  const editOptions = document.createElement("div");
  const deadlineLabel = document.createElement("label");
  const deadlineLabelText = document.createElement("span");
  const editDeadline = document.createElement("input");
  const priorityLabel = document.createElement("label");
  const priorityLabelText = document.createElement("span");
  const editPriority = createPrioritySelect(todo.priority);
  const actions = document.createElement("div");
  const saveButton = document.createElement("button");
  const cancelButton = document.createElement("button");

  editFields.className = "edit-fields";
  editInput.className = "edit-input";
  editInput.value = todo.content;
  editInput.maxLength = 200;
  editInput.setAttribute("aria-label", "할 일 내용 수정");
  editOptions.className = "edit-options";
  deadlineLabelText.textContent = "마감기한 (선택)";
  editDeadline.type = "datetime-local";
  editDeadline.value = toDateTimeLocal(todo.deadline);
  priorityLabelText.textContent = "우선순위";
  actions.className = "item-actions";

  saveButton.type = "button";
  saveButton.className = "save-button";
  saveButton.textContent = "저장";
  cancelButton.type = "button";
  cancelButton.className = "edit-button";
  cancelButton.textContent = "취소";

  async function saveEdit() {
    const content = editInput.value.trim();
    const deadline = parseDeadline(editDeadline.value);

    if (!content) {
      showStatus("할 일 내용을 입력해 주세요.", { error: true });
      editInput.focus();
      return;
    }

    if (deadline === undefined) {
      showStatus("마감기한을 올바르게 입력해 주세요.", { error: true });
      editDeadline.focus();
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "저장 중…";
    editInput.disabled = true;
    editDeadline.disabled = true;
    editPriority.disabled = true;

    try {
      const updatedTodo = await request(`${API_URL}/${todo._id}`, {
        method: "PUT",
        body: JSON.stringify({
          content,
          deadline,
          priority: editPriority.value || null,
          completed: todo.completed,
        }),
      });
      currentTodos = currentTodos.map((currentTodo) =>
        currentTodo._id === todo._id ? normalizeTodo(updatedTodo) : currentTodo,
      );
      renderTodos();
      showStatus("할 일이 수정되었습니다.");
    } catch (error) {
      saveButton.disabled = false;
      saveButton.textContent = "저장";
      editInput.disabled = false;
      editDeadline.disabled = false;
      editPriority.disabled = false;
      showStatus(error.message, { error: true });
      console.error(error);
    }
  }

  saveButton.addEventListener("click", saveEdit);
  cancelButton.addEventListener("click", renderTodos);
  editInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveEdit();
    if (event.key === "Escape") renderTodos();
  });

  deadlineLabel.append(deadlineLabelText, editDeadline);
  priorityLabel.append(priorityLabelText, editPriority);
  editOptions.append(deadlineLabel, priorityLabel);
  editFields.append(editInput, editOptions);
  actions.append(saveButton, cancelButton);
  item.replaceChildren(editFields, actions);
  editInput.focus();
  editInput.select();
}

function hideUndoToast() {
  clearTimeout(undoTimer);
  pendingUndoVersion += 1;
  pendingUndoTodos = [];
  pendingUndoReadyPromise = Promise.resolve();
  undoToast.hidden = true;
  undoButton.disabled = false;
  undoButton.textContent = "실행 취소";
}

function offerUndo(todos, message, { readyPromise = Promise.resolve() } = {}) {
  clearTimeout(undoTimer);
  const undoVersion = ++pendingUndoVersion;
  pendingUndoTodos = todos.map(normalizeTodo);
  pendingUndoReadyPromise = Promise.resolve(readyPromise);
  undoMessage.textContent = message;
  undoToast.hidden = false;
  undoButton.disabled = false;
  undoButton.textContent = "실행 취소";
  undoTimer = setTimeout(() => {
    if (pendingUndoVersion === undoVersion) hideUndoToast();
  }, 6000);
  return undoVersion;
}

async function restoreTodo(todo) {
  let restoredTodo = await request(API_URL, {
    method: "POST",
    body: JSON.stringify({
      content: todo.content,
      deadline: todo.deadline,
      priority: todo.priority,
      completed: false,
    }),
  });

  if (todo.completed && !restoredTodo.completed) {
    restoredTodo = await request(`${API_URL}/${restoredTodo._id}`, {
      method: "PUT",
      body: JSON.stringify({
        content: todo.content,
        deadline: todo.deadline,
        priority: todo.priority,
        completed: true,
      }),
    });
  }

  return normalizeTodo(restoredTodo);
}

async function undoLastDelete() {
  if (!pendingUndoTodos.length) return;

  clearTimeout(undoTimer);
  const undoVersion = pendingUndoVersion;
  const todosToRestore = [...pendingUndoTodos];
  const readyPromise = pendingUndoReadyPromise;
  const restoredTodos = [];
  let failedCount = 0;
  undoButton.disabled = true;
  undoButton.textContent = "복원 중…";

  try {
    await readyPromise;
  } catch {
    if (pendingUndoVersion === undoVersion) hideUndoToast();
    return;
  }

  if (pendingUndoVersion !== undoVersion) return;

  for (const todo of todosToRestore) {
    try {
      restoredTodos.push(await restoreTodo(todo));
    } catch (error) {
      failedCount += 1;
      console.error(error);
    }
  }

  hideUndoToast();
  currentTodos = [...restoredTodos, ...currentTodos];
  renderTodos();

  if (failedCount) {
    showStatus(`${failedCount}개 항목을 복원하지 못했습니다.`, { error: true });
  } else {
    showStatus(
      restoredTodos.length === 1
        ? "삭제한 할 일을 복원했습니다."
        : `삭제한 할 일 ${restoredTodos.length}개를 복원했습니다.`,
    );
  }
}

async function deleteTodo(todo, deleteButton) {
  deleteButton.disabled = true;
  deleteButton.textContent = "삭제 중…";
  const deletedTodo = normalizeTodo(todo);
  const deletionPromise = request(`${API_URL}/${todo._id}`, {
    method: "DELETE",
  });

  currentTodos = currentTodos.filter(
    (currentTodo) => currentTodo._id !== deletedTodo._id,
  );
  renderTodos();
  const undoVersion = offerUndo([deletedTodo], "할 일을 삭제했습니다.", {
    readyPromise: deletionPromise,
  });

  try {
    await deletionPromise;
  } catch (error) {
    if (pendingUndoVersion === undoVersion) hideUndoToast();
    currentTodos = dedupeTodos([deletedTodo, ...currentTodos]);
    renderTodos();
    showStatus(error.message, { error: true });
    console.error(error);
  }
}

async function deleteCompletedTodos() {
  const completedTodos = currentTodos.filter((todo) => todo.completed);
  if (!completedTodos.length) return;

  if (
    !window.confirm(`완료한 할 일 ${completedTodos.length}개를 모두 삭제할까요?`)
  ) {
    return;
  }

  clearCompletedButton.disabled = true;
  clearCompletedButton.textContent = "삭제 중…";

  const results = await Promise.allSettled(
    completedTodos.map((todo) =>
      request(`${API_URL}/${todo._id}`, { method: "DELETE" }),
    ),
  );
  const deletedTodos = results
    .filter((result) => result.status === "fulfilled")
    .map((result) => normalizeTodo(result.value));
  const deletedIds = new Set(deletedTodos.map((todo) => todo._id));
  const failedCount = results.length - deletedTodos.length;

  currentTodos = currentTodos.filter((todo) => !deletedIds.has(todo._id));
  clearCompletedButton.disabled = false;
  renderTodos();

  if (deletedTodos.length) {
    offerUndo(deletedTodos, `완료한 할 일 ${deletedTodos.length}개를 삭제했습니다.`);
  }

  if (failedCount) {
    showStatus(`${failedCount}개 항목을 삭제하지 못했습니다.`, { error: true });
  }
}

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const content = todoInput.value.trim();
  const deadline = parseDeadline(deadlineInput.value);

  if (!content) {
    showStatus("할 일 내용을 입력해 주세요.", { error: true });
    todoInput.focus();
    return;
  }

  if (deadline === undefined) {
    showStatus("마감기한을 올바르게 입력해 주세요.", { error: true });
    deadlineInput.focus();
    return;
  }

  addButton.disabled = true;
  addLabel.textContent = "추가 중…";
  todoInput.disabled = true;
  deadlineInput.disabled = true;
  priorityInput.disabled = true;

  try {
    const newTodo = await request(API_URL, {
      method: "POST",
      body: JSON.stringify({
        content,
        deadline,
        priority: priorityInput.value || null,
        completed: false,
      }),
    });
    todoForm.reset();
    currentTodos = [normalizeTodo(newTodo), ...currentTodos];
    renderTodos();
    showStatus("새 할 일이 추가되었습니다.");
  } catch (error) {
    showStatus(error.message, { error: true });
    console.error(error);
  } finally {
    addButton.disabled = false;
    addLabel.textContent = "할 일 추가";
    todoInput.disabled = false;
    deadlineInput.disabled = false;
    priorityInput.disabled = false;
    todoInput.focus();
  }
});

onValue(
  todosRef,
  (snapshot) => {
    const savedTodos = snapshot.val() ?? {};
    currentTodos = Object.entries(savedTodos).map(([id, todo]) =>
      normalizeTodo(toClientTodo(id, todo)),
    );
    renderTodos();
    updateLastSyncTime();
    setConnectionState(true);
  },
  (error) => {
    setConnectionState(false);
    showStatus("Firebase에서 할 일을 불러오지 못했습니다.", { error: true });
    console.error(error);
  },
);

syncButton.addEventListener("click", async () => {
  if (document.querySelector(".edit-fields")) {
    showStatus("수정을 완료하거나 취소한 후 동기화해 주세요.", {
      error: true,
    });
    return;
  }

  const refreshed = await loadTodos({ silent: true, manual: true });
  if (refreshed) showStatus("최신 목록으로 새로고침했습니다.");
});

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLocaleLowerCase("ko-KR");
  renderTodos();
});

searchClearButton.addEventListener("click", () => {
  searchInput.value = "";
  searchQuery = "";
  renderTodos();
  searchInput.focus();
});

sortSelect.addEventListener("change", () => {
  sortMode = sortSelect.value;
  renderTodos();
});

deadlineFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const selectedFilter = button.dataset.deadlineFilter;
    deadlineFilter = deadlineFilter === selectedFilter ? "all" : selectedFilter;
    currentFilter = "active";
    renderTodos();
  });
});

connectionRetryButton.addEventListener("click", async () => {
  connectionRetryButton.disabled = true;
  connectionRetryButton.textContent = "연결 중…";
  const connected = await loadTodos({ silent: true, manual: true });
  if (connected) showStatus("백엔드 서버에 다시 연결했습니다.");
});

clearCompletedButton.addEventListener("click", deleteCompletedTodos);
undoButton.addEventListener("click", undoLastDelete);

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    deadlineFilter = "all";
    renderTodos();
  });
});


}

startApp().catch((error) => {
  const statusMessage = document.querySelector("#status");
  const connectionBanner = document.querySelector("#connection-banner");
  if (connectionBanner) connectionBanner.hidden = false;
  statusMessage.textContent =
    "Firebase 연결에 실패했습니다. 인터넷 연결과 Firebase 설정을 확인해 주세요.";
  statusMessage.classList.add("error");
  console.error(error);
});
