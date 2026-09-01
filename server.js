// server.js - LIA V5 COMPLET - Internationale Vocale + Vision
// NEOLIFE-ID™ - Prêt pour Render
const express = require('express');
const axios = require('axios');
const OpenAI = require('openai');
const fs = require('fs');

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('LIA V5 - Internationale Vocale + Vision OK');
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = require('./knowledge.json');

// === CONFIG ===
const DELIVERY_NUMBERS = ["+22679069844", "+2290140133333"];
const pendingPayments = {};

const productList = products.map(p => p.name).join(', ');
const productDetails = products.map(p => `${p.name}: ${p.price} FCFA - ${p.description}`).join('\n');

// === CERVEAU LIA ===
const SYSTEM_PROMPT = `
Tu es Chloe, assistante service client NEOLIFE.
Tu parles automatiquement la langue du client: Français, Mooré, Dioula, Anglais.
Tu connais les produits: ${productList}
Détails:
${productDetails}
Tu es aimable, professionnelle, tu aides à commander.
Pour commander, demande nom, ville, quantité.
`;

app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: message }
      ]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (e) {
    console.error(e);
    res.status(500).json({ reply: "Désolé, petite erreur technique. Réessayez." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`LIA V5 en ligne sur port ${PORT}`));
