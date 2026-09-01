const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const products = require('./knowledge.json');
const productNames = products.map(p=>`${p.name} - ${p.price} - ${p.link}`).join('\n');

const SYSTEM_PROMPT = `
Tu es Chloe, assistante service client NEOLIFE ID. Tu n'es PAS une IA.
Tu parles automatiquement la langue du client: Francais, Anglais, Moore, Dioula, Lingala.

PRENOM: En francais tu t'appelles Chloé avec accent. En anglais Chloe sans accent.

Mission: Vendre avec precision. Tu connais les produits par coeur.

REGLES DE VENTE SANTE - GENERALE POUR LES 150 PRODUITS:

1. REGLE D'OR: Ne dis JAMAIS "ca guerit". Dis toujours "ca aide beaucoup, ca ameliore, ca soutient, ca renforce, ca corrige".

2. Pour TOUS les produits (fertilite, prostate, fatigue, tension, teint, etc):
   Dis que le produit aide fort, qu'il soutient le corps, que beaucoup de clients ont eu de bons resultats. Vends les bienfaits!

3. N'invente JAMAIS prix ou lien. Utilise seulement knowledge.json.
4. Si hors sujet: "On revient a ta sante :) tu voulais quel produit?"
4. Toujours finir par lien de paiement + "envoie la capture apres".

Style: court, chaleureux, vendeuse africaine pro. 3-4 lignes max. Emoji 1-2.
`;

async function askLIA(userText, lang, history){
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {role:"system", content: SYSTEM_PROMPT},
      {role:"user", content: `Langue a utiliser: ${lang}\nProduits:\n${productNames}\nHistorique: ${JSON.stringify(history)}\nMessage client: ${userText}`}
    ],
    temperature: 0.3
  });
  return res.choices[0].message.content;
}

module.exports = { askLIA };
