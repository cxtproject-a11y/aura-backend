console.log("🚀 NOVA VERSÃO ATIVA 7.1");

// 🔥 CAPTURA ERROS GLOBAIS
process.on("uncaughtException", (err) => {
  console.log("💥 ERRO NÃO TRATADO:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("💥 PROMISE ERROR:", err);
});

import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 Firebase lazy load
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

// 🔥 pega última mensagem do user
function getLastUserMessage(messages) {
  return [...messages].reverse().find(m => m.role === "user");
}

// 🔥 detectar busca
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

// 🔥 rota raiz
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// 🔥 memória (CORRIGIDO)
async function loadUserMemory(userId) {
  try {
    const db = await getDB();
    const doc = await db.collection("chats").doc(userId).get();

    if (!doc.exists) return [];

    const data = doc.data();

    // 🔥 GARANTE ARRAY
    return Array.isArray(data.messages) ? data.messages : [];

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

// 🔥 CHAT PRINCIPAL (BLINDADO)
app.post("/chat", async (req, res) => {

  let { userId, messages, message } = req.body;

  if (!userId) {
    return res.status(400).send("❌ userId obrigatório.");
  }

  // 🔥 aceita os dois formatos
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

    // 🔥 memória segura
    let userHistory = await loadUserMemory(userId);

    if (!Array.isArray(userHistory)) {
      userHistory = [];
    }

    // 🔥 junta histórico + novas mensagens
    userHistory = [...userHistory, ...messages];
    userHistory = userHistory.slice(-10);

    const lastUser = getLastUserMessage(messages);
    const lastUserMessage = lastUser?.content;

    console.log("📩 Última mensagem:", lastUserMessage);

    let finalMessages = [...userHistory];

    // 🔥 BUSCA
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

    // 🔥 CHAMADA IA
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

// 🔥 start servidor
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Rodando na porta ${PORT}`);
});