# MCP Server ガイド

SubsidyPayment MCP Server の セットアップ・動作確認・システム構成に関するドキュメントです。

## 目次

- [概要](#概要)
- [システム構成](#システム構成)
  - [アーキテクチャ図](#アーキテクチャ図)
  - [ディレクトリ構成](#ディレクトリ構成)
  - [技術スタック](#技術スタック)
- [セットアップ](#セットアップ)
  - [前提条件](#前提条件)
  - [インストール](#インストール)
  - [環境変数](#環境変数)
  - [ウィジェットビルド](#ウィジェットビルド)
  - [起動方法](#起動方法)
- [動作確認](#動作確認)
  - [ヘルスチェック](#ヘルスチェック)
  - [MCP プロトコルの基本](#mcp-プロトコルの基本)
  - [sample.http を使ったテスト](#samplehttp-を使ったテスト)
  - [ユニットテスト](#ユニットテスト)
  - [トラブルシューティング](#トラブルシューティング)
- [機能一覧](#機能一覧)
  - [HTTP エンドポイント](#http-エンドポイント)
  - [MCP ツール一覧](#mcp-ツール一覧)
  - [UI ウィジェット (MCP リソース)](#ui-ウィジェット-mcp-リソース)
  - [OAuth スコープ](#oauth-スコープ)
- [認証フロー](#認証フロー)
- [バックエンド API マッピング](#バックエンド-api-マッピング)

---

## 概要

SubsidyPayment MCP Server は、[Model Context Protocol (MCP)](https://modelcontextprotocol.io/) に準拠した HTTP サーバーです。ChatGPT などの MCP クライアントと Rust バックエンドの間に位置し、スポンサー付きサービスの検索・タスク管理・ユーザー認証などの機能を提供します。

**主な役割:**

- MCP クライアントからの JSON-RPC リクエストを受け付け、Rust バックエンドの REST API に変換
- OAuth 2.0 (Auth0) によるユーザー認証・認可
- UI ウィジェット (HTML) を MCP リソースとして配信

---

## システム構成

### アーキテクチャ図

```
┌─────────────────┐     JSON-RPC/HTTP      ┌─────────────────┐     REST API     ┌─────────────────┐
│                 │    POST /mcp            │                 │   /gpt/*         │                 │
│  MCP クライアント │ ───────────────────────→ │  MCP Server     │ ────────────────→ │  Rust Backend   │
│  (ChatGPT 等)   │ ←─────────────────────── │  (Node.js)      │ ←──────────────── │  (Actix-web)    │
│                 │                         │  :3001           │                  │  :3000           │
└─────────────────┘                         └────────┬────────┘                  └─────────────────┘
                                                     │
                                               ┌─────┴─────┐
                                               │  Auth0     │
                                               │  (OAuth)   │
                                               └───────────┘
```

**通信フロー:**

1. MCP クライアントが `POST /mcp` に JSON-RPC バッチリクエストを送信
2. MCP Server が認証検証 (必要な場合) を実行
3. MCP Server が Rust バックエンドの REST API を呼び出し
4. レスポンスを JSON-RPC 形式に変換してクライアントに返却

### ディレクトリ構成

```
mcp-server/
├── src/
│   ├── main.ts                 # Express アプリ & HTTP サーバー起動
│   ├── server.ts               # MCP サーバーインスタンス生成
│   ├── config.ts               # 環境変数の読み込み
│   ├── logger.ts               # Pino ロガー
│   ├── types.ts                # TypeScript 型定義 (リクエスト/レスポンス)
│   ├── backend-client.ts       # Rust バックエンドへの HTTP クライアント
│   ├── auth/
│   │   ├── token-verifier.ts   # JWT (Auth0) トークン検証
│   │   └── oauth-metadata.ts   # OAuth メタデータエンドポイント
│   ├── tools/                  # MCP ツール実装
│   │   ├── index.ts            # 全ツール登録のエントリポイント
│   │   ├── search-services.ts  # サービス検索
│   │   ├── authenticate-user.ts # ユーザー認証
│   │   ├── get-task-details.ts # タスク詳細取得
│   │   ├── complete-task.ts    # タスク完了報告
│   │   ├── run-service.ts      # サービス実行
│   │   ├── get-user-status.ts  # ユーザー状態確認
│   │   ├── get-preferences.ts  # 設定取得
│   │   └── set-preferences.ts  # 設定変更
│   └── widgets/                # UI ウィジェット
│       ├── index.ts            # ウィジェットリソース登録
│       └── src/
│           ├── common.ts       # 共通ユーティリティ
│           ├── services-list.html
│           ├── task-form.html
│           └── user-dashboard.html
├── __tests__/                  # ユニットテスト・E2E テスト
├── tests/                      # タスクベースのテスト
├── dist/                       # ビルド出力
├── package.json
├── tsconfig.json
└── vite.config.ts              # ウィジェットビルド設定
```

### 技術スタック

| カテゴリ | 技術 | 用途 |
|---------|------|------|
| ランタイム | Node.js | サーバー実行環境 |
| フレームワーク | Express 4.x | HTTP サーバー |
| MCP SDK | `@modelcontextprotocol/sdk` | MCP プロトコル実装 |
| MCP 拡張 | `@modelcontextprotocol/ext-apps` | ツール/リソース登録ヘルパー |
| 認証 | `jsonwebtoken` + `jwks-rsa` | Auth0 JWT 検証 |
| バリデーション | Zod | 入力スキーマ検証 |
| ロギング | Pino | 構造化ログ |
| ウィジェットビルド | Vite + `vite-plugin-singlefile` | HTML ウィジェットバンドル |
| テスト | Vitest | テストフレームワーク |
| 開発ツール | tsx | TypeScript 直接実行 |

---

## セットアップ

### 前提条件

- **Node.js** v18 以上
- **npm** (Node.js に同梱)
- **Rust バックエンド** が起動していること (`localhost:3000`)

### インストール

```bash
cd mcp-server
npm install
```

### 環境変数

`.env` ファイルを `mcp-server/` 直下に作成するか、環境変数を直接設定します。

| 変数名 | デフォルト値 | 必須 | 説明 |
|--------|-------------|------|------|
| `RUST_BACKEND_URL` | `http://localhost:3000` | - | Rust バックエンドの URL |
| `MCP_INTERNAL_API_KEY` | (空文字列) | 本番: 必須 | Rust バックエンド認証用 API キー |
| `AUTH0_DOMAIN` | (空文字列) | 認証使用時: 必須 | Auth0 ドメイン (例: `your-tenant.auth0.com`) |
| `AUTH0_AUDIENCE` | (空文字列) | 認証使用時: 必須 | Auth0 API Audience |
| `PUBLIC_URL` | `http://localhost:3001` | - | MCP サーバーの公開 URL |
| `PORT` | `3001` | - | MCP サーバーのリッスンポート |
| `LOG_LEVEL` | `info` | - | ログレベル (`debug`, `info`, `warn`, `error`) |

**ローカル開発用の最小構成:**

```bash
# Rust バックエンドだけ動いていれば、認証なしの search_services は動作します
# Auth0 の設定は認証が必要なツールを使う場合のみ必要
export RUST_BACKEND_URL=http://localhost:3000
export PORT=3001
```

### ウィジェットビルド

UI ウィジェットを利用する場合は事前にビルドが必要です。

```bash
cd mcp-server
npm run build
```

これにより `dist/widgets/` 配下に単一 HTML ファイルが生成されます。

### 起動方法

**開発モード** (tsx でホットリロード):

```bash
cd mcp-server
npm run dev
```

**本番モード** (ビルド済み JS を実行):

```bash
cd mcp-server
npm run build
npm start
```

起動後、ターミナルに以下のようなログが表示されれば成功です:

```
{"level":30,"msg":"MCP server started","port":3001}
```

---

## 動作確認

### ヘルスチェック

サーバーが起動しているか確認します。

```bash
curl http://localhost:3001/health
```

**期待レスポンス:**

```json
{
  "status": "ok",
  "version": "0.1.0",
  "uptime": 12.345
}
```

### MCP プロトコルの基本

このサーバーは **ステートレスモード** で動作しています。リクエストごとに新しい MCP サーバーインスタンスが生成されるため、ツール呼び出しには **JSON-RPC バッチリクエスト** が必要です。

```
[initialize] → [notifications/initialized] → [tools/call]
```

この 3 つのメッセージを **1 つの HTTP POST で配列として送信** します。

**例: search_services の呼び出し**

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '[
    {
      "jsonrpc": "2.0",
      "id": 1,
      "method": "initialize",
      "params": {
        "protocolVersion": "2025-03-26",
        "capabilities": {},
        "clientInfo": { "name": "curl-test", "version": "1.0.0" }
      }
    },
    {
      "jsonrpc": "2.0",
      "method": "notifications/initialized"
    },
    {
      "jsonrpc": "2.0",
      "id": 2,
      "method": "tools/call",
      "params": {
        "name": "search_services",
        "arguments": {}
      }
    }
  ]'
```

**なぜバッチリクエストが必要か:**

`main.ts` の `/mcp` ハンドラは、リクエストごとに `new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })` と `createServer()` を生成します。このため、単体の `tools/call` リクエストは「未初期化のサーバー」に当たり失敗します。バッチリクエストにすることで、同一インスタンス上で `initialize` → `tools/call` が順番に処理されます。

### sample.http を使ったテスト

プロジェクトルートに `sample.http` ファイルが用意されています。VS Code の [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) 拡張を使って GUI でテストできます。

**手順:**

1. VS Code に REST Client 拡張をインストール
2. MCP サーバーを起動 (`cd mcp-server && npm run dev`)
3. Rust バックエンドを起動 (`localhost:3000`)
4. `sample.http` を開く
5. 各リクエストの上に表示される **Send Request** をクリック

**sample.http の構成:**

| セクション | 内容 | 認証 |
|-----------|------|------|
| 1. ヘルスチェック | `GET /health` | 不要 |
| 2. OAuth メタデータ | `.well-known` エンドポイント | 不要 |
| 3. MCP Initialize | 疎通確認 (単体) | 不要 |
| 4. ツール一覧 | `tools/list` | 不要 |
| 5. search_services | サービス検索 (3 パターン) | 不要 |
| 6. authenticate_user | ユーザー認証 | OAuth 必須 |
| 7. get_user_status | ユーザー状態確認 | OAuth 必須 |
| 8. get_task_details | タスク詳細取得 | OAuth 必須 |
| 9. complete_task | タスク完了報告 | OAuth 必須 |
| 10. run_service | サービス実行 | OAuth 必須 |
| 11. get_preferences | 設定取得 | OAuth 必須 |
| 12. set_preferences | 設定変更 | OAuth 必須 |
| 13. リソース一覧 | `resources/list` | 不要 |
| 14. バックエンド直接 | Rust API デバッグ用 | API Key |

> **Tip:** 認証不要のセクション 1 ~ 5 は、Rust バックエンドが起動していればすぐにテストできます。

### ユニットテスト

```bash
cd mcp-server
npm test
```

テストファイルは `__tests__/` と `tests/` に格納されています。

### トラブルシューティング

| 症状 | 原因 | 対処 |
|------|------|------|
| `tools/call` で空レスポンスまたはエラー | 初期化なしで単体送信している | JSON-RPC バッチリクエスト (配列形式) で送信する |
| `backend_unavailable` エラー | Rust バックエンドが起動していない | `cargo run` でバックエンドを起動する |
| `ECONNREFUSED :3000` | Rust バックエンドに接続できない | `RUST_BACKEND_URL` が正しいか確認する |
| `auth_server_not_configured` | Auth0 環境変数が未設定 | `AUTH0_DOMAIN` / `AUTH0_AUDIENCE` を設定する |
| ウィジェットが読み込めない | ビルド未実行 | `npm run build` を実行する |
| CORS エラー (ブラウザから直接アクセス時) | 許可オリジン外 | CORS は ChatGPT 向け設定。ローカルテストは curl / REST Client を使用 |

---

## 機能一覧

### HTTP エンドポイント

| メソッド | パス | 説明 |
|---------|------|------|
| `GET` | `/health` | ヘルスチェック |
| `GET` | `/.well-known/oauth-protected-resource` | OAuth Protected Resource メタデータ |
| `GET` | `/.well-known/oauth-authorization-server` | Auth0 へリダイレクト |
| `POST` | `/mcp` | MCP プロトコルエンドポイント (全ツール・リソースの窓口) |

### MCP ツール一覧

#### search_services (サービス検索)

スポンサー付きサービスを検索する。**認証不要**。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `q` | string | - | 検索キーワード |
| `category` | string | - | カテゴリフィルタ |
| `max_budget_cents` | number | - | 最大予算 (セント) |
| `intent` | string | - | ユーザーの意図 (自然言語) |
| `session_token` | string | - | セッショントークン (パーソナライズ用) |

**レスポンス:** サービス一覧、件数、適用されたフィルタ、利用可能カテゴリ

---

#### authenticate_user (ユーザー認証)

OAuth トークンを使ってユーザーを認証・登録する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `email` | string | - | メールアドレス (OAuth トークンから自動取得) |
| `region` | string | - | リージョン (デフォルト: `auto`) |
| `roles` | string[] | - | ロール |
| `tools_used` | string[] | - | 使用ツール |

**認証:** OAuth 必須 (スコープ: `user.write`)
**レスポンス:** `session_token`, `user_id`, `email`, `is_new_user`

---

#### get_task_details (タスク詳細取得)

キャンペーンの必要タスクの詳細を取得する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `campaign_id` | string | 必須 | キャンペーン ID (UUID 形式) |
| `session_token` | string | - | セッショントークン |

**認証:** OAuth 必須 (スコープ: `tasks.read`)
**レスポンス:** タスク説明、入力フォーマット、補助金額、完了状態

---

#### complete_task (タスク完了)

タスク完了情報と同意情報を記録する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `campaign_id` | string | 必須 | キャンペーン ID (UUID) |
| `task_name` | string | 必須 | タスク名 |
| `details` | string | - | 詳細情報 |
| `session_token` | string | - | セッショントークン |
| `consent.data_sharing_agreed` | boolean | 必須 | データ共有同意 |
| `consent.purpose_acknowledged` | boolean | 必須 | 目的確認 |
| `consent.contact_permission` | boolean | 必須 | 連絡許可 |

**認証:** OAuth 必須 (スコープ: `tasks.write`)
**レスポンス:** 完了 ID、同意記録状況、サービス利用可否

---

#### run_service (サービス実行)

スポンサー支払い付きでサービスを実行する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `service` | string | 必須 | サービス名 |
| `input` | string | 必須 | 入力データ |
| `session_token` | string | - | セッショントークン |

**認証:** OAuth 必須 (スコープ: `services.execute`)
**レスポンス:** 実行結果、支払モード (`sponsored` / `user_direct`)、スポンサー名、トランザクションハッシュ

---

#### get_user_status (ユーザー状態確認)

ユーザーの登録状態、完了済みタスク、利用可能サービスを確認する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `session_token` | string | - | セッショントークン |

**認証:** OAuth 必須 (スコープ: `user.read`)
**レスポンス:** ユーザー情報、完了タスク一覧、利用可能サービス一覧

---

#### get_preferences (設定取得)

ユーザーのタスク設定を取得する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `session_token` | string | - | セッショントークン |

**認証:** OAuth 必須 (スコープ: `user.read`)
**レスポンス:** 設定一覧 (`task_type` + `level`)、更新日時

---

#### set_preferences (設定変更)

ユーザーのタスク設定を更新する。

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `session_token` | string | - | セッショントークン |
| `preferences[].task_type` | string | 必須 | タスクタイプ |
| `preferences[].level` | string | 必須 | レベル (`preferred` / `neutral` / `avoided`) |

**認証:** OAuth 必須 (スコープ: `user.write`)
**レスポンス:** 設定件数、更新日時

---

### UI ウィジェット (MCP リソース)

| リソース URI | ウィジェット名 | 関連ツール | 説明 |
|-------------|--------------|-----------|------|
| `ui://widget/services-list.html` | services-list | search_services | サービス一覧表示 |
| `ui://widget/task-form.html` | task-form | get_task_details | タスク入力フォーム |
| `ui://widget/user-dashboard.html` | user-dashboard | get_user_status | ユーザーダッシュボード |

ウィジェットは Vite + `vite-plugin-singlefile` で単一 HTML ファイルにバンドルされます。
利用するには `npm run build` でビルドが必要です。

### OAuth スコープ

| スコープ | 説明 | 使用ツール |
|---------|------|-----------|
| `user.read` | ユーザー情報の読み取り | get_user_status, get_preferences |
| `user.write` | ユーザー情報の書き込み | authenticate_user, set_preferences |
| `tasks.read` | タスク情報の読み取り | get_task_details |
| `tasks.write` | タスク完了の記録 | complete_task |
| `services.execute` | サービスの実行 | run_service |

---

## 認証フロー

```
┌──────────┐    ①OAuth Token    ┌──────────┐   ②JWT検証     ┌─────────┐
│  MCP     │ ─────────────────→ │  MCP     │ ─────────────→ │  Auth0  │
│  Client  │                    │  Server  │ ←───────────── │  JWKS   │
└──────────┘                    └────┬─────┘                └─────────┘
                                     │
                               ③email,sub 抽出
                                     │
                                     ▼
                              ┌──────────────┐   ④POST /gpt/auth   ┌───────────┐
                              │ authenticate │ ──────────────────→  │  Rust     │
                              │ _user tool   │ ←────────────────── │  Backend  │
                              └──────────────┘   session_token      └───────────┘
                                     │
                               ⑤session_token を
                                以降のツールで使用
```

1. クライアントが `Authorization: Bearer <token>` ヘッダーで OAuth トークンを送信
2. MCP Server が Auth0 の JWKS エンドポイントからキーを取得し JWT を検証
3. トークンから `email` と `sub` (ユーザー識別子) を抽出
4. Rust バックエンドの `/gpt/auth` に認証情報を送信し `session_token` を取得
5. 以降のツール呼び出しで `session_token` を使用

---

## バックエンド API マッピング

MCP ツールと Rust バックエンド API の対応表です。

| MCP ツール | HTTP メソッド | バックエンド API パス | 認証 |
|-----------|-------------|---------------------|------|
| search_services | `GET` | `/gpt/services?{params}` | API Key |
| authenticate_user | `POST` | `/gpt/auth` | API Key |
| get_task_details | `GET` | `/gpt/tasks/{campaign_id}?session_token=...` | API Key |
| complete_task | `POST` | `/gpt/tasks/{campaign_id}/complete` | API Key |
| run_service | `POST` | `/gpt/services/{service}/run` | API Key |
| get_user_status | `GET` | `/gpt/user/status?session_token=...` | API Key |
| get_preferences | `GET` | `/gpt/preferences?session_token=...` | API Key |
| set_preferences | `POST` | `/gpt/preferences` | API Key |

> MCP Server → Rust バックエンド間の認証は `Authorization: Bearer {MCP_INTERNAL_API_KEY}` ヘッダーで行われます。

---

## CORS 設定

MCP Server の CORS は以下のオリジンのみ許可されています。

- `https://chatgpt.com`
- `https://cdn.oaistatic.com`
- `https://web-sandbox.oaiusercontent.com`

ローカル開発でブラウザから直接アクセスする場合は CORS エラーが発生します。テストには **curl** または **VS Code REST Client** を使用してください。
