async function startApp() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/13.0.0/firebase-app.js"
  );
  const {
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
  const PRIORITIES = {
    high: { label: "높음", order: 3 },
    medium: { label: "보통", order: 2 },
    low: { label: "낮음", order: 1 },
  };

  const todoForm = document.querySelector("#todo-form");
  const todoInput = document.querySelector("#todo-input");
  const deadlineInput = document.querySelector("#deadline-input");
  const priorityInput = document.querySelector("#priority-input");
  const todoList = document.querySelector("#todo-list");
  const statusMessage = document.querySelector("#status");
  const todoCount = document.querySelector("#todo-count");
  const todayDate = document.querySelector("#today-date");
  const addButton = todoForm.querySelector(".add-button");

  let currentTodos = [];
  let statusTimer;

  todayDate.dateTime = new Date().toISOString().slice(0, 10);
  todayDate.textContent = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date());

  function showStatus(message, isError = false, isEmptyState = false) {
    clearTimeout(statusTimer);
    statusMessage.textContent = message;
    statusMessage.classList.remove("loading");
    statusMessage.classList.toggle("error", isError);
    statusMessage.classList.toggle("empty-state", isEmptyState);

    if (message && !isError && !isEmptyState) {
      statusTimer = setTimeout(() => {
        if (statusMessage.textContent === message) showStatus("");
      }, 2400);
    }
  }

  function normalizeTodo(id, data) {
    const priority = PRIORITIES[data.priority] ? data.priority : "medium";

    return {
      id,
      text: data.text ?? "제목 없는 할 일",
      completed: Boolean(data.completed ?? data.done),
      deadline: typeof data.deadline === "number" ? data.deadline : null,
      priority,
      createdAt: typeof data.createdAt === "number" ? data.createdAt : 0,
    };
  }

  function sortTodos(todos) {
    return [...todos].sort((a, b) => {
      if (a.completed !== b.completed) {
        return Number(a.completed) - Number(b.completed);
      }

      const priorityDifference =
        PRIORITIES[b.priority].order - PRIORITIES[a.priority].order;
      if (priorityDifference) return priorityDifference;

      const aDeadline = a.deadline ?? Number.POSITIVE_INFINITY;
      const bDeadline = b.deadline ?? Number.POSITIVE_INFINITY;
      if (aDeadline !== bDeadline) return aDeadline - bDeadline;

      return b.createdAt - a.createdAt;
    });
  }

  function parseDeadline(value) {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  function toDateTimeLocal(timestamp) {
    if (!timestamp) return "";

    const date = new Date(timestamp);
    const offset = date.getTimezoneOffset() * 60 * 1000;
    return new Date(timestamp - offset).toISOString().slice(0, 16);
  }

  function formatDeadline(timestamp) {
    if (!timestamp) return "마감 없음";

    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  }

  function isOverdue(todo) {
    return Boolean(!todo.completed && todo.deadline && todo.deadline < Date.now());
  }

  function createTodoElement(todo) {
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
      isOverdue(todo) ? "overdue" : "",
    ]
      .filter(Boolean)
      .join(" ");
    item.dataset.id = todo.id;
    main.className = "todo-main";
    title.className = "todo-title";
    meta.className = "todo-meta";
    priorityBadge.className = "priority-badge";
    deadline.className = `deadline-text${isOverdue(todo) ? " overdue-text" : ""}`;
    actions.className = "item-actions";

    checkbox.type = "checkbox";
    checkbox.checked = todo.completed;
    checkbox.setAttribute("aria-label", `${todo.text} 완료 여부`);
    text.textContent = todo.text;
    priorityBadge.textContent = PRIORITIES[todo.priority].label;
    deadline.textContent = `${formatDeadline(todo.deadline)}${
      isOverdue(todo) ? " · 기한 지남" : ""
    }`;

    editButton.type = "button";
    editButton.className = "edit-button";
    editButton.textContent = "내용 수정";
    editButton.setAttribute("aria-label", `${todo.text} 내용 수정`);

    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "삭제";
    deleteButton.setAttribute("aria-label", `${todo.text} 삭제`);

    checkbox.addEventListener("change", async () => {
      checkbox.disabled = true;

      try {
        await update(ref(db, `todos/${todo.id}`), {
          completed: checkbox.checked,
        });
        showStatus("완료 상태가 저장되었습니다.");
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
        showStatus("할 일이 삭제되었습니다.");
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
    editInput.value = todo.text;
    editInput.maxLength = 100;
    editInput.setAttribute("aria-label", "할 일 수정");
    editOptions.className = "edit-options";
    actions.className = "item-actions";

    deadlineLabelText.textContent = "마감기한 (선택)";
    editDeadline.type = "datetime-local";
    editDeadline.value = toDateTimeLocal(todo.deadline);

    priorityLabelText.textContent = "우선순위";

    saveButton.type = "button";
    saveButton.className = "save-button";
    saveButton.textContent = "수정 완료";

    cancelButton.type = "button";
    cancelButton.className = "edit-button";
    cancelButton.textContent = "수정 취소";

    async function saveEdit() {
      const newText = editInput.value.trim();
      const newDeadline = parseDeadline(editDeadline.value);

      if (!newText) {
        editInput.focus();
        return;
      }

      if (editDeadline.value && newDeadline === null) {
        showStatus("마감기한을 올바르게 입력해 주세요.", true);
        editDeadline.focus();
        return;
      }

      saveButton.disabled = true;
      editInput.disabled = true;
      editDeadline.disabled = true;
      editPriority.disabled = true;

      try {
        await update(ref(db, `todos/${todo.id}`), {
          text: newText,
          deadline: newDeadline,
          priority: editPriority.value,
        });
        showStatus("수정 내용이 저장되었습니다.");
      } catch (error) {
        saveButton.disabled = false;
        editInput.disabled = false;
        editDeadline.disabled = false;
        editPriority.disabled = false;
        showStatus("수정한 내용을 저장하지 못했습니다.", true);
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

  function renderTodos() {
    const sortedTodos = sortTodos(currentTodos);
    const activeTodoCount = sortedTodos.filter((todo) => !todo.completed).length;

    todoList.replaceChildren(...sortedTodos.map(createTodoElement));
    todoCount.textContent = activeTodoCount;

    if (!sortedTodos.length) {
      showStatus(
        "아직 등록된 할 일이 없습니다. 첫 할 일을 추가해 보세요.",
        false,
        true,
      );
    } else if (statusMessage.textContent === "할 일을 불러오는 중...") {
      showStatus("");
    }
  }

  todoForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const text = todoInput.value.trim();
    const deadline = parseDeadline(deadlineInput.value);

    if (!text) {
      todoInput.focus();
      return;
    }

    if (deadlineInput.value && deadline === null) {
      showStatus("마감기한을 올바르게 입력해 주세요.", true);
      deadlineInput.focus();
      return;
    }

    addButton.disabled = true;
    todoInput.disabled = true;
    deadlineInput.disabled = true;
    priorityInput.disabled = true;

    try {
      const newTodoRef = push(todosRef);
      await set(newTodoRef, {
        text,
        completed: false,
        deadline,
        priority: priorityInput.value,
        createdAt: serverTimestamp(),
      });
      todoForm.reset();
      priorityInput.value = "medium";
      showStatus("할 일이 추가되었습니다.");
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
    },
    (error) => {
      showStatus(
        "할 일을 불러오지 못했습니다. Realtime Database 설정을 확인해 주세요.",
        true,
      );
      console.error(error);
    },
  );
}

startApp().catch((error) => {
  const statusMessage = document.querySelector("#status");
  statusMessage.textContent = "Firebase 연결에 실패했습니다. 인터넷 연결을 확인해 주세요.";
  statusMessage.classList.add("error");
  console.error(error);
});
