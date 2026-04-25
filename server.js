import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 DETECÇÃO INTELIGENTE (MELHORADA)
function shouldSearch(messages) {

  const lastUserMessage = [...messages]
    .reverse()
    .find(m => m.role === "user");

  if (!lastUserMessage) return false;

  const text = lastUserMessage.content.toLowerCase();

  const triggers = [
    "quanto tá",
    "quanto esta",
    "quanto custa",
    "valor do",
    "preço do",
    "cotação",
    "dólar",
    "bitcoin",
    "ethereum",
    "hoje",
    "agora",
    "notícia",
    "resultado"
  ];

  return triggers.some(t => text.includes(t));
}

// 🔥 rota raiz
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

app.post("/chat", async (req, res) => {

  const messages = req.body?.messages;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send("❌ Histórico inválido.");
  }

  if (!OPENROUTER_API_KEY) {
    return res.status(500).send("❌ API KEY não configurada.");
  }

  let finalMessages = [...messages];

  try {

    const lastUserMessage = [...messages]
      .reverse()
      .find(m => m.role === "user")?.content;

    // 🔥 FORÇA BUSCA SE DETECTAR OU SE PARECER PERGUNTA DE DADO REAL
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
          content: `Você TEM acesso à internet e DEVE usar essas informações atualizadas para responder.

REGRAS:
- NÃO diga que não tem acesso a dados em tempo real
- USE os dados abaixo obrigatoriamente
- Seja direto e preciso

DADOS:
${context}`
        });

      } else {
        console.log("⚠️ Busca vazia, tentando fallback...");

        // 🔥 fallback: força resposta mesmo sem dados
        finalMessages.unshift({
          role: "system",
          content: "Responda da melhor forma possível com conhecimento geral."
        });
      }
    }

  } catch (e) {
    console.log("Erro na busca:", e);
  }

  try {
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

    console.log("Resposta IA:", JSON.stringify(data));

    let reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      if (data?.error?.message) {
        reply = "❌ Erro da IA: " + data.error.message;
      } else {
        reply = "⚠️ IA não respondeu corretamente.";
      }
    }

    res.send(reply);

  } catch (err) {
    console.log("Erro geral:", err);
    res.status(500).send("❌ Erro no servidor.");
  }
});

// 🔥 porta Railway
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend rodando na porta ${PORT}`);
});