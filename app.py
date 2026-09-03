from flask import Flask
app = Flask(__name__)

@app.route('/')
def home():
    return "LIA NEOLIFE ID OK"

@app.route('/privacy')
def privacy():
    return "Politique de confidentialite LIA NEOLIFE ID: Nous collectons uniquement les messages WhatsApp pour repondre aux clients. Aucune donnee n'est vendue. Contact: diamondnionel225@gmail.com"

@app.route('/data-deletion')
def data_deletion():
    return "Pour supprimer vos donnees, envoyez 'supprimer mes donnees' au +233 53 020 7568 ou email neolife.id75@gmail.com - Suppression sous 24h"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
