import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

const app = express();
app.use(cors());
app.use(express.json());

// 🔐 variável de ambiente (Railway)
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

function shouldSearch(message) {
  const keywords = [
    "quem é", "o que é", "notícia",
    "hoje", "2026", "preço", "resultado"
  ];

  return keywords.some(k =>
    message.toLowerCase().includes(k)
  );
}

app.post("/chat", async (req, res) => {

  const message = req.body?.message;

  if (!message) {
    return res.status(400).send("❌ Mensagem não enviada corretamente.");
  }

  if (!OPENROUTER_API_KEY) {
    console.log("❌ API KEY não definida");
    return res.status(500).send("Erro de configuração do servidor.");
  }

  let context = "";

  try {
    if (shouldSearch(message)) {
      const results = await searchDuck(message);

      context = results.map(r =>
        `${r.title}: ${r.snippet}`
      ).join("\n\n");
    }
  } catch (e) {
    console.log("Erro na busca:", e);
  }

  const prompt = `
Use essas informações atualizadas se forem úteis:

${context}

Pergunta: ${message}
`;

  // 🔥 TIMEOUT ANTI-TRAVAMENTO
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15s

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }]
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await response.json();

    console.log("Resposta IA:", JSON.stringify(data));

    const reply = data?.choices?.[0]?.message?.content;

    if (!reply) {
      console.log("❌ Resposta inválida da IA");
      return res.status(500).send("❌ IA não respondeu corretamente.");
    }

    res.send(reply);

  } catch (err) {
    clearTimeout(timeout);

    console.log("Erro IA:", err);

    if (err.name === "AbortError") {
      return res.status(500).send("⚠️ A IA demorou muito para responder.");
    }

    res.status(500).send("❌ Erro na IA.");
  }
});

// 🔥 porta dinâmica (Railway)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend rodando na porta ${PORT}`);
});