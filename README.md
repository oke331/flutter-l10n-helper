# Flutter L10n Helper

Flutter コードでローカライズされたテキストをインラインで表示するための VSCode 拡張機能です。

## 機能

- コード内の l10n キーの横に ARB ファイルから実際のローカライズされたテキストを表示
- カスタム正規表現パターンによる柔軟なマッチング
- コードの右側に斜体で翻訳を表示
- 長い翻訳を省略記号で切り詰め（文字数は設定可能）


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
  "l10nHelper.preferredLocale": "ja",
  "l10nHelper.maxTextLength": 20,
  "l10nHelper.customPatterns": [
    { "pattern": "context\\.l10n\\.([a-zA-Z0-9_]+)", "type": "firstGroup" },
    { "pattern": "(?<!\\w)l10n\\.([a-zA-Z0-9_]+)", "type": "firstGroup" },
    { "pattern": "(\\w+)\\s*:\\s*(?:context\\.)?l10n\\.([a-zA-Z0-9_]+)", "type": "secondGroup" },
    { "pattern": "L10n\\.of\\(\\s*(\\w+)\\s*\\)!\\.([a-zA-Z0-9_]+)", "type": "secondGroup" },
    { "pattern": "L10n\\.of\\(\\s*(\\w+)\\s*\\)\\?\\.([a-zA-Z0-9_]+)", "type": "secondGroup" },
    { "pattern": "(\\w+)\\s*:\\s*L10n\\.of\\(\\s*\\w+\\s*\\)!\\.([a-zA-Z0-9_]+)", "type": "secondGroup" },
    { "pattern": "(\\w+)\\s*:\\s*L10n\\.of\\(\\s*\\w+\\s*\\)\\?\\.([a-zA-Z0-9_]+)", "type": "secondGroup" }
  ]
}
```

> **注意**: settings.jsonでは、バックスラッシュ（`\`）を2重にエスケープする必要があります。上記の例では、すでに正しくエスケープされています。例えば、`.` は `\\.` と記述します。

- `l10nHelper.enabled`: 拡張機能の有効/無効を切り替え
- `l10nHelper.arbPath`: ワークスペースのルートからの ARB ファイルへのパス
- `l10nHelper.preferredLocale`: 表示する優先ロケール（例：日本語の場合は "ja"）
- `l10nHelper.maxTextLength`: 表示するテキストの最大長（この長さを超えると「...」で省略されます）
- `l10nHelper.customPatterns`: 正規表現パターンの配列（**必須**）

### 正規表現パターン

この拡張機能では、l10n キーを検出するために正規表現パターンを使用します。上記の設定例には、一般的な Flutter の l10n パターンが含まれています。プロジェクト固有のパターンがある場合は、これらのパターンを修正したり、新しいパターンを追加したりすることができます。

各パターンには以下のプロパティが必要です：

- `pattern`: 正規表現パターン文字列。キーをキャプチャするためのグループ（括弧で囲まれた部分）を含める必要があります。
- `type`: キャプチャグループのどの部分がl10nキーなのかを指定します。
  - `firstGroup`: 最初のキャプチャグループ（1番目の括弧）がl10nキー
  - `secondGroup`: 2番目のキャプチャグループ（2番目の括弧）がl10nキー

#### 正規表現パターンと対応するコード例

以下に、各パターンとそれに対応するDartコードの例を示します：

1. `context\\.l10n\\.([a-zA-Z0-9_]+)` - `firstGroup`
   ```dart
   Text(context.l10n.hello_world)  // hello_worldがキー
   ```

2. `(?<!\\w)l10n\\.([a-zA-Z0-9_]+)` - `firstGroup`
   ```dart
   Text(l10n.welcome_message)  // welcome_messageがキー
   ```

3. `(\\w+)\\s*:\\s*(?:context\\.)?l10n\\.([a-zA-Z0-9_]+)` - `secondGroup`
   ```dart
   label: context.l10n.submit_button  // submit_buttonがキー
   ```

4. `L10n\\.of\\(\\s*(\\w+)\\s*\\)!\\.([a-zA-Z0-9_]+)` - `secondGroup`
   ```dart
   Text(L10n.of(context)!.cancel_button)  // cancel_buttonがキー
   ```

5. `L10n\\.of\\(\\s*(\\w+)\\s*\\)\\?\\.([a-zA-Z0-9_]+)` - `secondGroup`
   ```dart
   Text(L10n.of(context)?.ok_button)  // ok_buttonがキー
   ```

6. `(\\w+)\\s*:\\s*L10n\\.of\\(\\s*\\w+\\s*\\)!\\.([a-zA-Z0-9_]+)` - `secondGroup`
   ```dart
   title: L10n.of(context)!.page_title  // page_titleがキー
   ```

7. `(\\w+)\\s*:\\s*L10n\\.of\\(\\s*\\w+\\s*\\)\\?\\.([a-zA-Z0-9_]+)` - `secondGroup`
   ```dart
   hint: L10n.of(context)?.input_hint  // input_hintがキー
   ```

**注意**: 
- `l10nHelper.customPatterns` の設定は必須です。設定されていない場合、拡張機能は l10n キーを検出できません。
- 高度な正規表現機能（否定先読み/後読みなど）を使用する場合は、VSCodeの正規表現エンジンがそれらをサポートしていることを確認してください。

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

長い翻訳は切り詰められます（`l10nHelper.maxTextLength` で指定した文字数を超える場合）：

```dart
Text(context.l10n.very_long_text) とても長いテキストは...
```

## トラブルシューティング

翻訳が表示されない場合：

1. 拡張機能が有効になっていることを確認（`l10nHelper.enabled` が `true` に設定されている）
2. ARB パスが正しいことを確認（`l10nHelper.arbPath`）
3. 優先ロケールが ARB ファイルに存在することを確認
4. `l10nHelper.customPatterns` が正しく設定されていることを確認
5. `L10n Helper: Reload ARB Files` コマンドで ARB ファイルを再読み込み

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
