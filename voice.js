const OpenAI = require('openai');
const axios = require('axios');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeVoice(mediaId){
  const token = process.env.WHATSAPP_TOKEN;
  const mediaUrlRes = await axios.get(`https://graph.facebook.com/v20.0/${mediaId}`, { headers: {Authorization: `Bearer ${token}`} });
  const audioUrl = mediaUrlRes.data.url;
  const audioFile = await axios.get(audioUrl, { headers: {Authorization: `Bearer ${token}`}, responseType: 'arraybuffer' });
  const transcription = await openai.audio.transcriptions.create({
    file: new File([audioFile.data], "voice.ogg", {type:"audio/ogg"}),
    model: "whisper-1",
  });
  return transcription.text;
}
module.exports = { transcribeVoice };