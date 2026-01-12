# 実装ガイド: Redmine Gantt Extra

このドキュメントでは、`redmine_gantt_extra` プラグインの技術的な実装詳細について説明します。

## アーキテクチャ概要

本プラグインは、主に以下の2つのメカニズムを通じてRedmineのガントチャートの動作を変更しています。
1.  **バックエンドパッチ**: `Redmine::Helpers::Gantt` をモンキーパッチし、チケット取得ロジックをカスタマイズします。
2.  **フロントエンド注入**: View Hookを通じてJavaScriptとCSSを注入し、UIの拡張とドラッグ＆ドロップ機能を実現します。

## コンポーネント

### 1. 初期化 (`init.rb`)

`init.rb` ファイルはプラグインのエントリーポイントです。以下の処理を行います。
- プラグインの登録。
- View Hook (`RedmineGanttExtra::Hooks`) の読み込み。
- Railsの自動リロードに対応するため、`to_prepare` コールバックを使用して `Redmine::Helpers::Gantt` へのバックエンドパッチ (`RedmineGanttExtra::PatchGantt`) を堅牢に適用します。

### 2. バックエンドロジック

#### ツリー表示フィルタ (`lib/redmine_gantt_extra/patch_gantt.rb`)
- **モジュール**: `RedmineGanttExtra::PatchGantt`
- **メソッド**: `Redmine::Helpers::Gantt` の `#issues` をオーバーライド（またはPrepend）します。
- **ロジック**:
    - 初期化オプションに `parent_issue_id` が存在するかチェックします。
    - 存在する場合、指定された親チケットとその子孫 (`parent.descendants.visible`) を取得します。
    - ガントチャートヘルパーが正しくインデントを描画できるように、Nested Setの `lft` カラム (`lft ASC`) でソートします。
    - `parent_issue_id` がない場合は、`super` を呼び出してRedmineの標準動作に戻します。

### 3. フロントエンドロジック (`assets/javascripts/redmine_gantt_extra.js`)

#### ドラッグ＆ドロップ
- Redmineに同梱されている jQuery UI Draggable を使用します。
- **初期化**: すべてのタスクバー (`.task_todo`, `.task_late`, `.task_done`) を検索し、そのツールチップをドラッグ可能にします。
- **スケーリング**: ガントチャートヘッダーのCSS位置を解析して `pixels_per_day`（1日あたりのピクセル数）を計算し、ドラッグ中の正確な日付変換を保証します。
- **更新**: ドラッグ終了時に移動日数を計算し、`/issues/:id.json` に対してAJAX PUTリクエストを送信して `start_date` と `due_date` を更新します。

#### 親チケットの変更（付け替え）
- **初期化**: `_private.initSubjectDraggables` が `.issue-subject` 要素を対象にします。
- **ドラッグ**: 視覚的なフィードバックのためにヘルパーが複製されます。
- **ドロップ**: 他の `.issue-subject` 要素を受け入れます。
- **アクション**: ドロップ時にユーザーに確認ダイアログを表示し、承諾されると `/issues/:id.json` へ `parent_issue_id` を更新するAJAX PUTリクエストを送信します。
- **フィードバック**: 成功時にページをリロードして新しい階層構造を反映させます。

#### 期間変更（リサイズ）
- **初期化**: `_private.initResizables` がガントチャート内の `.tooltip` 要素を対象にします。
- **ライブラリ**: jQuery UI Resizable（同梱）を使用し、'e' (東/右) と 'w' (西/左) のハンドルを有効化します。
- **UX**:
    - 操作性を向上させるため、ハンドルに視覚的なグリップ（CSS）を追加。
    - ドラッグ中に計算された日付を表示する動的ツールチップ (`.gantt-resize-tooltip`) を表示。
- **ロジック**:
    - **右ハンドル**: 幅の変更により `due_date`（期日）を更新します。
    - **左ハンドル**: 左位置の変更により `start_date`（開始日）を更新します。
- **日付計算**: タイムゾーンによるズレを防ぐため、ローカル時刻としてパースして計算します。
- **ズーム対応**: URLの `zoom` パラメータからRedmine標準のズーム定数（4, 8, 16, 24）を参照して1日あたりのピクセル数を正確に計算します。

#### クイック編集ポップアップ
- **トリガー**: ガントバー（`.tooltip`）のクリックイベント。
- **バックエンド**: `Hooks#view_layouts_base_html_head` を介して `RedmineGanttExtra.assignables`（`Project#assignable_users`）をJS環境に注入し、APIコールなしで担当者リストを生成します。
- **フロントエンド**: 
    - `_private.initQuickEditor` でクリックイベントをバインド。
    - `_private.openQuickEditor` で最新のチケット情報（JSON）を取得し、絶対配置のポップアップ (`.gantt-quick-edit-popup`) を描画。
- **UI**: 開始日、期日、進捗率（0-100%）、担当者の編集フィールドを提供。
- **アクション**: AJAX POST (method=put) でチケットを更新。

#### 日付表示モード（コンパクトモード）
- **トグル**: `_private.initModeToggle` が右上のコンテキストメニューに切替ボタンを追加します。ボタンのラベルは、`RedmineGanttExtraData.strings` を介して多言語対応されています。
- **永続化**: 選択状態は `sessionStorage` に保存され、セッション中のリロード後も維持されます。
- **ヘッダー変換 (`_private.transformHeader`)**:
    - **週行の非表示**: 週番号が表示されている行を特定し、非表示にします。
    - **日付置換**: 曜日ラベルを、カレンダー計算に基づいた日付数字に置換します。
    - **レイアウト調整**: ヘッダーの高さが減った分、ガントエリア全体を上方向にシフトさせ、デッドスペースを排除します。
    - **ズーム制限**: 整合性を保つため、原則として週単位以上のズーム（Zoom >= 2）で動作します。

#### UIの自動追従 (MutationObserver)
- Redmineの標準機能によるフィルタ適用や再描画が行われた際、変換したUI（日付表示など）が破棄されるのを防ぐため、`MutationObserver` を使用して `#gantt_area` の変化を監視し、必要に応じて自動的に再適用します。

#### ツリー表示入力フォーム
- **注入**: ガントチャートページ上の `#query_form` に「親チケットID」テキスト入力欄を動的に追加します。
- **ローカライズ**: Hook経由で注入された `RedmineGanttExtra.label_parent_issue_id` を使用してラベルを表示します。

### 4. 統合 (`lib/redmine_gantt_extra/hooks.rb`)

- **クラス**: `RedmineGanttExtra::Hooks < Redmine::Hook::ViewListener>`
- **フック**: `view_layouts_base_html_head`
- **ロジック**:
    - 現在のコントローラーが `GanttsController` であるかチェックします。
    - 真の場合、プラグインのCSSとJavaScriptファイルを追加します。
    - **翻訳データの注入**: UI上のすべてのテキスト（ボタンラベル、エラーメッセージ等）を、Railsのロケールファイルから取得し `RedmineGanttExtraData.strings` JSオブジェクトとしてフロントエンドに注入します。これにより、JS内でのハードコードを排除し、完全な多言語対応とメンテナンス性の向上を実現しています。

### 5. デザインシステム (`assets/stylesheets/redmine_gantt_extra.css`)

- **モダンな外観**: CSS変数を使用したカラー管理、グラスモーフィズム（背景ぼかし）、および滑らかなアニメーションを採用しています。
- **アクセシビリティ**: 週末の背景色強調や、リサイズハンドルの視覚的フィードバック（アイコン表示）により、直感的な操作をサポートします。

## ローカライズ
言語ファイルは `config/locales/` に配置されています。
- `en.yml`: 英語
- `ja.yml`: 日本語
