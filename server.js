app.post("/chat", async (req, res) => {

  const message = req.body?.message;

  if (!message) {
    return res.status(400).send("Mensagem não enviada.");
  }

  // 🔥 resposta fake (teste)
  res.send("Backend funcionando ✅");
});