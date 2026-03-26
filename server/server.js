import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { registerPerson, generateSpeech, generateVideo, getVideoStatus } from './api.js';

const app = express();
const PORT = process.env.PORT || 3001;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Multer: メモリストレージ（ファイルをディスクに保存しない）
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// --- Routes ---

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    did: !!process.env.DID_API_KEY,
  });
});

// Step 1: 人物登録（写真 + 音声 → 音声クローン作成）
app.post(
  '/api/person/register',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'audio', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const { name } = req.body;
      const photo = req.files?.photo?.[0];
      const audio = req.files?.audio?.[0];

      if (!name || !photo || !audio) {
        return res.status(400).json({ error: '名前、写真、音声ファイルが必要です' });
      }

      const result = await registerPerson({ name, photo, audio });
      res.json(result);
    } catch (err) {
      console.error('[register]', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

// Step 2: 音声生成（テキスト → クローン音声）
app.post('/api/speech/generate', async (req, res) => {
  try {
    const { voiceId, text } = req.body;

    if (!voiceId || !text) {
      return res.status(400).json({ error: 'voiceId とテキストが必要です' });
    }

    const audioBuffer = await generateSpeech({ voiceId, text });

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    console.error('[speech]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Step 3: 動画生成（写真 + 音声 → トーキングヘッド動画）
app.post('/api/video/generate', async (req, res) => {
  try {
    const { photoUrl, audioUrl } = req.body;

    if (!photoUrl || !audioUrl) {
      return res.status(400).json({ error: 'photoUrl と audioUrl が必要です' });
    }

    const result = await generateVideo({ photoUrl, audioUrl });
    res.json(result);
  } catch (err) {
    console.error('[video]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Step 3b: 動画ステータス確認（D-ID はポーリングが必要）
app.get('/api/video/status/:id', async (req, res) => {
  try {
    const result = await getVideoStatus(req.params.id);
    res.json(result);
  } catch (err) {
    console.error('[video-status]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Start ---
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`   ElevenLabs API key: ${process.env.ELEVENLABS_API_KEY ? '✅ Set' : '❌ Missing'}`);
  console.log(`   D-ID API key:       ${process.env.DID_API_KEY ? '✅ Set' : '❌ Missing'}`);
});
