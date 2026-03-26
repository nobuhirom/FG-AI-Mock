// ==========================================================================
// AI ディープフェイク詐欺デモ — フロントエンド
// ==========================================================================

const API_BASE = 'http://localhost:3001/api';

// --- State ---
let state = {
  voiceId: null,
  photoBase64: null,
  personName: null,
};

// --- DOM ---
const $ = (sel) => document.querySelector(sel);

const els = {
  // Step 1
  personName: $('#personName'),
  photoInput: $('#photoInput'),
  photoDrop: $('#photoDrop'),
  photoPreview: $('#photoPreview'),
  audioInput: $('#audioInput'),
  audioDrop: $('#audioDrop'),
  audioPreview: $('#audioPreview'),
  registerBtn: $('#registerBtn'),
  registerStatus: $('#registerStatus'),

  // Step 2
  step2: $('#step2'),
  registeredPerson: $('#registeredPerson'),
  regPhoto: $('#regPhoto'),
  regName: $('#regName'),
  scriptText: $('#scriptText'),
  generateBtn: $('#generateBtn'),
  generateStatus: $('#generateStatus'),

  // Step 3
  step3: $('#step3'),
  progressArea: $('#progressArea'),
  progressFill: $('#progressFill'),
  progressLabel: $('#progressLabel'),
  videoArea: $('#videoArea'),
  resultVideo: $('#resultVideo'),
  warningBanner: $('#warningBanner'),
};

// ==========================================================================
// File Drop Zones
// ==========================================================================

function setupFileDrop(dropEl, inputEl, onFile) {
  dropEl.addEventListener('click', () => inputEl.click());

  dropEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropEl.classList.add('dragover');
  });
  dropEl.addEventListener('dragleave', () => {
    dropEl.classList.remove('dragover');
  });
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault();
    dropEl.classList.remove('dragover');
    if (e.dataTransfer.files.length) onFile(e.dataTransfer.files[0]);
  });

  inputEl.addEventListener('change', () => {
    if (inputEl.files.length) onFile(inputEl.files[0]);
  });
}

// Photo drop
setupFileDrop(els.photoDrop, els.photoInput, (file) => {
  const url = URL.createObjectURL(file);
  els.photoPreview.src = url;
  els.photoPreview.hidden = false;
  els.photoDrop.querySelector('.file-drop-content').hidden = true;
  checkRegisterReady();
});

// Audio drop
setupFileDrop(els.audioDrop, els.audioInput, (file) => {
  const url = URL.createObjectURL(file);
  els.audioPreview.src = url;
  els.audioPreview.hidden = false;
  els.audioDrop.querySelector('.file-drop-content').hidden = true;
  checkRegisterReady();
});

// ==========================================================================
// Step 1: 人物登録
// ==========================================================================

function checkRegisterReady() {
  const hasName = els.personName.value.trim().length > 0;
  const hasPhoto = els.photoInput.files.length > 0;
  const hasAudio = els.audioInput.files.length > 0;
  els.registerBtn.disabled = !(hasName && hasPhoto && hasAudio);
}

els.personName.addEventListener('input', checkRegisterReady);

els.registerBtn.addEventListener('click', async () => {
  els.registerBtn.disabled = true;
  setStatus(els.registerStatus, '音声クローンを作成中...', 'loading');

  try {
    const formData = new FormData();
    formData.append('name', els.personName.value.trim());
    formData.append('photo', els.photoInput.files[0]);
    formData.append('audio', els.audioInput.files[0]);

    const res = await fetch(`${API_BASE}/person/register`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '登録に失敗しました');
    }

    const data = await res.json();
    state.voiceId = data.voiceId;
    state.photoBase64 = data.photoBase64;
    state.personName = data.name;

    setStatus(els.registerStatus, `✅ ${data.name} さんの音声クローンを作成しました`, 'success');
    activateStep2();
  } catch (err) {
    setStatus(els.registerStatus, `❌ ${err.message}`, 'error');
    els.registerBtn.disabled = false;
  }
});

function activateStep2() {
  els.step2.classList.remove('disabled');
  els.regPhoto.src = state.photoBase64;
  els.regName.textContent = state.personName;
  els.registeredPerson.hidden = false;
  els.generateBtn.disabled = false;
  els.step2.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ==========================================================================
// Step 2 & 3: 動画生成
// ==========================================================================

els.generateBtn.addEventListener('click', async () => {
  const text = els.scriptText.value.trim();
  if (!text) return;

  els.generateBtn.disabled = true;
  els.step3.classList.remove('disabled');
  els.progressArea.hidden = false;
  els.videoArea.hidden = true;
  els.warningBanner.hidden = true;
  els.step3.scrollIntoView({ behavior: 'smooth', block: 'start' });

  try {
    // --- Phase 1: 音声生成 ---
    setProgress(20, '音声を生成中...');
    setStatus(els.generateStatus, '音声を生成中...', 'loading');

    const speechRes = await fetch(`${API_BASE}/speech/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId: state.voiceId, text }),
    });

    if (!speechRes.ok) throw new Error('音声生成に失敗しました');

    const audioBlob = await speechRes.blob();
    const audioUrl = URL.createObjectURL(audioBlob);

    setProgress(40, '音声生成完了。動画を合成中...');

    // --- Phase 2: 動画生成 ---
    // NOTE: D-ID は URL ベースで画像・音声を受け取る。
    // 実装時はバックエンドで一時URLを作成するか、Base64で送る処理が必要。
    // 現在のスケルトンではここまでのフローを確認用に記述。
    setStatus(els.generateStatus, '動画を合成中...', 'loading');

    const videoRes = await fetch(`${API_BASE}/video/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photoUrl: state.photoBase64,
        audioUrl: audioUrl,
      }),
    });

    if (!videoRes.ok) throw new Error('動画生成に失敗しました');

    const videoData = await videoRes.json();
    setProgress(60, '動画を合成中...');

    // --- Phase 3: ポーリングで完了を待つ ---
    const resultUrl = await pollVideoStatus(videoData.talkId);

    setProgress(100, '完了!');
    setStatus(els.generateStatus, '', '');

    // --- 動画を表示 ---
    els.progressArea.hidden = true;
    els.videoArea.hidden = false;
    els.resultVideo.src = resultUrl;
    els.resultVideo.play();

    // 再生開始後に警告バナーを表示
    els.resultVideo.addEventListener(
      'playing',
      () => {
        setTimeout(() => {
          els.warningBanner.hidden = false;
        }, 2000);
      },
      { once: true }
    );
  } catch (err) {
    setStatus(els.generateStatus, `❌ ${err.message}`, 'error');
    els.generateBtn.disabled = false;
  }
});

async function pollVideoStatus(talkId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(2000);

    const pct = 60 + Math.min(35, i * 3);
    setProgress(pct, '動画を合成中...');

    const res = await fetch(`${API_BASE}/video/status/${talkId}`);
    if (!res.ok) throw new Error('動画ステータスの取得に失敗しました');

    const data = await res.json();
    if (data.status === 'done' && data.resultUrl) return data.resultUrl;
    if (data.status === 'error') throw new Error('動画合成でエラーが発生しました');
  }

  throw new Error('動画生成がタイムアウトしました');
}

// ==========================================================================
// Utilities
// ==========================================================================

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = `status ${type}`;
}

function setProgress(pct, label) {
  els.progressFill.style.width = `${pct}%`;
  els.progressLabel.textContent = label;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
