import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

// 🔥 ROTA TESTE (SEM IA)
app.post("/chat", (req, res) => {

  const message = req.body?.message;

  if (!message) {
    return res.status(400).send("Mensagem não enviada.");
  }

  console.log("Mensagem recebida:", message);

  // 🔥 resposta imediata (sem travar)
  res.send("Backend funcionando ✅");
});

// 🔥 PORTA CORRETA (ESSENCIAL)
const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔥 Backend rodando na porta ${PORT}`);
});