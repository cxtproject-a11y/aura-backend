console.log("🚀 NOVA VERSÃO ATIVA 7.3");

// 🔥 CAPTURA ERROS GLOBAIS
process.on("uncaughtException", (err) => {
  console.log("💥 ERRO NÃO TRATADO:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("💥 PROMISE ERROR:", err);
});

// =============================
// 📦 IMPORTS
// =============================
import express from "express";
import cors from "cors";
import { searchDuck } from "./search.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// =============================
// 🔥 FIREBASE (LAZY LOAD)
// =============================
let db = null;

async function getDB() {
  if (!db) {
    try {
      console.log("🔥 Tentando carregar Firebase...");
      const firebase = await import("./firebase.js");
      db = firebase.db;
      console.log("🔥 Firebase carregado");
    } catch (e) {
      console.log("❌ ERRO FIREBASE:", e);
      throw e;
    }
  }
  return db;
}

// =============================
// 🧠 HELPERS
// =============================
function getLastUserMessage(messages) {
  return [...messages].reverse().find(m => m.role === "user");
}

function shouldSearch(messages) {
  const lastUserMessage = getLastUserMessage(messages);
  if (!lastUserMessage) return false;

  const text = lastUserMessage.content.toLowerCase().trim();

  const simples = ["oi","olá","ola","hey","eai","bom dia","boa tarde","boa noite"];
  if (simples.includes(text)) return false;

  const triggers = [
    "quanto","qual","quem","quando",
    "preço","valor","dólar","bitcoin",
    "notícia","hoje","agora"
  ];

  return triggers.some(t => text.includes(t));
}

// =============================
// 🌐 ROTA TESTE
// =============================
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// =============================
// 🗄️ MEMÓRIA (FIRESTORE)
// =============================
async function loadUserMemory(userId) {
  try {
    const db = await getDB();
    const doc = await db.collection("chats").doc(userId).get();

    if (!doc.exists) return [];

    const data = doc.data();

    // 🔥 CORREÇÃO PRINCIPAL AQUI
    if (Array.isArray(data.messages)) return data.messages;
    if (Array.isArray(data.chats)) return data.chats;

    return [];

  } catch (e) {
    console.log("❌ ERRO LOAD MEMORY:", e);
    return [];
  }
}

async function saveUserMemory(userId, messages) {
  try {
    const db = await getDB();

    await db.collection("chats").doc(userId).set({
      messages: messages
    });

  } catch (e) {
    console.log("❌ ERRO SAVE MEMORY:", e);
  }
}

// =============================
// 💬 CHAT
// =============================
app.post("/chat", async (req, res) => {

  let { userId, messages, message } = req.body;

  if (!userId) {
    return res.status(400).send("❌ userId obrigatório.");
  }

  // 🔥 aceita message simples
  if (!messages && message) {
    messages = [
      { role: "user", content: message }
    ];
  }

  if (!Array.isArray(messages)) {
    return res.status(400).send("❌ messages inválido.");
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).send("❌ API KEY não configurada.");
  }

  try {

    let userHistory = await loadUserMemory(userId);

    if (!Array.isArray(userHistory)) {
      userHistory = [];
    }

    userHistory = [...userHistory, ...messages];
    userHistory = userHistory.slice(-10);

    const lastUser = getLastUserMessage(messages);
    const lastUserMessage = lastUser?.content;

    console.log("📩 Última mensagem:", lastUserMessage);

    let finalMessages = [...userHistory];

    // 🔍 BUSCA
    if (shouldSearch(messages)) {

      console.log("🔎 Buscando...");

      const results = await searchDuck(lastUserMessage);

      if (results && results.length > 0) {

        const context = results.map(r =>
          `${r.title}: ${r.snippet}`
        ).join("\n\n");

        finalMessages.unshift({
          role: "system",
          content: `Use os dados abaixo se relevantes:\n\n${context}`
        });

      } else {
        console.log("⚠️ Sem resultados de busca");
      }
    }

    // 🤖 IA
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: finalMessages
      })
    });

    const data = await response.json();

    console.log("🤖 IA:", JSON.stringify(data));

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      reply = data?.error?.message
        ? "❌ IA erro: " + data.error.message
        : "⚠️ IA não respondeu.";
    }

    // 🔥 salva resposta
    userHistory.push({
      role: "assistant",
      content: reply
    });

    await saveUserMemory(userId, userHistory);

    res.send(reply);

  } catch (err) {
    console.log("❌ ERRO BACKEND:", err);
    res.status(500).send("Erro no servidor.");
  }
});

// =============================
// 🚀 START
// =============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend rodando na porta ${PORT}`);
});