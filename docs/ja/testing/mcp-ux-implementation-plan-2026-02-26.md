# MCP UX改善 実装計画（2時間・最小影響）

## 1. 概要

本計画は「最小リスクで確実達成」を優先し、認証境界の変更は行わず、以下を2時間で実装する。

1. 全画面共通のチャット入力誘導バナー追加
2. 迷子復帰用ツール `get_prompt_guide_flow` 追加
3. 主要ツールの description / widgetDescription / toolInvocation 文言拡充
4. 各ツール結果に `next_actions` を返す共通誘導を追加（最小実装）
5. `run_service`→GitHub課題は「診断手順と再現手順の固定化」まで実施（コード統合は今回対象外）

---

## 2. スコープ

### IN

1. `mcp-server` のみ変更（Rustバックエンドは原則無変更）
2. `docs/ja/testing` に運用・再現手順を追記
3. 既存 E2E を壊さない最小差分実装

### OUT

1. OAuth/認証ポリシー変更（noauth化、ゲスト実行緩和）
2. `run_service` 内で GitHub 実行を一気通貫にする統合改修
3. DBスキーマ変更、マイグレーション追加

---

## 3. 変更対象ファイル

1. `mcp-server/src/tools/index.ts`
2. `mcp-server/src/tools/*`（既存主要ツール）
3. `mcp-server/src/tools/get-prompt-guide-flow.ts`（新規）
4. `mcp-server/src/server.ts`
5. `mcp-server/app-metadata.json`
6. `mcp-server/src/widgets/src/services-list.html`
7. `mcp-server/src/widgets/src/service-tasks.html`
8. `mcp-server/src/widgets/src/task-form.html`
9. `mcp-server/src/widgets/src/service-access.html`
10. `mcp-server/src/widgets/src/user-dashboard.html`
11. `mcp-server/tests/*`（新規テスト追加＋最小更新）
12. `docs/ja/testing/mcp-ux-improvement-analysis-2026-02-26.md`（必要箇所追記）
13. `docs/ja/testing/gpt-app-integration-prompts.md`（再現手順追記）

---

## 4. 実装詳細

## 4.1 サーバー/アプリ説明の拡充

1. `mcp-server/src/server.ts` の `new McpServer(...)` に `instructions` を追加。
2. `instructions` には以下を明示。
- 最初に必ず次の1手を提示する
- 手順逸脱時は `get_prompt_guide_flow` を優先
- 不確実な代替手順を自作しない
3. `mcp-server/app-metadata.json` の `description` を「迷わない6ステップ導線」を含む文面へ更新。

## 4.2 新規ツール `get_prompt_guide_flow` 追加

1. 新規ファイル `mcp-server/src/tools/get-prompt-guide-flow.ts` を作成。
2. ツール仕様:
- name: `get_prompt_guide_flow`
- security: `noauth`
- readOnlyHint: `true`
- input: `{ context_step?: string, service?: string, campaign_id?: string }`
- output `structuredContent`:
  - `flow_step`（`"0"`〜`"5"`）
  - `goal`
  - `recommended_next_prompt`（必ず1つ）
  - `copy_paste_prompts`（最大3）
  - `allowed_actions`（今回使えるツール名一覧）
  - `next_actions`（UI共通形式）
3. `mcp-server/src/tools/index.ts` に登録追加。
4. `openai/toolInvocation/*` と `openai/widgetDescription` を設定（テキスト出力中心、widget不要）。

## 4.3 `next_actions` 共通化（最小実装）

1. 既存主要ツールに `structuredContent.next_actions` を追加。
- 対象: `search_services`, `get_service_tasks`, `get_task_details`, `complete_task`, `run_service`, `get_user_status`, `authenticate_user`
2. `next_actions` 型を統一。
- `{ action: string, prompt: string, tool: string }[]`
3. 各ツールは成功時のみ最低1件返す。
4. 失敗時は `content.text` に「次に打つべき1文」を必ず含める。

## 4.4 description / widgetDescription 文言改修

1. 各ツールの `description` を「何を返すか + 次に何ができるか」まで記述。
2. `openai/widgetDescription` があるツールは「操作後にチャットで実行すべき文」を含める。
3. `openai/toolInvocation/invoked` を「完了」だけでなく次アクションが想起できる文言へ変更。

## 4.5 全画面共通バナー実装

1. 5つの widget HTML 全てに共通バナーを挿入。
- 表示: `チャットに入力してください（ask in chat to do tasks）`
- 視認性: 上部固定、強調色、十分な余白
2. クリック動作:
- `app.sendFollowUpMessage` があれば実行
- 送信文は widgetごとに現在ステップに合う推奨文を固定文で送る
3. `sendFollowUpMessage` 未対応環境では文言のみ表示し、フッターに手入力例を表示。
4. 既存UIロジックを壊さないよう、バナー関数を各HTML内で独立実装（共通JS化は今回は見送り）。

## 4.6 run_service→GitHub 課題の今回対応

1. 実装改修ではなく「診断手順固定」を追加。
2. `docs/ja/testing/gpt-app-integration-prompts.md` にチェック手順を追加。
- `service` 値
- `campaign.target_tools`
- `sponsored_apis.service_key`
- `run_service` 応答 `output`
3. 再現テンプレートを追加し、2分で切り分けできる状態にする。

---

## 5. 公開API/インターフェース変更

1. 新規MCPツール: `get_prompt_guide_flow`
2. 既存ツール出力に `structuredContent.next_actions` を追加（後方互換は維持。既存キーは削除しない）
3. `server instructions` 追加（MCPハンドシェイク時の利用ガイダンス強化）
4. `app-metadata description` 更新（外部公開文言の改善）

---

## 6. テスト計画

## 6.1 追加テスト

1. `mcp-server/tests/task-*.test.mjs` に新規:
- `get_prompt_guide_flow` 登録確認
- `noauth` 設定確認
- `recommended_next_prompt` / `next_actions` 出力キー確認
2. widgetテストに追記:
- 5画面すべてでバナー文言存在確認
- `sendFollowUpMessage` 呼び出しコード存在確認

## 6.2 既存テストの回帰確認

1. `npm test -- tests/task-5.2-authenticate-user.test.mjs`
2. `npm test -- tests/task-5.3-task-tools.test.mjs`
3. `npm test -- tests/task-5.4-run-service.test.mjs`
4. `npm test -- tests/task-6.2-services-list-widget.test.mjs`
5. `npm test -- tests/task-6.3-task-form-widget.test.mjs`
6. `npm test -- tests/task-7.5-widget-resources.test.mjs`

---

## 7. 2時間タイムボックス

1. 0:00-0:15 新規ツール `get_prompt_guide_flow` 追加と登録
2. 0:15-0:45 主要ツールへ `next_actions` と文言拡充
3. 0:45-1:20 5ウィジェットへ共通バナー実装
4. 1:20-1:40 テスト追加・既存テスト更新
5. 1:40-1:55 テスト実行・不具合修正
6. 1:55-2:00 ドキュメント追記と最終確認

---

## 8. 受け入れ基準

1. どの画面にも「チャットに入力してください（ask in chat to do tasks）」が表示される
2. `get_prompt_guide_flow` を呼ぶと、必ず次の1手（コピペ文）が返る
3. 主要ツールの成功レスポンスに `next_actions` が含まれる
4. OAuth境界は変更されず、既存認証テストが維持される
5. `run_service` のGitHub課題は、ドキュメント手順で再現・切り分け可能になる

---

## 9. 前提・デフォルト

1. 優先方針は「最小リスクで確実達成」
2. 認証緩和は今回実施しない
3. GitHub統合改修は次フェーズへ分離し、今回は診断導線のみ確立
4. 後方互換性を守るため既存レスポンスキーは削除しない
