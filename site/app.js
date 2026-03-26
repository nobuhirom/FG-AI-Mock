// ==========================================================================
// AI ディープフェイク詐欺デモ — フロントエンド
// ==========================================================================

const API_BASE = 'http://localhost:3001/api';

// --- State ---
let state = {
  voiceId: null,
  photoBase64: null,
  photoFile: null,
  personName: null,
  voiceMode: 'clone', // 'clone' or 'default'
};

// --- DOM ---
const $ = (sel) => document.querySelector(sel);

const els = {
  // Voice mode tabs
  tabClone: $('#tabClone'),
  tabDefault: $('#tabDefault'),
  audioUploadGroup: $('#audioUploadGroup'),
  defaultVoiceGroup: $('#defaultVoiceGroup'),
  voiceSelect: $('#voiceSelect'),
  voicePreviewPlayer: $('#voicePreviewPlayer'),
  previewVoiceBtn: $('#previewVoiceBtn'),

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
// Voice Mode Tabs
// ==========================================================================

function switchVoiceMode(mode) {
  state.voiceMode = mode;

  els.tabClone.classList.toggle('active', mode === 'clone');
  els.tabDefault.classList.toggle('active', mode === 'default');
  els.audioUploadGroup.hidden = mode !== 'clone';
  els.defaultVoiceGroup.hidden = mode !== 'default';

  checkRegisterReady();
}

els.tabClone.addEventListener('click', () => switchVoiceMode('clone'));
els.tabDefault.addEventListener('click', () => switchVoiceMode('default'));

// ==========================================================================
// Load Default Voices
// ==========================================================================

async function loadVoices() {
  try {
    const res = await fetch(`${API_BASE}/voices`);
    if (!res.ok) throw new Error('ボイス一覧の取得に失敗');
    const voices = await res.json();

    els.voiceSelect.innerHTML = '<option value="">-- ボイスを選択 --</option>';

    for (const v of voices) {
      const label = `${v.name} (${v.gender}, ${v.age})`;
      const opt = document.createElement('option');
      opt.value = v.voiceId;
      opt.textContent = label;
      opt.dataset.previewUrl = v.previewUrl || '';
      els.voiceSelect.appendChild(opt);
    }
  } catch (err) {
    els.voiceSelect.innerHTML = '<option value="">ボイス取得エラー</option>';
    console.error(err);
  }
}

// 試聴
els.voiceSelect.addEventListener('change', () => {
  const opt = els.voiceSelect.selectedOptions[0];
  const previewUrl = opt?.dataset?.previewUrl;
  if (previewUrl) {
    els.previewVoiceBtn.hidden = false;
    els.voicePreviewPlayer.hidden = true;
  } else {
    els.previewVoiceBtn.hidden = true;
    els.voicePreviewPlayer.hidden = true;
  }
  checkRegisterReady();
});

els.previewVoiceBtn.addEventListener('click', () => {
  const opt = els.voiceSelect.selectedOptions[0];
  const previewUrl = opt?.dataset?.previewUrl;
  if (previewUrl) {
    els.voicePreviewPlayer.src = previewUrl;
    els.voicePreviewPlayer.hidden = false;
    els.voicePreviewPlayer.play();
  }
});

// 起動時にボイス一覧を読み込む
loadVoices();

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
  state.photoFile = file;
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

  if (state.voiceMode === 'clone') {
    const hasAudio = els.audioInput.files.length > 0;
    els.registerBtn.disabled = !(hasName && hasPhoto && hasAudio);
  } else {
    const hasVoice = els.voiceSelect.value !== '';
    els.registerBtn.disabled = !(hasName && hasPhoto && hasVoice);
  }
}

els.personName.addEventListener('input', checkRegisterReady);

els.registerBtn.addEventListener('click', async () => {
  els.registerBtn.disabled = true;

  try {
    if (state.voiceMode === 'clone') {
      // --- クローンモード ---
      setStatus(els.registerStatus, '音声クローンを作成中...', 'loading');

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
    } else {
      // --- デフォルトボイスモード ---
      setStatus(els.registerStatus, '登録中...', 'loading');

      state.voiceId = els.voiceSelect.value;
      state.personName = els.personName.value.trim();

      // 写真をBase64に変換
      const photoFile = els.photoInput.files[0];
      state.photoBase64 = await fileToBase64(photoFile);

      const voiceName = els.voiceSelect.selectedOptions[0].textContent;
      setStatus(els.registerStatus, `✅ ${state.personName} さんを登録しました（ボイス: ${voiceName}）`, 'success');
    }

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
    setStatus(els.generateStatus, '動画を合成中...（D-IDにアップロード中）', 'loading');

    // 音声をBase64に変換してサーバーに送信
    const audioArrayBuffer = await audioBlob.arrayBuffer();
    const audioBase64 = arrayBufferToBase64(audioArrayBuffer);

    const videoFormData = new FormData();
    videoFormData.append('photo', state.photoFile);
    videoFormData.append('audioBase64', audioBase64);

    const videoRes = await fetch(`${API_BASE}/video/generate`, {
      method: 'POST',
      body: videoFormData,
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

    // 履歴に保存
    saveToHistory(resultUrl, text);

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

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ==========================================================================
// 履歴機能
// ==========================================================================

const historyEls = {
  list: $('#historyList'),
  empty: $('#historyEmpty'),
  modal: $('#historyModal'),
  modalClose: $('#modalClose'),
  modalVideo: $('#modalVideo'),
  modalName: $('#modalName'),
  modalScript: $('#modalScript'),
  modalDate: $('#modalDate'),
};

async function saveToHistory(resultUrl, scriptText) {
  try {
    await fetch(`${API_BASE}/history/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personName: state.personName,
        scriptText,
        resultUrl,
        photoBase64: state.photoBase64,
      }),
    });
    loadHistoryList();
  } catch (err) {
    console.error('履歴保存エラー:', err);
  }
}

async function loadHistoryList() {
  try {
    const res = await fetch(`${API_BASE}/history`);
    if (!res.ok) return;
    const history = await res.json();

    if (history.length === 0) {
      historyEls.empty.hidden = false;
      // カード部分だけクリア
      historyEls.list.querySelectorAll('.history-card').forEach((c) => c.remove());
      return;
    }

    historyEls.empty.hidden = true;
    // 既存カードをクリア
    historyEls.list.querySelectorAll('.history-card').forEach((c) => c.remove());

    for (const entry of history) {
      const card = document.createElement('div');
      card.className = 'history-card';

      const thumbHtml = entry.thumbFile
        ? `<img class="history-thumb" src="${API_BASE}/history/videos/${entry.thumbFile}" />`
        : `<div class="history-thumb-placeholder">🎬</div>`;

      const date = new Date(entry.createdAt);
      const dateStr = `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

      card.innerHTML = `
        ${thumbHtml}
        <div class="history-info">
          <div class="history-name">${entry.personName}</div>
          <div class="history-script">${entry.scriptText}</div>
        </div>
        <span class="history-date">${dateStr}</span>
        <button class="history-delete" data-id="${entry.id}" title="削除">&times;</button>
      `;

      // 動画再生
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('history-delete')) return;
        openHistoryModal(entry);
      });

      // 削除
      card.querySelector('.history-delete').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('この履歴を削除しますか？')) return;
        await fetch(`${API_BASE}/history/${entry.id}`, { method: 'DELETE' });
        loadHistoryList();
      });

      historyEls.list.appendChild(card);
    }
  } catch (err) {
    console.error('履歴読み込みエラー:', err);
  }
}

function openHistoryModal(entry) {
  historyEls.modalVideo.src = `${API_BASE}/history/videos/${entry.videoFile}`;
  historyEls.modalName.textContent = entry.personName;
  historyEls.modalScript.textContent = entry.scriptText;
  const date = new Date(entry.createdAt);
  historyEls.modalDate.textContent = date.toLocaleString('ja-JP');
  historyEls.modal.hidden = false;
  historyEls.modalVideo.play();
}

historyEls.modalClose.addEventListener('click', () => {
  historyEls.modal.hidden = true;
  historyEls.modalVideo.pause();
  historyEls.modalVideo.src = '';
});

historyEls.modal.addEventListener('click', (e) => {
  if (e.target === historyEls.modal) {
    historyEls.modal.hidden = true;
    historyEls.modalVideo.pause();
    historyEls.modalVideo.src = '';
  }
});

// 起動時に履歴を読み込み
loadHistoryList();
