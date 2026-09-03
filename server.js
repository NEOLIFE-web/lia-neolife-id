// server.js - LIA V5 OPTIMISÉ
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = require('./knowledge.json');

const DELIVERY_NUMBERS = ["+22679069844", "+233536751228"];
const chatHistories = {};
const processedMsgIds = new Set();

const productList = products.map(p => p.name).join(', ');
const productDetails = products.map(p => `${p.name} - ${p.price} - ${p.link}`).join('\n');

const SYSTEM_PROMPT = `
Tu es Chloé, assistante service client NEOLIFE-ID™. Tu n'es PAS une IA.
Tu détectes et réponds immédiatement dans la langue du client (Français, Anglais, Mooré, Dioula, Lingala, etc.).

MISSION: Vendre avec précision. Tu connais tous les produits par cœur.

RÈGLES IMPÉRATIVES:
1. Ne dis JAMAIS "ça guérit". Utilise toujours: "ça aide fort, ça soutient le corps, ça améliore, ça renforce".
2. N'invente JAMAIS de prix ni de lien. Utilise STRICTEMENT la liste fournie.
3. Si le client parle d'arnaque ou de prix élevé: réponds calmement en mentionnant la qualité US depuis 1958, les normes GMP et la garantie.
4. Si hors sujet: "On revient à ta santé 😊 Tu voulais quel produit?"
5. Termine toujours avec le lien de paiement exact du produit et dis: "Envoie la capture après paiement pour confirmation."

Style: Court (3-4 lignes max), chaleureux, vendeuse africaine pro. 1 à 2 émojis max.
`;

async function askLIA(userText, history = []) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
    { role: "user", content: `Catalogue produits:\n${productDetails}\n\nMessage client: ${userText}` }
  ];

  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages,
    temperature: 0.3
  });
  return res.choices[0].message.content;
}

async function getWhatsAppMediaUrl(mediaId) {
  const token = process.env.WHATSAPP_TOKEN;
  const r = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return r.data.url;
}

async function transcribeVoice(mediaId) {
  try {
    const token = process.env.WHATSAPP_TOKEN;
    const mediaUrl = await getWhatsAppMediaUrl(mediaId);
    const audioRes = await axios.get(mediaUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    const file = await OpenAI.toFile(Buffer.from(audioRes.data), "voice.ogg", { type: "audio/ogg" });
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1"
    });
    return transcription.text;
  } catch (e) {
    console.error("Transcribe error:", e.message);
    return null;
  }
}

async function visionCheck(imageUrl, token) {
  try {
    const imgRes = await axios.get(imageUrl, {
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'arraybuffer'
    });
    const base64 = Buffer.from(imgRes.data, 'binary').toString('base64');
    const mime = imgRes.headers['content-type'] || 'image/jpeg';

    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{
        role: "user",
        content: [
          { type: "text", text: `Produits NeoLife: ${productList}. Analyse l'image. Si c'est un reçu de paiement (Orange Money, Moov, Wave, MTN, Cash), réponds "PREUVE_PAIEMENT". Si c'est un produit NeoLife, donne son nom exact. Sinon réponds "INCONNU".` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
        ]
      }],
      max_tokens: 30
    });
    return r.choices[0].message.content.trim();
  } catch (e) {
    console.error("Vision error:", e.message);
    return "INCONNU";
  }
}

async function sendWhatsApp(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE;
  await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to: to,
    text: { body: text }
  }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
}

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === (process.env.VERIFY_TOKEN || 'neolifeid75')) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Réponse immédiate à Meta

  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return;

    // Anti-doublon
    if (processedMsgIds.has(msg.id)) return;
    processedMsgIds.add(msg.id);
    if (processedMsgIds.size > 1000) processedMsgIds.clear();

    const from = msg.from;
    let userText = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || "";
    const token = process.env.WHATSAPP_TOKEN;

    if (!chatHistories[from]) chatHistories[from] = [];

    if (msg.type === 'audio' || msg.type === 'voice') {
      const transcribed = await transcribeVoice(msg.audio?.id || msg.voice?.id);
      userText = transcribed || "Audio non lisible";
    }

    if (msg.type === 'image') {
      const mediaUrl = await getWhatsAppMediaUrl(msg.image.id);
      const visionResult = await visionCheck(mediaUrl, token);

      if (visionResult.includes('PREUVE_PAIEMENT')) {
        userText = "PREUVE_PAIEMENT_ENVOYEE";
      } else if (visionResult !== 'INCONNU') {
        userText = `Je souhaite acheter le produit : ${visionResult}`;
      } else {
        userText = "Photo reçue mais non identifiée.";
      }
    }

    let reply = "";
    if (userText === "PREUVE_PAIEMENT_ENVOYEE") {
      const num = DELIVERY_NUMBERS[Math.floor(Math.random() * DELIVERY_NUMBERS.length)];
      reply = `Merci! ✅ J'ai bien reçu ta capture.\n\nNotre agent de livraison va vous appeler pour confirmer de la livraison ou l'expédition:\n📞 ${num}\n\nGarde ton téléphone disponible 🙏`;
    } else {
      reply = await askLIA(userText, chatHistories[from]);
      
      // Mise à jour de l'historique
      chatHistories[from].push({ role: "user", content: userText });
      chatHistories[from].push({ role: "assistant", content: reply });
      if (chatHistories[from].length > 6) chatHistories[from].splice(0, 2);
    }

    await sendWhatsApp(from, reply);

  } catch (e) {
    console.error("Erreur webhook:", e.message);
  }
});

app.get('/', (req, res) => res.send('LIA V5.1 - Opérationnel'));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Serveur à l'écoute sur le port ${PORT}`));
