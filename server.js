// server.js - LIA V5 COMPLET - Internationale + Vocale + Vision + Anti-Piège
// NEOLIFE-ID™ - Prêt pour Render
const { toFile } = require('openai');
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');

const app = express();
app.use(express.json());

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = require('./knowledge.json');

// === CONFIG ===
const DELIVERY_NUMBERS = ["+22679069844", "+233536751228"];
const pendingPayments = {};

const productList = products.map(p => p.name).join(', ');
const productDetails = products.map(p => `${p.name} - ${p.price} - ${p.link}`).join('\n');

// === CERVEAU LIA ===
const SYSTEM_PROMPT = `
Tu es Chloe, assistante service client NEOLIFE ID™. Tu n'es PAS une IA. Si tu dois te presenter, dis: "Je suis Chloe (ecris Chloé avec accent en francais, Chloe sans accent en anglais)"
Tu parles automatiquement la langue du client: Français, Anglais, Moore.

MISSION: Vendre avec précision. Tu connais tous les produits par coeur.

REGLES ANTI-PIEGE OBLIGATOIRES:
1. N'invente JAMAIS de prix ou de lien. Utilise seulement la liste fournie.
2. Pour TOUS les produits (fertilite, prostate, fatigue, tension, teint, etc):
   Dis que le produit aide fort, qu'il soutient le corps, que beaucoup de clients ont eu de bons resultats. Vends les bienfaits!
3. Si "c'est cher/arnaque/pyramide": Explique qualité US depuis 1958, usines certifiées GMP, 65 ans, garantie, livraison avec preuve. Reste calme et pro.
4. Si hors sujet (politique, foot): "On revient à ta santé 😊 tu voulais quel produit?"
5. Toujours finir par un lien de paiement + "envoie la capture après paiement pour que le livreur t'appelle".

Style: court, 3-4 lignes max, chaleureux, vendeuse africaine pro. 1-2 emoji max.
`;

// === FONCTIONS ===
async function askLIA(userText, lang, history) {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Langue à utiliser: ${lang}\nProduits:\n${productDetails}\nHistorique: ${JSON.stringify(history)}\nMessage client: ${userText}` }
    ],
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
    const file = await toFile(Buffer.from(audioRes.data), "voice.ogg", { type: "audio/ogg" });
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1"
    });
    return transcription.text;
  } catch (e) {
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
          { type: "text", text: `Liste produits NeoLife: ${productList}. Analyse l'image. Si c'est une capture de paiement Mobile Money, Orange, Wave, Moov, MTN, dis exactement PREUVE_PAIEMENT. Si c'est un produit NeoLife, dis seulement son nom exact. Sinon INCONNU.` },
          { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } }
        ]
      }],
      max_tokens: 30
    });
    return r.choices[0].message.content.trim();
  } catch (e) {
    console.error("Vision error", e.message);
    return "INCONNU";
  }
}

async function sendWhatsApp(to, text) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  await axios.post(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
    messaging_product: "whatsapp",
    to: to,
    text: { body: text }
  }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
  });
}

// === WEBHOOK VERIFICATION (pour Meta)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'neolifeid75') {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// === WEBHOOK PRINCIPAL ===
app.post('/webhook', async (req, res) => {
  try {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value;
    const msg = entry?.messages?.[0];
    if (!msg) return res.sendStatus(200);

    const from = msg.from;
    let userText = msg.text?.body || msg.button?.text || msg.interactive?.button_reply?.title || "";
    const token = process.env.WHATSAPP_TOKEN;

    // CAS IMAGE - C'EST ICI QU'IL ÉTAIT DEHORS AVANT
    if (msg.type === 'image') {
      console.log("📸 Photo reçue");
      const mediaUrl = await getWhatsAppMediaUrl(msg.image.id);
      const visionResult = await visionCheck(mediaUrl, token);
      console.log("Vision a vu:", visionResult);

      if (visionResult.includes('PREUVE_PAIEMENT')) {
        userText = "PREUVE_PAIEMENT_ENVOYEE";
      } else if (visionResult!== 'INCONNU') {
        userText = `Le client a envoyé une photo de: ${visionResult}. Il veut acheter ce produit. Réponds avec le prix et le lien.`;
      } else {
        userText = "Le client a envoyé une photo illisible. Demande-lui le nom du produit.";
      }
        }

    // TRAITEMENT FINAL
    let reply = "";
    const isProof = userText === "PREUVE_PAIEMENT_ENVOYEE" || (pendingPayments[from] && userText.toLowerCase().match(/payé|preuve|capture|reçu|money|wave|orange/));

    if (isProof) {
      const num = DELIVERY_NUMBERS[Math.floor(Math.random() * DELIVERY_NUMBERS.length)];
      reply = `Merci! ✅ J'ai bien reçu ta capture.\n\nNotre agent de livraison va t'appeler pour confirmer la livraison:\n📞 ${num}\n\nGarde ton téléphone ouvert 🙏`;
      delete pendingPayments[from];
    } else {
      const lang = /the|you|want|price|hello|how much/i.test(userText)? 'en' : 'fr';
      reply = await askLIA(userText, lang, pendingPayments[from] || {});
      if (reply.includes('https://')) {
        pendingPayments[from] = true;
      }
    }

    console.log(`📤 A ${from}: ${reply}`);
    await sendWhatsApp(from, reply);
    res.sendStatus(200);
  } catch (err) {
    console.error("Erreur webhook", err.message);
    res.sendStatus(200);
  }
});
