import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';
import {
  registerPerson,
  generateSpeech,
  uploadImageToDID,
  uploadAudioToDID,
  generateVideo,
  getVideoStatus,
  listVoices,
} from './api.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// 履歴保存ディレクトリ
const HISTORY_DIR = join(__dirname, 'history');
const HISTORY_JSON = join(HISTORY_DIR, 'history.json');
if (!existsSync(HISTORY_DIR)) mkdirSync(HISTORY_DIR, { recursive: true });
if (!existsSync(HISTORY_JSON)) writeFileSync(HISTORY_JSON, '[]');

function loadHistory() {
  return JSON.parse(readFileSync(HISTORY_JSON, 'utf-8'));
}

function saveHistory(entries) {
  writeFileSync(HISTORY_JSON, JSON.stringify(entries, null, 2));
}

// --- Middleware ---
app.use(cors());
app.use(express.json({ limit: '20mb' }));

// 静的ファイル配信（site/ ディレクトリ）
app.use(express.static(join(__dirname, '..', 'site')));

// 履歴動画の配信
app.use('/api/history/videos', express.static(join(HISTORY_DIR, 'videos')));

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

// プリメイドボイス一覧取得
app.get('/api/voices', async (_req, res) => {
  try {
    const voices = await listVoices();
    res.json(voices);
  } catch (err) {
    console.error('[voices]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 履歴一覧取得
app.get('/api/history', (_req, res) => {
  try {
    const history = loadHistory();
    res.json(history);
  } catch (err) {
    console.error('[history]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 履歴の動画を保存
app.post('/api/history/save', express.json(), async (req, res) => {
  try {
    const { personName, scriptText, resultUrl, photoBase64 } = req.body;

    if (!resultUrl) {
      return res.status(400).json({ error: '動画URLが必要です' });
    }

    // 動画をダウンロード
    const videoRes = await fetch(resultUrl);
    if (!videoRes.ok) throw new Error('動画のダウンロードに失敗しました');
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    // ファイル保存
    const videosDir = join(HISTORY_DIR, 'videos');
    if (!existsSync(videosDir)) mkdirSync(videosDir, { recursive: true });

    const timestamp = Date.now();
    const videoFilename = `${timestamp}.mp4`;
    writeFileSync(join(videosDir, videoFilename), videoBuffer);

    // サムネイル（写真）保存
    let thumbFilename = null;
    if (photoBase64) {
      const matches = photoBase64.match(/^data:image\/(\w+);base64,(.+)$/);
      if (matches) {
        thumbFilename = `${timestamp}.${matches[1]}`;
        writeFileSync(join(videosDir, thumbFilename), Buffer.from(matches[2], 'base64'));
      }
    }

    // 履歴エントリ追加
    const entry = {
      id: timestamp,
      personName: personName || '不明',
      scriptText: scriptText || '',
      videoFile: videoFilename,
      thumbFile: thumbFilename,
      createdAt: new Date().toISOString(),
    };

    const history = loadHistory();
    history.unshift(entry); // 新しい順
    saveHistory(history);

    console.log(`[history] Saved: ${videoFilename}`);
    res.json(entry);
  } catch (err) {
    console.error('[history-save]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 履歴削除
app.delete('/api/history/:id', (req, res) => {
  try {
    const id = Number(req.params.id);
    const history = loadHistory();
    const filtered = history.filter((e) => e.id !== id);
    saveHistory(filtered);
    res.json({ ok: true });
  } catch (err) {
    console.error('[history-delete]', err.message);
    res.status(500).json({ error: err.message });
  }
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

// Step 3: 動画生成（写真 + 音声をD-IDにアップ → 動画生成）
app.post(
  '/api/video/generate',
  upload.fields([{ name: 'photo', maxCount: 1 }]),
  async (req, res) => {
    try {
      const photo = req.files?.photo?.[0];
      const audioBase64 = req.body.audioBase64;

      if (!photo || !audioBase64) {
        return res.status(400).json({ error: '写真と音声データが必要です' });
      }

      // 音声Base64をBufferに変換
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // D-IDに画像アップロード
      console.log('[video] Uploading image to D-ID...');
      const imageUrl = await uploadImageToDID(photo.buffer, photo.mimetype);

      // D-IDに音声アップロード
      console.log('[video] Uploading audio to D-ID...');
      const audioUrl = await uploadAudioToDID(audioBuffer);

      // D-IDで動画生成開始
      console.log('[video] Creating talk...');
      const result = await generateVideo({ imageUrl, audioUrl });
      res.json(result);
    } catch (err) {
      console.error('[video]', err.message);
      res.status(500).json({ error: err.message });
    }
  }
);

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
