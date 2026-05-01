console.log("🚀 BACKEND AURA V10.0");

// =============================
// 🔥 ERROS GLOBAIS
// =============================
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
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

// 🔔 FIREBASE ADMIN (ENV)
import admin from "firebase-admin";

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const app = express();

app.use(cors());
app.use(express.json());

// =============================
// 🔑 API KEY
// =============================
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

console.log("🔑 KEY:", OPENROUTER_API_KEY ? "OK" : "❌ NÃO DEFINIDA");

// =============================
// 🔥 FIREBASE (LAZY)
// =============================
let db = null;

async function getDB() {
  if (!db) {
    console.log("🔥 Carregando Firebase...");
    const firebase = await import("./firebase.js");
    db = firebase.db;
    console.log("✅ Firebase conectado");
  }
  return db;
}

// =============================
// 🔔 NOTIFICAÇÃO
// =============================
async function enviarNotificacao(token, titulo, mensagem) {
  try {
    await admin.messaging().send({
      token: token,
      notification: {
        title: titulo,
        body: mensagem
      }
    });
    console.log("🔔 Notificação enviada");
  } catch (e) {
    console.log("❌ Erro notificação:", e);
  }
}

// =============================
// 🧠 HELPERS
// =============================
function getLastUserMessage(messages) {
  return [...messages].reverse().find(m => m.role === "user");
}

function shouldSearch(messages) {
  const last = getLastUserMessage(messages);
  if (!last) return false;

  const text = (last.content || "").toLowerCase();

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
// 🔥 NORMALIZAÇÃO
// =============================
function normalizeMessages(messages) {
  return messages
    .filter(m => m && typeof m === "object")
    .map(m => ({
      role: m.role || "user",
      content: String(m.content || "")
    }))
    .filter(m => m.content.trim().length > 0);
}

// =============================
// 🌐 TESTE
// =============================
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// =============================
// 🗄️ MEMÓRIA
// =============================
async function loadUserMemory(userId) {
  try {
    const db = await getDB();
    const doc = await db.collection("chats").doc(userId).get();

    if (!doc.exists) return [];

    const data = doc.data();

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
// 🤖 IA
// =============================
async function callAI(messages) {

  const models = [
    "openai/gpt-3.5-turbo",
    "openai/gpt-4o-mini",
    "mistralai/mistral-7b-instruct"
  ];

  for (let model of models) {

    try {
      console.log("🤖 Tentando modelo:", model);

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: model,
          messages: messages
        })
      });

      const data = await response.json();

      if (data?.error) continue;

      const reply = data?.choices?.[0]?.message?.content;

      if (reply && reply.trim().length > 0) {
        return reply;
      }

    } catch (err) {
      console.log("❌ EXCEPTION:", model, err);
    }
  }

  return "⚠️ IA indisponível no momento.";
}

// =============================
// 💬 CHAT
// =============================
app.post("/chat", async (req, res) => {

  let { userId, messages, message, receiverId } = req.body;

  if (!userId) {
    return res.status(400).send("❌ userId obrigatório.");
  }

  if (!messages && message) {
    messages = [{ role: "user", content: message }];
  }

  if (!Array.isArray(messages)) {
    return res.status(400).send("❌ messages inválido.");
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).send("❌ API KEY não configurada.");
  }

  try {

    let userHistory = await loadUserMemory(userId);

    if (!Array.isArray(userHistory)) userHistory = [];

    userHistory = [...userHistory, ...messages];
    userHistory = userHistory.slice(-10);

    const lastUser = getLastUserMessage(messages);
    const lastText = lastUser?.content;

    let finalMessages = normalizeMessages(userHistory);

    if (shouldSearch(messages)) {

      const results = await searchDuck(lastText);

      if (results?.length) {

        const context = results.map(r =>
          `${r.title}: ${r.snippet}`
        ).join("\n\n");

        finalMessages.unshift({
          role: "system",
          content: `Use os dados abaixo:\n\n${context}`
        });
      }
    }

    const reply = await callAI(finalMessages);

    userHistory.push({
      role: "assistant",
      content: reply
    });

    await saveUserMemory(userId, userHistory);

    // 🔔 NOTIFICAÇÃO (SEM QUEBRAR NADA)
    if (receiverId) {
      const db = await getDB();
      const doc = await db.collection("profiles").doc(receiverId).get();
      const token = doc.data()?.fcmToken;

      if (token) {
        await enviarNotificacao(token, "Nova mensagem", "Você recebeu uma mensagem");
      }
    }

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