// =============================================================================
// API 連携モジュール — ElevenLabs + D-ID
// =============================================================================

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';
const DID_BASE = 'https://api.d-id.com';

// -----------------------------------------------------------------------------
// Step 1: 人物登録 — ElevenLabs で音声クローン作成
// POST /v1/voices/add
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
    // 写真は Base64 で返す（フロントエンドで表示用 + D-ID 送信用に保持）
    photoBase64: `data:${photo.mimetype};base64,${photo.buffer.toString('base64')}`,
  };
}

// -----------------------------------------------------------------------------
// Step 2: 音声生成 — ElevenLabs TTS（クローン音声でテキスト読み上げ）
// POST /v1/text-to-speech/{voice_id}
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
// Step 3: 動画生成 — D-ID Talks API（写真 + 音声 → 動画）
// POST /talks
// -----------------------------------------------------------------------------
export async function generateVideo({ photoUrl, audioUrl }) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const response = await fetch(`${DID_BASE}/talks`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source_url: photoUrl,
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

  return {
    talkId: data.id,
    status: data.status,
  };
}

// -----------------------------------------------------------------------------
// Step 3b: 動画ステータス確認 — D-ID（ポーリング用）
// GET /talks/{id}
// -----------------------------------------------------------------------------
export async function getVideoStatus(talkId) {
  const apiKey = process.env.DID_API_KEY;
  if (!apiKey) throw new Error('DID_API_KEY が設定されていません');

  const response = await fetch(`${DID_BASE}/talks/${talkId}`, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${apiKey}`,
    },
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
