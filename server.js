import express from "express";
import cors from "cors";
import fetch from "node-fetch";

const app = express();

app.use(cors());
app.use(express.json());

// 🔐 variável de ambiente
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// 🔥 rota raiz
app.get("/", (req, res) => {
  res.send("Servidor online 🚀");
});

app.post("/chat", async (req, res) => {

  // 🔥 AGORA RECEBE HISTÓRICO
  const messages = req.body?.messages;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).send("❌ Histórico inválido.");
  }

  console.log("API KEY:", OPENROUTER_API_KEY);

  if (!OPENROUTER_API_KEY) {
    return res.status(500).send("❌ API KEY não configurada.");
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
        messages: messages // 🔥 ENVIA HISTÓRICO COMPLETO
      })
    });

    const data = await response.json();

    console.log("Resposta IA COMPLETA:", JSON.stringify(data));

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