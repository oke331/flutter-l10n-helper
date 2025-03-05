// L10n Helper - VSCode Extension for Flutter ARB files
// This script helps to display the actual localized text in code instead of l10n keys

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

let arbCache = {};
let timeout = null;
const DEFAULT_MAX_TEXT_LENGTH = 20; // デフォルトの最大テキスト長
// 一つの装飾タイプを使い回す
let singleDecorationType = null;

// 現在のドキュメントの装飾を保持
let currentDecorations = [];

/**
 * 設定から正規表現パターンを取得する
 * @returns {Array} 正規表現パターンの配列
 */
function getL10nPatterns() {
  const config = vscode.workspace.getConfiguration("l10nHelper");
  const customPatterns = config.get("customPatterns") || [];

  // カスタムパターンを正規表現オブジェクトに変換
  const patterns = [];

  try {
    for (const patternObj of customPatterns) {
      if (patternObj.pattern && patternObj.type) {
        patterns.push({
          pattern: new RegExp(patternObj.pattern, "g"),
          type: patternObj.type
        });
      }
    }

    return patterns;
  } catch (error) {
    console.error("Error parsing custom patterns:", error);
    return [];
  }
}

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("L10n Helper is now active");

  // Load ARB files on startup
  loadArbFiles();

  // 設定を取得
  const config = vscode.workspace.getConfiguration("l10nHelper");
  const arbPath = config.get("arbPath") || "assets/strings";

  // Register commands
  const toggleCommand = vscode.commands.registerCommand(
    "l10nHelper.toggle",
    () => {
      const config = vscode.workspace.getConfiguration("l10nHelper");
      const enabled = !config.get("enabled");
      config.update("enabled", enabled, true);

      vscode.window.showInformationMessage(
        `L10n Helper: ${enabled ? "Enabled" : "Disabled"}`
      );

      if (enabled) {
        updateDecorations();
      } else {
        clearDecorations();
      }
    }
  );

  const reloadCommand = vscode.commands.registerCommand(
    "l10nHelper.reload",
    () => {
      loadArbFiles();
      updateDecorations();
      vscode.window.showInformationMessage("L10n Helper: ARB files reloaded");
    }
  );

  // ARBファイルの変更を監視
  // ワークスペースのARBファイルを監視するパターンを作成
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders) {
    const arbGlobPattern = new vscode.RelativePattern(
      workspaceFolders[0],
      `${arbPath}/**/*.arb`
    );

    // ファイル監視を設定
    const arbWatcher = vscode.workspace.createFileSystemWatcher(arbGlobPattern);

    // ファイルが作成されたとき
    context.subscriptions.push(
      arbWatcher.onDidCreate(() => {
        console.log("ARB file created, reloading...");
        loadArbFiles();
        updateDecorations();
      })
    );

    // ファイルが変更されたとき
    context.subscriptions.push(
      arbWatcher.onDidChange(() => {
        console.log("ARB file changed, reloading...");
        loadArbFiles();
        updateDecorations();
      })
    );

    // ファイルが削除されたとき
    context.subscriptions.push(
      arbWatcher.onDidDelete(() => {
        console.log("ARB file deleted, reloading...");
        loadArbFiles();
        updateDecorations();
      })
    );

    // ウォッチャー自体も登録
    context.subscriptions.push(arbWatcher);
  }

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("l10nHelper")) {
        const config = vscode.workspace.getConfiguration("l10nHelper");
        if (config.get("enabled")) {
          updateDecorations();
        } else {
          clearDecorations();
        }
      }
    })
  );

  // Watch for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        const config = vscode.workspace.getConfiguration("l10nHelper");
        if (config.get("enabled")) {
          // エディタが変わったら装飾をリセット
          clearDecorations();
          updateDecorations();
        }
      }
    })
  );

  // Watch for document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        // ドキュメントのバージョンを更新
        documentVersion = event.document.version;

        const config = vscode.workspace.getConfiguration("l10nHelper");
        if (config.get("enabled")) {
          triggerUpdateDecorations(event.contentChanges);
        }
      }
    })
  );

  // Register the commands
  context.subscriptions.push(toggleCommand, reloadCommand);

  // 拡張機能が非アクティブになったときのクリーンアップ
  context.subscriptions.push({
    dispose: () => {
      clearDecorations();
      if (singleDecorationType) {
        singleDecorationType.dispose();
        singleDecorationType = null;
      }
    }
  });

  // Initial update
  if (config.get("enabled")) {
    updateDecorations();
  }
}

/**
 * Deactivate the extension
 */
function deactivate() {
  clearDecorations();
  if (singleDecorationType) {
    singleDecorationType.dispose();
    singleDecorationType = null;
  }
}

/**
 * Load ARB files from the workspace
 */
function loadArbFiles() {
  // 既存のキャッシュをクリア
  arbCache = {};
  // 装飾もクリア
  clearDecorations();

  // Find ARB files in the workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const config = vscode.workspace.getConfiguration("l10nHelper");
  const arbPath = config.get("arbPath") || "assets/strings";
  const preferredLocale = config.get("preferredLocale") || "ja";

  const rootPath = workspaceFolders[0].uri.fsPath;
  const arbFolderPath = path.join(rootPath, arbPath);

  try {
    if (fs.existsSync(arbFolderPath)) {
      const files = fs.readdirSync(arbFolderPath);

      // Find the preferred locale file first
      const preferredFile = files.find(
        (file) => file.endsWith(".arb") && file.includes(preferredLocale)
      );

      if (preferredFile) {
        const filePath = path.join(arbFolderPath, preferredFile);
        try {
          const content = fs.readFileSync(filePath, "utf8");
          const arbData = JSON.parse(content);

          // Filter out metadata keys
          Object.keys(arbData).forEach((key) => {
            if (!key.startsWith("@") && typeof arbData[key] === "string") {
              arbCache[key] = arbData[key];
            }
          });

          console.log(
            `Loaded ${
              Object.keys(arbCache).length
            } translations from ${preferredFile}`
          );
        } catch (err) {
          console.error(`Error reading ARB file: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error(`Error accessing ARB folder: ${err.message}`);
  }
}

/**
 * テキストが長い場合に省略する
 * @param {string} text 元のテキスト
 * @returns {string} 省略されたテキスト
 */
function truncateText(text) {
  const config = vscode.workspace.getConfiguration("l10nHelper");
  const maxTextLength = config.get("maxTextLength") || DEFAULT_MAX_TEXT_LENGTH;

  if (text.length <= maxTextLength) {
    return text;
  }
  return text.substring(0, maxTextLength) + "...";
}

/**
 * Trigger an update of decorations with debounce
 * @param {Array} contentChanges 変更された内容
 */
function triggerUpdateDecorations(contentChanges = []) {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  // 変更が少ない場合は部分的な更新を行う
  const partialUpdate = contentChanges && contentChanges.length < 3;

  timeout = setTimeout(
    () => updateDecorations(partialUpdate, contentChanges),
    300
  );
}

/**
 * Update decorations in the active editor
 * @param {boolean} partialUpdate 部分的な更新かどうか
 * @param {Array} contentChanges 変更された内容
 */
function updateDecorations(partialUpdate = false, contentChanges = []) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return;

  const config = vscode.workspace.getConfiguration("l10nHelper");
  if (!config.get("enabled")) return;

  // Only process Dart files
  if (activeEditor.document.languageId !== "dart") return;

  // 一つの装飾タイプを作成（なければ）
  if (!singleDecorationType) {
    singleDecorationType = vscode.window.createTextEditorDecorationType({
      after: {
        color: new vscode.ThemeColor("editorCodeLens.foreground"),
        fontStyle: "italic"
      }
    });
  }

  const lineCount = activeEditor.document.lineCount;
  let newDecorations = [];

  // 部分更新の場合は変更された範囲のみを処理、それ以外は全体を処理
  if (partialUpdate && contentChanges.length > 0) {
    // 変更された範囲を特定
    const startLine = Math.max(
      0,
      activeEditor.document.positionAt(contentChanges[0].rangeOffset).line - 1
    );
    const lastChange = contentChanges[contentChanges.length - 1];
    const endLine = Math.min(
      lineCount,
      activeEditor.document.positionAt(
        lastChange.rangeOffset + lastChange.rangeLength
      ).line + 2
    );

    // 変更された範囲外の装飾を保持
    const unchangedDecorations = currentDecorations.filter(
      (decoration) =>
        decoration.range.start.line < startLine ||
        decoration.range.start.line >= endLine
    );

    // 変更された範囲の装飾を計算
    const changedDecorations = processLines(activeEditor, startLine, endLine);

    // 装飾を結合
    newDecorations = [...unchangedDecorations, ...changedDecorations];
  } else {
    // 全体を処理
    newDecorations = processLines(activeEditor, 0, lineCount);
  }

  // 装飾を適用
  if (newDecorations.length > 0) {
    activeEditor.setDecorations(singleDecorationType, newDecorations);
    // 現在の装飾を更新
    currentDecorations = newDecorations;
  } else {
    // 装飾がない場合はクリア
    clearDecorations();
    currentDecorations = [];
  }
}

/**
 * 指定された行範囲を処理して装飾を生成
 * @param {vscode.TextEditor} editor エディタ
 * @param {number} startLine 開始行
 * @param {number} endLine 終了行
 * @returns {Array} 装飾の配列
 */
function processLines(editor, startLine, endLine) {
  const decorations = [];
  // 設定から正規表現パターンを取得
  const l10nPatterns = getL10nPatterns();

  // 各行ごとに処理
  for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
    try {
      const line = editor.document.lineAt(lineIndex);
      const lineText = line.text;

      // 行内のすべてのl10nキーを検出
      const matches = [];

      // 行内のすべてのマッチを収集
      for (const patternObj of l10nPatterns) {
        const pattern = patternObj.pattern;
        const type = patternObj.type;

        // 正規表現のlastIndexをリセット
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(lineText)) !== null) {
          if (type === "secondGroup") {
            // 2番目のキャプチャグループがキー
            matches.push({
              key: match[2],
              index: match.index,
              length: match[0].length,
              type: type
            });
          } else if (
            pattern.toString().includes("L10n.of") &&
            type === "firstGroup"
          ) {
            // L10n.of形式の場合は2番目のキャプチャグループがキー
            matches.push({
              key: match[2],
              index: match.index,
              length: match[0].length,
              type: type
            });
          } else {
            // 通常の形式の場合は1番目のキャプチャグループがキー
            matches.push({
              key: match[1],
              index: match.index,
              length: match[0].length,
              type: type
            });
          }
        }
      }

      // マッチがあれば装飾を追加
      if (matches.length > 0) {
        const translatedTexts = [];

        for (const match of matches) {
          if (arbCache[match.key]) {
            translatedTexts.push(truncateText(arbCache[match.key]));
          }
        }

        // 重複を削除
        const uniqueTexts = [...new Set(translatedTexts)];

        if (uniqueTexts.length > 0) {
          const decorationText = uniqueTexts.join(", ");

          // 行の最後に装飾を適用
          const lineEndPos = new vscode.Position(lineIndex, line.text.length);
          decorations.push({
            range: new vscode.Range(lineEndPos, lineEndPos),
            renderOptions: {
              after: {
                contentText: ` ${decorationText}`
              }
            }
          });
        }
      }
    } catch (e) {
      // 行が存在しない場合などのエラーを無視
      console.error(`Error processing line ${lineIndex}: ${e.message}`);
    }
  }

  return decorations;
}

/**
 * Clear all decorations
 */
function clearDecorations() {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor || !singleDecorationType) return;

  activeEditor.setDecorations(singleDecorationType, []);
  currentDecorations = [];
}

module.exports = {
  activate,
  deactivate
};
