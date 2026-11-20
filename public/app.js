const MAX_QUESTIONS = 12;

const state = {
  suspects: [],
  selectedId: null,
  histories: {},
  questionsLeft: MAX_QUESTIONS,
  over: false,
  busy: false,
};

const caseTitleEl = document.getElementById("case-title");
const caseBriefEl = document.getElementById("case-brief");
const suspectsEl = document.getElementById("suspects");
const questionsLeftEl = document.getElementById("questions-left");
const chatTitleEl = document.getElementById("chat-title");
const chatLogEl = document.getElementById("chat-log");
const chatFormEl = document.getElementById("chat-form");
const questionInputEl = document.getElementById("question-input");
const askButtonEl = document.getElementById("ask-button");
const resultEl = document.getElementById("result");
const restartEl = document.getElementById("restart");

function updateHud() {
  const remaining = Math.max(0, state.questionsLeft);
  questionsLeftEl.textContent =
    remaining === 1 ? "1 question left" : `${remaining} questions left`;
  questionsLeftEl.classList.toggle("empty", remaining === 0);
}

function updateControls() {
  const canTalk =
    !state.over &&
    !state.busy &&
    Boolean(state.selectedId) &&
    state.questionsLeft > 0;

  questionInputEl.disabled = !canTalk;
  askButtonEl.disabled = !canTalk;

  document.querySelectorAll(".accuse").forEach((button) => {
    button.disabled = state.over || state.busy;
  });
}

function renderSuspects() {
  suspectsEl.replaceChildren();

  for (const suspect of state.suspects) {
    const card = document.createElement("article");
    card.className = "suspect-card";
    card.dataset.id = suspect.id;
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", `Question ${suspect.name}`);

    card.addEventListener("click", () => selectSuspect(suspect.id));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        selectSuspect(suspect.id);
      }
    });

    const name = document.createElement("h2");
    name.textContent = suspect.name;

    const bio = document.createElement("p");
    bio.className = "bio";
    bio.textContent = suspect.bio;

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const accuseButton = document.createElement("button");
    accuseButton.type = "button";
    accuseButton.className = "accuse";
    accuseButton.textContent = "Accuse";
    accuseButton.addEventListener("click", (event) => {
      event.stopPropagation();
      accuse(suspect.id);
    });

    actions.append(accuseButton);
    card.append(name, bio, actions);
    suspectsEl.append(card);
  }
}

function selectSuspect(id) {
  if (state.over || state.busy) {
    return;
  }

  const suspect = state.suspects.find((candidate) => candidate.id === id);
  if (!suspect) {
    return;
  }

  state.selectedId = id;
  chatTitleEl.textContent = `Interrogation room - ${suspect.name}`;

  document.querySelectorAll(".suspect-card").forEach((card) => {
    card.classList.toggle("selected", card.dataset.id === id);
  });

  renderChat();
  updateControls();
  questionInputEl.focus();
}

function renderChat() {
  chatLogEl.replaceChildren();

  if (!state.selectedId) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "Select a suspect to begin.";
    chatLogEl.append(placeholder);
    return;
  }

  const history = state.histories[state.selectedId] || [];
  if (history.length === 0) {
    const placeholder = document.createElement("p");
    placeholder.className = "placeholder";
    placeholder.textContent = "Ask your first question.";
    chatLogEl.append(placeholder);
    return;
  }

  for (const message of history) {
    const bubble = document.createElement("div");
    bubble.className = `bubble ${message.role}`;
    bubble.textContent = message.text;
    chatLogEl.append(bubble);
  }

  chatLogEl.scrollTop = chatLogEl.scrollHeight;
}

function addMessage(suspectId, role, text) {
  if (!state.histories[suspectId]) {
    state.histories[suspectId] = [];
  }

  state.histories[suspectId].push({ role, text });

  if (state.selectedId === suspectId) {
    renderChat();
  }
}

async function loadGame() {
  state.suspects = [];
  state.selectedId = null;
  state.histories = {};
  state.questionsLeft = MAX_QUESTIONS;
  state.over = false;
  state.busy = false;

  caseTitleEl.textContent = "";
  caseBriefEl.textContent = "";
  suspectsEl.replaceChildren();
  questionInputEl.value = "";
  resultEl.className = "result hidden";
  resultEl.replaceChildren();
  restartEl.classList.add("hidden");
  chatTitleEl.textContent = "Interrogation room";
  chatLogEl.innerHTML = '<p class="placeholder">Loading suspects...</p>';
  updateHud();
  updateControls();

  try {
    const response = await fetch("/suspects");
    if (!response.ok) {
      throw new Error("Could not load the suspects.");
    }

    const data = await response.json();
    state.suspects = data.suspects;
    state.questionsLeft = data.questionsLeft ?? MAX_QUESTIONS;
    caseTitleEl.textContent = data.caseTitle ?? "";
    caseBriefEl.textContent = data.caseBrief ?? "";

    for (const suspect of state.suspects) {
      state.histories[suspect.id] = [];
    }

    renderSuspects();
    renderChat();
    updateHud();
    updateControls();
  } catch (error) {
    chatLogEl.replaceChildren();
    const message = document.createElement("p");
    message.className = "placeholder";
    message.textContent = error.message;
    chatLogEl.append(message);
  }
}

async function askQuestion(question) {
  const suspectId = state.selectedId;
  if (!suspectId) {
    return;
  }

  state.busy = true;
  questionInputEl.value = "";
  addMessage(suspectId, "player", question);
  updateControls();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspectId, question }),
    });
    const data = await response.json();

    if (!response.ok) {
      addMessage(suspectId, "system", data.error || "Something went wrong.");
      return;
    }

    state.questionsLeft = data.questionsLeft;
    addMessage(suspectId, "suspect", data.reply);

    if (state.questionsLeft === 0) {
      addMessage(suspectId, "system", "No questions left. Make your accusation.");
    }
  } catch (error) {
    addMessage(suspectId, "system", "The connection failed. Try again.");
  } finally {
    state.busy = false;
    updateHud();
    updateControls();

    if (!questionInputEl.disabled) {
      questionInputEl.focus();
    }
  }
}

async function accuse(suspectId) {
  if (state.over || state.busy) {
    return;
  }

  selectSuspect(suspectId);
  state.busy = true;
  updateControls();

  try {
    const response = await fetch("/accuse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ suspectId }),
    });
    const data = await response.json();

    if (!response.ok) {
      addMessage(suspectId, "system", data.error || "Something went wrong.");
      return;
    }

    state.over = true;
    state.questionsLeft = data.questionsLeft ?? state.questionsLeft;
    state.selectedId = null;

    const accused = state.suspects.find((candidate) => candidate.id === suspectId);
    revealResult(data, accused);
  } catch (error) {
    addMessage(suspectId, "system", "The connection failed. Try again.");
  } finally {
    state.busy = false;
    updateHud();
    updateControls();
  }
}

function revealResult(data, accused) {
  const aiId = data.aiSuspect.id;

  chatTitleEl.textContent = "Case closed";

  document.querySelectorAll(".suspect-card").forEach((card) => {
    const id = card.dataset.id;

    if (id === accused.id) {
      card.classList.add("accused");
    }

    if (id === aiId) {
      card.classList.add("is-ai");

      const badge = document.createElement("span");
      badge.className = "reveal-badge";
      badge.textContent = "THE A.I.";
      card.append(badge);
    }
  });

  resultEl.replaceChildren();

  const title = document.createElement("h2");
  title.textContent = data.correct ? "You win!" : "You lose.";

  const message = document.createElement("p");
  message.textContent = data.message;

  resultEl.append(title, message);
  resultEl.className = `result ${data.correct ? "win" : "lose"}`;
  restartEl.classList.remove("hidden");
}

chatFormEl.addEventListener("submit", (event) => {
  event.preventDefault();

  if (state.busy || state.over || !state.selectedId || state.questionsLeft <= 0) {
    return;
  }

  const question = questionInputEl.value.trim();
  if (!question) {
    return;
  }

  askQuestion(question);
});

restartEl.addEventListener("click", loadGame);

loadGame();
