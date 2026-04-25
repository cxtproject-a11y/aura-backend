console.log("🚀 NOVA VERSÃO ATIVA 3.0");

import express from "express";
import cors from "cors";
import { searchDuck } from "./search.js";
import { db } from "./firebase.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 função inteligente de busca
function shouldSearch(messages) {

  const lastUserMessage = [...messages]
    .reverse()
    .find(m => m.role === "user");

  if (!lastUserMessage) return false;

  const text = lastUserMessage.content.toLowerCase().trim();

  const simpleMessages = [
    "oi", "olá", "ola", "hey", "eai",
    "bom dia", "boa tarde", "boa noite",
    "tudo bem", "blz"
  ];

  if (simpleMessages.includes(text)) return false;

  if (text.includes("o que é") || text.includes("explique")) return false;

  const triggers = [
    "quanto", "qual", "quem", "quando",
    "preço", "cotação", "valor",
    "dólar", "bitcoin", "ethereum",
    "notícia", "resultado", "hoje", "agora"
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
  const doc = await db.collection("chats").doc(userId).get();
  return doc.exists ? doc.data().messages : [];
}

// 🔥 salvar memória
async function saveUserMemory(userId, messages) {
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

    // 🔥 pega memória do usuário
    let userHistory = await loadUserMemory(userId);

    // junta com mensagens atuais
    userHistory = [...userHistory, ...messages];

    // limita histórico
    userHistory = userHistory.slice(-10);

    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === "user")?.content;

    console.log("📩 Última mensagem:", lastUserMessage);

    let finalMessages = [...userHistory];

    // 🔥 busca inteligente
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
          content: `Você TEM acesso à internet e DEVE usar essas informações atualizadas.

REGRAS:
- NÃO diga que não tem acesso a dados em tempo real
- USE os dados abaixo obrigatoriamente
- Seja direto

DADOS:
${context}`
        });

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

    // 🔥 salva resposta na memória
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