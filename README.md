# AI ディープフェイク詐欺デモ

> FleGrowth × シブカツ AIワークショップ 教育用デモシステム

写真1枚と数秒の音声から、AIがその人物が話しているかのようなフェイク動画を生成するデモです。
高齢者向けセミナーで「AI詐欺の危険性」を体感してもらうことを目的としています。

### 📊 [デモ実演用スライド（.pptx）](docs/FleGrowth_AntiScam_Workshop.pptx)

セミナー当日に使用するプレゼンテーションスライドです。デモの進行に合わせてご利用ください。

---

## 仕組み

```
写真 + 音声サンプル → 人物登録（音声クローン作成）
                         ↓
テキスト入力 → クローン音声で読み上げ → 写真＋音声から動画合成
                                            ↓
                                      フェイク動画を再生
```

| 処理 | 使用API |
|------|---------|
| 音声クローン＋TTS | [ElevenLabs](https://elevenlabs.io) |
| 写真＋音声→動画合成 | [D-ID](https://www.d-id.com) |

### ElevenLabs TTS モデル一覧

| モデルID | モデル名 | 日本語 | 特徴 |
|----------|----------|--------|------|
| **`eleven_v3`** ★現在使用中 | Eleven v3 | ✅ | 最も表現力が高い最新モデル。70言語以上対応 |
| `eleven_multilingual_v2` | Eleven Multilingual v2 | ✅ | リアルで感情豊かなモデル。29言語対応 |
| `eleven_flash_v2_5` | Eleven Flash v2.5 | ✅ | 超低遅延モデル。会話向き。32言語対応 |
| `eleven_turbo_v2_5` | Eleven Turbo v2.5 | ✅ | 高品質＋低遅延バランス型。32言語対応 |
| `eleven_turbo_v2` | Eleven Turbo v2 | ❌ | 英語のみ。低遅延 |
| `eleven_flash_v2` | Eleven Flash v2 | ❌ | 英語のみ。超低遅延 |
| `eleven_monolingual_v1` | Eleven English v1 | ❌ | 初代モデル（旧式） |

> モデルの変更は `server/api.js` の `model_id` を書き換えてください。

## セットアップ

### 前提条件

- Node.js v18 以上
- ElevenLabs APIキー（[取得方法](https://elevenlabs.io/docs)）
- D-ID APIキー（[取得方法](https://docs.d-id.com)）

### インストール

```bash
# リポジトリをクローン
git clone git@github.com:nobuhirom/FG-AI-Mock.git
cd FG-AI-Mock

# 依存パッケージのインストール
cd server
npm install

# 環境変数の設定
cp .env.example .env
# .env を編集して APIキーを設定
```

### 起動

```bash
# バックエンドサーバー起動
cd server
npm run dev

# ブラウザで開く
open http://localhost:3001
```

> フロントエンド（`site/`）はバックエンドから配信予定。
> 現時点では `site/index.html` を直接開いても動作します。

## 使い方

1. **人物登録** — 顔写真と音声サンプル（1〜2分）をアップロード
2. **セリフ入力** — 話させたいテキストを入力
3. **動画生成** — AIがフェイク動画を自動生成・再生

## ディレクトリ構成

```
FG_AI_Mock/
├── docs/
│   └── spec.md          # 仕様書
├── site/
│   ├── index.html       # フロントエンド
│   ├── style.css        # スタイル
│   └── app.js           # フロントエンドロジック
├── server/
│   ├── server.js        # Express バックエンド
│   ├── api.js           # ElevenLabs / D-ID API連携
│   ├── package.json     # 依存パッケージ
│   └── .env             # APIキー（git管理外）
└── README.md
```

## 注意事項

- **教育目的限定** — 本システムは詐欺被害啓発のための教育用デモです
- **生成動画の悪用禁止** — 生成された動画を悪用することは法律で禁じられています
- **データ非保存** — アップロードされた写真・音声はセッション終了後に破棄されます
- **APIキー管理** — `.env` ファイルは git 管理外です。絶対にコミットしないでください

## ライセンス

教育目的限定。無断での商用利用・再配布を禁じます。
