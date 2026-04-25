console.log("🚀 NOVA VERSÃO ATIVA 5.0");

import express from "express";
import cors from "cors";
import { searchDuck } from "./search.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 Firebase lazy load (evita crash)
let db = null;

async function getDB() {
  if (!db) {
    const firebase = await import("./firebase.js");
    db = firebase.db;
    console.log("🔥 Firebase carregado dinamicamente");
  }
  return db;
}

// 🔥 FUNÇÃO DE BUSCA CORRIGIDA (AGORA FUNCIONA DE VERDADE)
function shouldSearch(messages) {

  const lastMessage = messages[messages.length - 1];

  if (!lastMessage || lastMessage.role !== "user") return false;

  const text = lastMessage.content.toLowerCase().trim();

  const simpleMessages = [
    "oi", "olá", "ola", "hey", "eai",
    "bom dia", "boa tarde", "boa noite",
    "tudo bem", "blz"
  ];

  if (simpleMessages.includes(text)) return false;

  const triggers = [
    "quanto", "qual", "quem", "quando",
    "preço", "cotação", "valor",
    "dólar", "bitcoin", "ethereum",
    "notícia", "resultado",
    "hoje", "agora", "último", "atual"
  ];

  return triggers.some(t => text.includes(t));
}

// 🔥 rota raiz
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

// 🔥 TESTE FIRESTORE
app.get("/test", async (req, res) => {
  try {
    const db = await getDB();

    await db.collection("test").doc("ok").set({
      status: "funcionando"
    });

    res.send("🔥 Firestore OK");
  } catch (e) {
    console.log(e);
    res.send("❌ erro Firestore");
  }
});

// 🔥 carregar memória
async function loadUserMemory(userId) {
  const db = await getDB();
  const doc = await db.collection("chats").doc(userId).get();
  return doc.exists ? doc.data().messages : [];
}

// 🔥 salvar memória
async function saveUserMemory(userId, messages) {
  const db = await getDB();
  await db.collection("chats").doc(userId).set({
    messages: messages
  });
}

// 🔥 CHAT PRINCIPAL
app.post("/chat", async (req, res) => {

  const { userId, messages } = req.body;

  if (!userId) {
    return res.status(400).send("❌ userId obrigatório.");
  }

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send("❌ Histórico inválido.");
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).send("❌ API KEY não configurada.");
  }

  try {

    // 🔥 memória do usuário
    let userHistory = await loadUserMemory(userId);

    userHistory = [...userHistory, ...messages];
    userHistory = userHistory.slice(-10);

    const lastUserMessage = messages[messages.length - 1]?.content;

    console.log("📩 Última mensagem:", lastUserMessage);

    let finalMessages = [...userHistory];

    // 🔥 BUSCA REAL FUNCIONANDO
    if (shouldSearch(messages)) {

      console.log("🔎 Fazendo busca:", lastUserMessage);

      const results = await searchDuck(lastUserMessage);

      console.log("RESULTADOS:", results);

      if (results && results.length > 0) {

        const context = results.map(r =>
          `${r.title}: ${r.snippet}`
        ).join("\n\n");

        finalMessages.unshift({
          role: "system",
          content: `Você tem acesso à internet.

Use obrigatoriamente os dados abaixo se forem relevantes.
Nunca diga que não tem acesso a dados em tempo real.

DADOS ATUALIZADOS:
${context}`
        });

      } else {
        console.log("⚠️ Busca não retornou dados");
      }

    } else {
      console.log("🧠 Sem necessidade de busca");
    }

    // 🔥 chamada IA
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

    console.log("🤖 Resposta IA:", JSON.stringify(data));

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      reply = data?.error?.message
        ? "❌ Erro da IA: " + data.error.message
        : "⚠️ IA não respondeu corretamente.";
    }

    // 🔥 salva memória
    userHistory.push({
      role: "assistant",
      content: reply
    });

    await saveUserMemory(userId, userHistory);

    res.send(reply);

  } catch (err) {
    console.log("❌ Erro geral:", err);
    res.status(500).send("❌ Erro no servidor.");
  }
});

// 🔥 porta Railway
const PORT = process.env.PORT;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend rodando na porta ${PORT}`);
});