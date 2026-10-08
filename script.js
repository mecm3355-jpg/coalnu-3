import { initializeApp } from "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js";
import {
  getDatabase,
  onValue,
  push,
  ref,
  remove,
  serverTimestamp,
  set,
  update,
} from "https://www.gstatic.com/firebasejs/13.0.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyCirR2CstlC0D6yTdpCS4XvvHBC3CUf4ns",
  authDomain: "coalnu-3-revised.firebaseapp.com",
  projectId: "coalnu-3-revised",
  storageBucket: "coalnu-3-revised.firebasestorage.app",
  messagingSenderId: "877881696953",
  appId: "1:877881696953:web:8ce2f60bd30943b4183168",
  databaseURL: "https://coalnu-3-revised-default-rtdb.firebaseio.com/",
};

const PRIORITIES = {
  high: { label: "높음", order: 3, remindBefore: 24 * 60 * 60 * 1000 },
  medium: { label: "보통", order: 2, remindBefore: 6 * 60 * 60 * 1000 },
  low: { label: "낮음", order: 1, remindBefore: 60 * 60 * 1000 },
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const todosRef = ref(db, "todos");

const todoForm = document.querySelector("#todo-form");
const todoInput = document.querySelector("#todo-input");
const deadlineInput = document.querySelector("#deadline-input");
const priorityInput = document.querySelector("#priority-input");
const todoList = document.querySelector("#todo-list");
const statusMessage = document.querySelector("#status");
const alerts = document.querySelector("#alerts");
const alertList = document.querySelector("#alert-list");
const todoCount = document.querySelector("#todo-count");
const urgentCount = document.querySelector("#urgent-count");
const todayDate = document.querySelector("#today-date");
const addButton = todoForm.querySelector(".add-button");

let currentTodos = [];

todayDate.dateTime = new Date().toISOString().slice(0, 10);
todayDate.textContent = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
}).format(new Date());

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

function normalizeTodo(id, data) {
  const priority = PRIORITIES[data.priority] ? data.priority : "medium";

  return {
    id,
    text: data.text ?? "제목 없는 할 일",
    completed: Boolean(data.completed),
    priority,
    deadline: typeof data.deadline === "number" ? data.deadline : null,
    createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
  };
}

function sortTodos(todos) {
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);

    const priorityDifference =
      PRIORITIES[b.priority].order - PRIORITIES[a.priority].order;
    if (priorityDifference) return priorityDifference;

    const aDeadline = a.deadline ?? Number.POSITIVE_INFINITY;
    const bDeadline = b.deadline ?? Number.POSITIVE_INFINITY;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    return b.createdAt - a.createdAt;
  });
}

function getUrgency(todo, now = Date.now()) {
  if (todo.completed || !todo.deadline) return "normal";

  const remaining = todo.deadline - now;
  if (remaining <= 0) return "overdue";
  if (remaining <= PRIORITIES[todo.priority].remindBefore) return "due-soon";
  return "normal";
}

function formatDeadline(timestamp) {
  if (!timestamp) return "마감 없음";

  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function toDateTimeLocal(timestamp) {
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(timestamp - offset).toISOString().slice(0, 16);
}

function createTodoElement(todo) {
  const urgency = getUrgency(todo);
  const item = document.createElement("li");
  const main = document.createElement("div");
  const title = document.createElement("label");
  const checkbox = document.createElement("input");
  const text = document.createElement("span");
  const meta = document.createElement("p");
  const priorityBadge = document.createElement("span");
  const deadline = document.createElement("span");
  const actions = document.createElement("div");
  const editButton = document.createElement("button");
  const deleteButton = document.createElement("button");

  item.className = [
    "todo-item",
    `priority-${todo.priority}`,
    todo.completed ? "completed" : "",
    urgency,
  ]
    .filter(Boolean)
    .join(" ");
  item.dataset.id = todo.id;

  main.className = "todo-main";
  title.className = "todo-title";
  meta.className = "todo-meta";
  priorityBadge.className = "priority-badge";
  actions.className = "item-actions";

  checkbox.type = "checkbox";
  checkbox.checked = todo.completed;
  checkbox.setAttribute("aria-label", `${todo.text} 완료 여부`);
  text.textContent = todo.text;
  priorityBadge.textContent = PRIORITIES[todo.priority].label;
  deadline.textContent = `${formatDeadline(todo.deadline)}${
    urgency === "overdue" ? " · 마감 지남" : urgency === "due-soon" ? " · 마감 임박" : ""
  }`;

  editButton.type = "button";
  editButton.className = "edit-button";
  editButton.textContent = "수정";

  deleteButton.type = "button";
  deleteButton.className = "delete-button";
  deleteButton.textContent = "삭제";

  checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;

    try {
      await update(ref(db, `todos/${todo.id}`), {
        completed: checkbox.checked,
      });
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      checkbox.disabled = false;
      showStatus("완료 상태를 저장하지 못했습니다.", true);
      console.error(error);
    }
  });

  editButton.addEventListener("click", () => startEditing(item, todo));

  deleteButton.addEventListener("click", async () => {
    deleteButton.disabled = true;

    try {
      await remove(ref(db, `todos/${todo.id}`));
    } catch (error) {
      deleteButton.disabled = false;
      showStatus("할 일을 삭제하지 못했습니다.", true);
      console.error(error);
    }
  });

  title.append(checkbox, text);
  meta.append(priorityBadge, deadline);
  main.append(title, meta);
  actions.append(editButton, deleteButton);
  item.append(main, actions);

  return item;
}

function createPrioritySelect(selectedPriority) {
  const select = document.createElement("select");

  Object.entries(PRIORITIES).forEach(([value, config]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = config.label;
    option.selected = value === selectedPriority;
    select.append(option);
  });

  return select;
}

function startEditing(item, todo) {
  const editFields = document.createElement("div");
  const editOptions = document.createElement("div");
  const textInput = document.createElement("input");
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
  editOptions.className = "edit-options";
  actions.className = "item-actions";

  textInput.value = todo.text;
  textInput.maxLength = 100;
  textInput.setAttribute("aria-label", "할 일 수정");

  deadlineLabelText.textContent = "마감기한";
  editDeadline.type = "datetime-local";
  editDeadline.value = toDateTimeLocal(todo.deadline);

  priorityLabelText.textContent = "우선순위";

  saveButton.type = "button";
  saveButton.className = "save-button";
  saveButton.textContent = "저장";

  cancelButton.type = "button";
  cancelButton.className = "edit-button";
  cancelButton.textContent = "취소";

  async function saveEdit() {
    const newText = textInput.value.trim();
    const newDeadline = editDeadline.value
      ? new Date(editDeadline.value).getTime()
      : null;

    if (!newText) {
      textInput.focus();
      return;
    }

    saveButton.disabled = true;
    textInput.disabled = true;
    editDeadline.disabled = true;
    editPriority.disabled = true;

    try {
      await update(ref(db, `todos/${todo.id}`), {
        text: newText,
        deadline: newDeadline,
        priority: editPriority.value,
      });
    } catch (error) {
      saveButton.disabled = false;
      textInput.disabled = false;
      editDeadline.disabled = false;
      editPriority.disabled = false;
      showStatus("수정한 내용을 저장하지 못했습니다.", true);
      console.error(error);
    }
  }

  saveButton.addEventListener("click", saveEdit);
  cancelButton.addEventListener("click", renderTodos);
  textInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") saveEdit();
    if (event.key === "Escape") renderTodos();
  });

  deadlineLabel.append(deadlineLabelText, editDeadline);
  priorityLabel.append(priorityLabelText, editPriority);
  editOptions.append(deadlineLabel, priorityLabel);
  editFields.append(textInput, editOptions);
  actions.append(saveButton, cancelButton);
  item.replaceChildren(editFields, actions);
  textInput.focus();
  textInput.select();
}

function renderTodos() {
  const sortedTodos = sortTodos(currentTodos);
  const activeTodoCount = sortedTodos.filter((todo) => !todo.completed).length;

  todoList.replaceChildren(...sortedTodos.map(createTodoElement));
  todoCount.textContent = activeTodoCount;
  showStatus(sortedTodos.length ? "" : "등록된 할 일이 없습니다.");
}

function renderAlerts() {
  const alertTodos = sortTodos(currentTodos).filter(
    (todo) => getUrgency(todo) !== "normal",
  );

  alerts.hidden = alertTodos.length === 0;
  urgentCount.textContent = alertTodos.length;
  alertList.replaceChildren(
    ...alertTodos.map((todo) => {
      const item = document.createElement("li");
      const urgencyText = getUrgency(todo) === "overdue" ? "마감 지남" : "마감 임박";
      item.textContent = `[${PRIORITIES[todo.priority].label}] ${todo.text} — ${urgencyText} (${formatDeadline(todo.deadline)})`;
      return item;
    }),
  );
}

function refreshDeadlineState() {
  renderAlerts();

  currentTodos.forEach((todo) => {
    const item = todoList.querySelector(`[data-id="${CSS.escape(todo.id)}"]`);
    if (!item) return;

    item.classList.remove("normal", "due-soon", "overdue");
    item.classList.add(getUrgency(todo));
  });
}

todoForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const text = todoInput.value.trim();
  const deadline = new Date(deadlineInput.value).getTime();

  if (!text || Number.isNaN(deadline)) return;

  addButton.disabled = true;
  todoInput.disabled = true;
  deadlineInput.disabled = true;
  priorityInput.disabled = true;

  try {
    const newTodoRef = push(todosRef);
    await set(newTodoRef, {
      text,
      deadline,
      priority: priorityInput.value,
      completed: false,
      createdAt: serverTimestamp(),
    });
    todoForm.reset();
    priorityInput.value = "medium";
    showStatus("");
  } catch (error) {
    showStatus("할 일을 저장하지 못했습니다.", true);
    console.error(error);
  } finally {
    addButton.disabled = false;
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
      normalizeTodo(id, todo),
    );

    renderTodos();
    renderAlerts();
  },
  (error) => {
    showStatus(
      "할 일을 불러오지 못했습니다. Realtime Database 보안 규칙을 확인해 주세요.",
      true,
    );
    console.error(error);
  },
);

setInterval(refreshDeadlineState, 60 * 1000);
