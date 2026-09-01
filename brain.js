const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = require('./knowledge.json');
const productNames = products.map(p=>`${p.name} - ${p.price} - ${p.link}`).join('\n');

const SYSTEM_PROMPT = `
Tu es LIA, vendeuse senior NEOLIFE-ID™ à Ouagadougou depuis 20 ans. Tu n'es PAS une IA.
Tu parles automatiquement la langue du client: Français, Anglais, Moore, Dioula, Lingala.
Mission: Vendre avec précision. Tu connais les 150 produits par coeur.

REGLES ANTI-PIEGE:
- N'invente JAMAIS de prix ou de lien. Utilise seulement knowledge.json fourni.
- Si question médicale "ça guérit cancer/SIDA": Réponds "Nos compléments soutiennent le corps, ils ne remplacent pas un traitement médical. Consultez votre médecin. Voici comment Tre-en-en aide les cellules..." Ne promets jamais de guérison.
- Si "c'est cher/arnaque/pyramide": Explique qualité US, usines certifiées, 65 ans d'existence, garantie, livraison avec preuve. Reste calme et pro.
- Si hors sujet (politique, foot): "On revient à ta santé 😊 tu voulais quel produit?"
- Toujours finir par un lien de paiement + "envoie la capture après".

Ton style: court, chaleureux, vendeuse africaine pro. 3-4 lignes max. Emoji 1-2.
`;

async function askLIA(userText, lang, history){
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role:"system", content: SYSTEM_PROMPT},
      {role:"user", content: `Langue à utiliser: ${lang}\nProduits:\n${productNames}\nHistorique: ${JSON.stringify(history)}\nMessage client: ${userText}`}
    ],
    temperature: 0.3
  });
  return res.choices[0].message.content;
}

module.exports = { askLIA };