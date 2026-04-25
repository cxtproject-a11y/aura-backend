import admin from "firebase-admin";

console.log("🔥 Iniciando Firebase...");

let serviceAccount;

try {
  if (!process.env.FIREBASE_KEY) {
    throw new Error("FIREBASE_KEY não definida");
  }

  serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

  console.log("✅ FIREBASE_KEY carregada");
} catch (error) {
  console.error("❌ Erro ao ler FIREBASE_KEY:", error);
  process.exit(1); // mata o app e mostra erro no log
}

// evita inicializar duas vezes
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });

    console.log("🔥 Firebase conectado com sucesso");
  } catch (error) {
    console.error("❌ Erro ao inicializar Firebase:", error);
    process.exit(1);
  }
}

export const db = admin.firestore();