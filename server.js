import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

const app = express();

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 detectar quando usar internet
function shouldSearch(messages) {
  const lastMessage = messages[messages.length - 1]?.content.toLowerCase();

  const keywords = [
    "hoje", "agora", "preço", "cotação",
    "notícia", "último", "resultado",
    "bitcoin", "dólar", "ethereum"
  ];

  return keywords.some(k => lastMessage.includes(k));
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

    // 🔥 SE PRECISAR DE INTERNET
    if (shouldSearch(messages)) {

      const lastUserMessage = messages[messages.length - 1].content;

      console.log("🔎 Fazendo busca:", lastUserMessage);

      const results = await searchDuck(lastUserMessage);

      const context = results.map(r =>
        `${r.title}: ${r.snippet}`
      ).join("\n\n");

      // 🔥 injeta no contexto da IA
      finalMessages.unshift({
        role: "system",
        content: `Use estas informações da internet:\n\n${context}`
      });
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