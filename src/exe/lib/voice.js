import dotenv from 'dotenv';
dotenv.config();

const DEFAULT_DEEPGRAM_KEY = '3c27bbb843145baaa48fc9b653d97243b36f3fdc';

function getDeepgramKey() {
  return process.env.DEEPGRAM_API_KEY || DEFAULT_DEEPGRAM_KEY;
}

/**
 * Deepgram Aura Voices
 */
export const AURA_VOICES = [
  { id: 'aura-2-asteria-en', name: 'Asteria (Female - Aura-2 Latest)', gender: 'female' },
  { id: 'aura-luna-en', name: 'Luna (Female - Energetic)', gender: 'female' },
  { id: 'aura-stella-en', name: 'Stella (Female - Calm)', gender: 'female' },
  { id: 'aura-athena-en', name: 'Athena (Female - Authoritative)', gender: 'female' },
  { id: 'aura-hera-en', name: 'Hera (Female - Expressive)', gender: 'female' },
  { id: 'aura-helios-en', name: 'Helios (Male - Warm Friendly)', gender: 'male' },
  { id: 'aura-arcas-en', name: 'Arcas (Male - Natural Deep)', gender: 'male' },
  { id: 'aura-zeus-en', name: 'Zeus (Male - Strong Deep)', gender: 'male' },
  { id: 'aura-orion-en', name: 'Orion (Male - Calm Storyteller)', gender: 'male' },
  { id: 'aura-perseus-en', name: 'Perseus (Male - Energetic)', gender: 'male' }
];

/**
 * Transcribe WhatsApp Audio / Voice Note into text.
 * Primary: Deepgram Whisper-medium (good Urdu/Hindi support).
 * Fallback: Groq Whisper-large-v3-turbo (fast, reliable).
 * Retries each provider up to 2 times before falling through.
 *
 * @param {Buffer} audioBuffer - raw audio buffer from WhatsApp (ogg/opus, mp4, etc.)
 * @param {string} mimeType - e.g. 'audio/ogg; codecs=opus'
 * @returns {Promise<{ transcript: string, detectedLanguage: string, confidence: number }>}
 */
export async function transcribeAudio(audioBuffer, mimeType = 'audio/ogg') {
  if (!audioBuffer || audioBuffer.length === 0) {
    throw new Error('Audio buffer is empty');
  }

  const errors = [];

  // ── Attempt 1: Deepgram (2 tries) ──
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await transcribeDeepgram(audioBuffer, mimeType);
    } catch (e) {
      errors.push(`Deepgram try ${attempt}: ${e.message}`);
      console.warn(`[stt] Deepgram attempt ${attempt} failed:`, e.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }

  // ── Attempt 2: Groq Whisper fallback (2 tries) ──
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      return await transcribeGroq(audioBuffer, mimeType);
    } catch (e) {
      errors.push(`Groq try ${attempt}: ${e.message}`);
      console.warn(`[stt] Groq attempt ${attempt} failed:`, e.message);
      if (attempt < 2) await new Promise(r => setTimeout(r, 1500 * attempt));
    }
  }

  throw new Error(`Transcription failed on all providers. ${errors.join(' | ')}`);
}

async function transcribeDeepgram(audioBuffer, mimeType) {
  const apiKey = getDeepgramKey();
  const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
  // Scale timeout with audio size: ~1s per 50KB, min 20s, max 60s
  const timeout = Math.min(60000, Math.max(20000, Math.ceil(audioBuffer.length / 51200) * 1000));

  const url = 'https://api.deepgram.com/v1/listen?model=whisper-medium&smart_format=true&detect_language=true';

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${apiKey}`,
      'Content-Type': cleanMime || 'audio/ogg'
    },
    body: audioBuffer,
    signal: AbortSignal.timeout(timeout)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Deepgram HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const alt = data.results?.channels?.[0]?.alternatives?.[0];
  const transcript = (alt?.transcript || '').trim();
  if (!transcript) throw new Error('Deepgram returned empty transcript');

  return {
    transcript,
    detectedLanguage: alt?.languages?.[0] || data.results?.channels?.[0]?.detected_language || 'en',
    confidence: alt?.confidence || 0.9,
    provider: 'deepgram'
  };
}

async function transcribeGroq(audioBuffer, mimeType) {
  const { Store } = await import('./store.js');
  const config = Store.getConfig();
  const apiKey = config.ai?.groqKey || process.env.GROQ_API_KEY || '';
  if (!apiKey) throw new Error('Groq API key not configured');

  const cleanMime = mimeType ? mimeType.split(';')[0].trim() : 'audio/ogg';
  const ext = cleanMime.includes('ogg') ? 'ogg' : cleanMime.includes('mp4') ? 'm4a' : 'mp3';

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: cleanMime }), `voice.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'json');

  const timeout = Math.min(60000, Math.max(20000, Math.ceil(audioBuffer.length / 51200) * 1000));

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(timeout)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const transcript = (data.text || '').trim();
  if (!transcript) throw new Error('Groq returned empty transcript');

  return { transcript, detectedLanguage: 'auto', confidence: 0.9, provider: 'groq' };
}

/**
 * Convert Text to Human-like Voice Audio using Deepgram Aura TTS
 * @param {string} text - text to speak
 * @param {string} voiceModel - e.g. 'aura-2-asteria-en'
 * @returns {Promise<Buffer>} - Audio buffer (MP3)
 */
export async function textToSpeech(text, voiceModel = 'aura-2-asteria-en') {
  if (!text || typeof text !== 'string') {
    throw new Error('Text is required for TTS');
  }

  // Clean markdown asterisks, underscores, emojis, etc. for smooth speech
  const cleanText = text
    .replace(/[*_~`#]/g, '')
    .replace(/https?:\/\/[^\s]+/g, 'link')
    .slice(0, 2000)
    .trim();

  if (!cleanText) throw new Error('Text is empty after formatting');

  const apiKey = getDeepgramKey();

  // 1. Primary: Deepgram Aura TTS (Ultra Realistic & 100% Universally Playable MP3)
  try {
    const selectedVoice = voiceModel || 'aura-2-asteria-en';
    const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(selectedVoice)}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: cleanText }),
      signal: AbortSignal.timeout(12000)
    });

    if (res.ok) {
      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } else {
      const err = await res.text();
      console.warn(`Deepgram TTS HTTP ${res.status}:`, err);
    }
  } catch (err) {
    console.warn('Deepgram TTS exception, trying fallback:', err.message);
  }

  // 2. Fallback: Google Translate TTS (Instant, handles Urdu/Hindi script smoothly)
  try {
    const isUrdu = /[\u0600-\u06FF]/.test(cleanText);
    const lang = isUrdu ? 'ur' : 'en';
    const snippet = cleanText.slice(0, 200);
    const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(snippet)}&tl=${lang}&client=tw-ob`;

    const gRes = await fetch(gUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      },
      signal: AbortSignal.timeout(8000)
    });

    if (gRes.ok) {
      const arr = await gRes.arrayBuffer();
      return Buffer.from(arr);
    }
  } catch (e) {
    console.warn('Google TTS fallback error:', e.message);
  }

  throw new Error('Unable to generate voice audio. Check Deepgram API Key.');
}


/**
 * Determine correct WhatsApp MIME type for audio buffer
 */
export function getAudioMimeType(buf) {
  if (buf && buf.length >= 4) {
    if (buf.slice(0, 4).toString('utf8') === 'OggS') {
      return 'audio/ogg; codecs=opus';
    }
  }
  return 'audio/mpeg';
}
