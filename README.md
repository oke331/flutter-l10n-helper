# Flutter L10n Helper

Flutter コードでローカライズされたテキストをインラインで表示するための VSCode 拡張機能です。

## 機能

- コード内の l10n キーの横に ARB ファイルから実際のローカライズされたテキストを表示
- 下記の形式をサポート
  - `L10n.of(context)!.key`
  - `L10n.of(context)?.key`
  - `context.l10n.key`
  - `l10n.key`
- コードの右側に斜体で翻訳を表示
- 長い翻訳（20文字以上）を省略記号で切り詰め


## インストール方法

### VSIX からインストール

1. `flutter-l10n-helper.vsix` ファイルをダウンロード
1. VSCode で拡張機能ビュー（Ctrl+Shift+X）を開く
1. 拡張機能ビューの右上にある「...」メニューをクリック ※VSCodeのActivityBarが上にあると表示されない可能性があります
1. 「VSIX からインストール...」を選択し、ダウンロードしたファイルを選択

## 設定

以下の設定を VSCode の settings.json に追加してください。
※ 適宜ご自身の環境に合わせて設定を修正してください。

```json
{
  "l10nHelper.enabled": true,
  "l10nHelper.arbPath": "assets/strings",
  "l10nHelper.preferredLocale": "ja"
}
```

- `l10nHelper.enabled`: 拡張機能の有効/無効を切り替え
- `l10nHelper.arbPath`: ワークスペースのルートからの ARB ファイルへのパス
- `l10nHelper.preferredLocale`: 表示する優先ロケール（例：日本語の場合は "ja"）

## コマンド

- `L10n Helper: Toggle`: 翻訳の表示を切り替え
- `L10n Helper: Reload ARB Files`: ARB ファイルが変更された場合に再読み込み

## 動作の仕組み

この拡張機能はプロジェクトから ARB ファイルを読み込み、コード内の l10n キーの上にコメントとして翻訳を表示します。これにより、ARB ファイルでキーを調べることなく、ローカライズされたテキストが何であるかを簡単に理解できます。

例えば、以下のようなコードがある場合：

```dart
Text(context.l10n.ok_button)
```

次のように表示されます：

```dart
Text(context.l10n.ok_button) OK
```

長い翻訳は切り詰められます：

```dart
Text(context.l10n.very_long_text) とても長いテキストは...
```

## トラブルシューティング

翻訳が表示されない場合：

1. 拡張機能が有効になっていることを確認（`l10nHelper.enabled` が `true` に設定されている）
2. ARB パスが正しいことを確認（`l10nHelper.arbPath`）
3. 優先ロケールが ARB ファイルに存在することを確認
4. `L10n Helper: Reload ARB Files` コマンドで ARB ファイルを再読み込み

## VSIXパッケージの作成方法

GitHub リポジトリから独自に編集して VSCode 拡張機能の VSIX パッケージを作成するには、以下の手順に従ってください：

### パッケージ作成手順

リポジトリには以下のスクリプトファイルが用意されています：

- `build_vsix.sh`: 新規にVSIXパッケージを作成するスクリプト
- `update_vsix.sh`: 既存のVSIXパッケージを更新するスクリプト

#### 新規パッケージの作成

新規にVSIXパッケージを作成するには、以下のコマンドを実行します：

```bash
./build_vsix.sh
```

このスクリプトは以下の処理を行います：
1. 一時ディレクトリ `temp_extract/extension` を作成
2. 必要なファイルを適切なディレクトリにコピー
3. VSIXパッケージを作成（`flutter-l10n-helper.vsix`）
4. 一時ディレクトリを削除
