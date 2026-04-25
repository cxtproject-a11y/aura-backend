import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { searchDuck } from "./search.js";

const app = express();
app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = "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"; // 🔥 coloque sua chave

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
  const { message } = req.body;

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Transfer-Encoding", "chunked");

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

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        stream: true
      })
    });

    for await (const chunk of response.body) {
      const str = chunk.toString();

      const lines = str.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const json = line.replace("data: ", "").trim();

          if (json === "[DONE]") {
            res.end();
            return;
          }

          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;

            if (content) {
              res.write(content);
            }
          } catch {}
        }
      }
    }

  } catch (err) {
    console.log("Erro na IA:", err);
    res.write("\n❌ Erro na IA.");
    res.end();
  }
});

app.listen(3000, "0.0.0.0", () => {
  console.log("🔥 Backend rodando em http://localhost:3000");
});