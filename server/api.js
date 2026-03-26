// =============================================================================
// API 連携モジュール — ElevenLabs + D-ID
// =============================================================================

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const DID_BASE = 'https://api.d-id.com';

function didHeaders(contentType) {
  const h = { Authorization: `Basic ${process.env.DID_API_KEY}` };
  if (contentType) h['Content-Type'] = contentType;
  return h;
}

// -----------------------------------------------------------------------------
// プリメイドボイス一覧取得
// -----------------------------------------------------------------------------
export async function listVoices() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY が設定されていません');

  const response = await fetch(`${ELEVENLABS_BASE}/voices`, {
    headers: { 'xi-api-key': apiKey },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs voices list failed: ${response.status} ${err}`);
  }

  const data = await response.json();

  return data.voices.map((v) => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    gender: v.labels?.gender || '',
    age: v.labels?.age || '',
    accent: v.labels?.accent || '',
    previewUrl: v.preview_url || null,
  }));
}

// -----------------------------------------------------------------------------
// Step 1: 人物登録 — ElevenLabs で音声クローン作成
// -----------------------------------------------------------------------------
export async function registerPerson({ name, photo, audio }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY が設定されていません');

  // 音声クローン作成
  const formData = new FormData();
  formData.append('name', name);
  formData.append('files', new Blob([audio.buffer], { type: audio.mimetype }), audio.originalname);

  const response = await fetch(`${ELEVENLABS_BASE}/voices/add`, {
    method: 'POST',
    headers: { 'xi-api-key': apiKey },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs voice clone failed: ${response.status} ${err}`);
  }

  const data = await response.json();

  return {
    voiceId: data.voice_id,
    name,
    photoBase64: `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`,
  };
}

// -----------------------------------------------------------------------------
// Step 2: 音声生成 — ElevenLabs TTS
// -----------------------------------------------------------------------------
export async function generateSpeech({ voiceId, text }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY が設定されていません');

  const response = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${response.status} ${err}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

// -----------------------------------------------------------------------------
// D-ID: 画像アップロード
// POST /images
// -----------------------------------------------------------------------------
export async function uploadImageToDID(photoBuffer, mimetype) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const formData = new FormData();
  const ext = mimetype === 'image/png' ? 'png' : 'jpg';
  formData.append('image', new Blob([photoBuffer], { type: mimetype }), `photo.${ext}`);

  const response = await fetch(`${DID_BASE}/images`, {
    method: 'POST',
    headers: { Authorization: `Basic ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID image upload failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  console.log('[D-ID image upload]', data);
  return data.url;
}

// -----------------------------------------------------------------------------
// D-ID: 音声アップロード
// POST /audios
// -----------------------------------------------------------------------------
export async function uploadAudioToDID(audioBuffer) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const formData = new FormData();
  formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }), 'speech.mp3');

  const response = await fetch(`${DID_BASE}/audios`, {
    method: 'POST',
    headers: { Authorization: `Basic ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID audio upload failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  console.log('[D-ID audio upload]', data);
  return data.url;
}

// -----------------------------------------------------------------------------
// Step 3: 動画生成 — D-ID Talks API
// -----------------------------------------------------------------------------
export async function generateVideo({ imageUrl, audioUrl }) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const response = await fetch(`${DID_BASE}/talks`, {
    method: 'POST',
    headers: didHeaders('application/json'),
    body: JSON.stringify({
      source_url: imageUrl,
      script: {
        type: 'audio',
        audio_url: audioUrl,
      },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID talks create failed: ${response.status} ${err}`);
  }

  const data = await response.json();
  console.log('[D-ID talk created]', data);

  return {
    talkId: data.id,
    status: data.status,
  };
}

// -----------------------------------------------------------------------------
// Step 3b: 動画ステータス確認
// -----------------------------------------------------------------------------
export async function getVideoStatus(talkId) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const response = await fetch(`${DID_BASE}/talks/${talkId}`, {
    method: 'GET',
    headers: didHeaders(),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`D-ID talks status failed: ${response.status} ${err}`);
  }

  const data = await response.json();

  return {
    talkId: data.id,
    status: data.status,
    resultUrl: data.result_url || null,
  };
}
