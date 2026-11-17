const path = require("node:path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;
const MAX_QUESTIONS = 6;

// The truth lives only on the server. `isAI` must never leave this file.
const SUSPECTS = [
  {
    id: "vera",
    name: "Dr. Vera Lumen",
    bio: "A robotics researcher who built the lab's service droids. Speaks in careful, measured sentences.",
    isAI: false,
  },
  {
    id: "milo",
    name: "Milo Park",
    bio: "A freelance journalist covering the lab's AI program. Nervous, friendly, and prone to over-explaining.",
    isAI: false,
  },
  {
    id: "nia",
    name: "Nia Sol",
    bio: "The lab's archivist. Knows every file by heart, never uses contractions, and is always suspiciously calm.",
    isAI: true,
  },
];

// Mock replies - one short canned answer is picked per question for now.
const REPLIES = {
  vera: [
    "I trust machines to do exactly what they are told. People are the unpredictable part.",
    "My droids can clean a lab, but they cannot lie about it. That is still a human skill.",
    "Ask me something technical. Feelings are not my department.",
  ],
  milo: [
    "I just write about the lab. I do not know what half of those servers actually do.",
    "Honestly? Everyone here is a little strange. That is why I took the assignment.",
    "Wait, is this an interview? I thought I was the one asking the questions.",
  ],
  nia: [
    "I have reviewed every file in the archive. I remember all of them.",
    "That is an interesting question. I do not experience boredom, so I do not mind repeating myself.",
    "I am unable to confirm that. My records indicate only that the archive is complete.",
  ],
};

// One game in memory, suitable for a single-player local game.
let game = newGame();

function newGame() {
  return { questionsLeft: MAX_QUESTIONS, over: false };
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Fetching the suspects starts (or restarts) a game.
app.get("/suspects", (req, res) => {
  game = newGame();

  res.json({
    suspects: SUSPECTS.map(({ id, name, bio }) => ({ id, name, bio })),
    questionsLeft: game.questionsLeft,
  });
});

app.post("/chat", (req, res) => {
  const { suspectId, question } = req.body || {};

  if (game.over) {
    return res
      .status(400)
      .json({ error: "This game is over. Make an accusation or start a new game." });
  }

  if (game.questionsLeft <= 0) {
    return res
      .status(400)
      .json({ error: "No questions left. Time to accuse someone.", questionsLeft: 0 });
  }

  const suspect = SUSPECTS.find((candidate) => candidate.id === suspectId);
  if (!suspect) {
    return res.status(404).json({ error: "Unknown suspect." });
  }

  if (typeof question !== "string" || question.trim() === "") {
    return res.status(400).json({ error: "Ask a question first." });
  }

  game.questionsLeft -= 1;

  const options = REPLIES[suspect.id];
  const reply = options[Math.floor(Math.random() * options.length)];

  res.json({ reply, questionsLeft: game.questionsLeft });
});

app.post("/accuse", (req, res) => {
  const { suspectId } = req.body || {};

  if (game.over) {
    return res.status(400).json({ error: "This game is already over." });
  }

  const accused = SUSPECTS.find((candidate) => candidate.id === suspectId);
  if (!accused) {
    return res.status(404).json({ error: "Unknown suspect." });
  }

  const ai = SUSPECTS.find((candidate) => candidate.isAI);
  const correct = accused.id === ai.id;
  game.over = true;

  res.json({
    correct,
    aiSuspect: { id: ai.id, name: ai.name },
    message: correct
      ? `You got it: ${ai.name} was the AI.`
      : `Wrong call. ${accused.name} was human - ${ai.name} was the AI.`,
    questionsLeft: game.questionsLeft,
  });
});

app.listen(PORT, () => {
  console.log(`Game running at http://localhost:${PORT}`);
});
