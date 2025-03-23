// L10n Helper - VSCode Extension for Flutter ARB files
// This script helps to display the actual localized text in code instead of l10n keys

const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

let arbCache = {};
let timeout = null;
let arbWatcher = null;

// Default maximum text length
const DEFAULT_MAX_TEXT_LENGTH = 20;

// Reuse a single decoration type
let singleDecorationType = null;

/**
 * Get default l10n patterns
 * @returns {Array} Array of default regex patterns
 */
function getDefaultL10nPatterns() {
  return [
    // AppLocalizations.of(context)?.helloWorld (most common)
    {
      pattern: new RegExp(
        "AppLocalizations\\.of\\(\\s*\\w+\\s*\\)\\?\\.(\\w+)",
        "g"
      )
    },
    // AppLocalizations.of(context)!.helloWorld
    {
      pattern: new RegExp(
        "AppLocalizations\\.of\\(\\s*\\w+\\s*\\)!\\.(\\w+)",
        "g"
      )
    },
    // appLocalizations.helloWorld
    {
      pattern: new RegExp("appLocalizations\\.(\\w+)", "g")
    },
    // context.l10n.hello_world
    {
      pattern: new RegExp("context\\.l10n\\.([a-zA-Z0-9_]+)", "g")
    },
    // l10n.welcome_message
    {
      pattern: new RegExp("(?<!\\w)l10n\\.([a-zA-Z0-9_]+)", "g")
    },
    // Text(L10n.of(context)!.cancel_button)
    {
      pattern: new RegExp("L10n\\.of\\(\\s*\\w+\\s*\\)!\\.([a-zA-Z0-9_]+)", "g")
    },
    // Text(L10n.of(context)?.ok_button)
    {
      pattern: new RegExp(
        "L10n\\.of\\(\\s*\\w+\\s*\\)\\?\\.([a-zA-Z0-9_]+)",
        "g"
      )
    }
  ];
}

/**
 * Get regex patterns from settings
 * @returns {Array} Array of regex patterns
 */
function getL10nPatterns() {
  const config = vscode.workspace.getConfiguration("flutterL10nHelper");
  const customPatterns = config.get("customPatterns") || [];
  const useDefaultPatterns = config.get("useDefaultPatterns");
  const shouldUseDefaultPatterns =
    useDefaultPatterns === undefined || useDefaultPatterns === null
      ? true
      : useDefaultPatterns;

  // Convert custom patterns to regex objects
  const patterns = [];

  try {
    // Get base patterns
    const basePatterns = [];
    if (shouldUseDefaultPatterns) {
      basePatterns.push(...getDefaultL10nPatterns());
    }

    // Add both versions of patterns: with and without colons
    for (const patternObj of basePatterns) {
      // Add original pattern with default captureGroup (1)
      patterns.push({
        pattern: patternObj.pattern,
        captureGroup: patternObj.captureGroup || 1
      });

      // Get the source from RegExp object
      const patternSource = patternObj.pattern.source;

      // Create a version with colon
      // Example: pattern → (\\w+)\\s*:\\s*pattern
      const colonPatternSource = "(\\\\w+)\\\\s*:\\\\s*" + patternSource;
      patterns.push({
        pattern: new RegExp(colonPatternSource, "g"),
        captureGroup: (patternObj.captureGroup || 1) + 1 // Shift the capture group by 1
      });
    }

    // Add custom patterns
    for (const patternObj of customPatterns) {
      if (patternObj.pattern) {
        // Original custom pattern
        patterns.push({
          pattern: new RegExp(patternObj.pattern, "g"),
          captureGroup: patternObj.captureGroup || 1 // Default to 1 if not specified
        });

        // Add version with colon
        const colonPatternSource = "(\\\\w+)\\\\s*:\\\\s*" + patternObj.pattern;
        patterns.push({
          pattern: new RegExp(colonPatternSource, "g"),
          captureGroup: (patternObj.captureGroup || 1) + 1 // Shift the capture group by 1
        });
      }
    }

    return patterns;
  } catch (error) {
    console.error("Error parsing patterns:", error);
    return [];
  }
}

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  console.log("Flutter L10n Helper is now active");

  // Get settings
  const config = vscode.workspace.getConfiguration("flutterL10nHelper");
  const arbPath = config.get("arbPath") || "lib/l10n";

  // Load ARB files on startup
  loadArbFiles();

  // Register reload command
  const reloadCommand = vscode.commands.registerCommand(
    "flutterL10nHelper.reload",
    () => {
      loadArbFiles();
      updateDecorations();
      vscode.window.showInformationMessage(
        "Flutter L10n Helper: ARB files reloaded"
      );
    }
  );

  // Setup ARB file watcher
  setupArbWatcher(context, arbPath);

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("flutterL10nHelper")) {
        // Reload ARB files when relevant settings are changed
        const needsWatcherReset = e.affectsConfiguration(
          "flutterL10nHelper.arbPath"
        );

        if (
          needsWatcherReset ||
          e.affectsConfiguration("flutterL10nHelper.preferredLocale")
        ) {
          loadArbFiles();
        }

        // Reset watcher if arbPath setting is changed
        if (needsWatcherReset) {
          const newConfig =
            vscode.workspace.getConfiguration("flutterL10nHelper");
          const newArbPath = newConfig.get("arbPath") || "lib/l10n";

          // Clean up the old watcher
          if (arbWatcher) {
            arbWatcher.dispose();
          }

          // Setup new watcher with updated path
          setupArbWatcher(context, newArbPath);
        }

        clearDecorations();
        updateDecorations();
      }
    })
  );

  // Watch for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor) {
        // Reset decorations when editor changes
        clearDecorations();
        updateDecorations();
      }
    })
  );

  // Watch for document changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument((event) => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor && event.document === activeEditor.document) {
        // Update document version
        documentVersion = event.document.version;
        triggerUpdateDecorations(event.contentChanges);
      }
    })
  );

  // Register the command
  context.subscriptions.push(reloadCommand);

  // Clean up when extension becomes inactive
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
  updateDecorations();
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
  // Clear existing cache
  arbCache = {};
  // Clear decorations
  clearDecorations();

  // Find ARB files in the workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const config = vscode.workspace.getConfiguration("flutterL10nHelper");
  const arbPath = config.get("arbPath") || "lib/l10n";
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
 * Truncate text if it's too long
 * @param {string} text Original text
 * @returns {string} Truncated text
 */
function truncateText(text) {
  const config = vscode.workspace.getConfiguration("flutterL10nHelper");
  const maxTextLength = config.get("maxTextLength") || DEFAULT_MAX_TEXT_LENGTH;

  if (text.length <= maxTextLength) {
    return text;
  }
  return text.substring(0, maxTextLength) + "...";
}

/**
 * Trigger an update of decorations with debounce
 * @param {Array} contentChanges Changes in content
 */
function triggerUpdateDecorations(contentChanges = []) {
  if (timeout) {
    clearTimeout(timeout);
    timeout = null;
  }

  // Perform partial update if changes are small
  const partialUpdate = contentChanges && contentChanges.length < 3;

  timeout = setTimeout(
    () => updateDecorations(partialUpdate, contentChanges),
    300
  );
}

/**
 * Update decorations in the active editor
 * @param {boolean} partialUpdate Whether this is a partial update
 * @param {Array} contentChanges Changes in content
 */
function updateDecorations(partialUpdate = false, contentChanges = []) {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) return;

  // Only process Dart files
  if (activeEditor.document.languageId !== "dart") return;

  // Create a single decoration type (if it doesn't exist)
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

  // Process everything
  newDecorations = processLines(activeEditor, 0, lineCount);

  // Apply decorations
  if (newDecorations.length > 0) {
    activeEditor.setDecorations(singleDecorationType, newDecorations);
    // Update current decorations
    currentDecorations = newDecorations;
  } else {
    // Clear decorations if there are none
    clearDecorations();
    currentDecorations = [];
  }
}

/**
 * Process the specified line range and generate decorations
 * @param {vscode.TextEditor} editor Editor
 * @param {number} startLine Start line
 * @param {number} endLine End line
 * @returns {Array} Array of decorations
 */
function processLines(editor, startLine, endLine) {
  const decorations = [];
  // Get regex patterns from settings
  const l10nPatterns = getL10nPatterns();

  // Process each line
  for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
    try {
      const line = editor.document.lineAt(lineIndex);
      const lineText = line.text;

      // Detect all l10n keys in the line
      const matches = [];

      // Collect all matches in the line
      for (const patternObj of l10nPatterns) {
        const pattern = patternObj.pattern;
        const captureGroup = patternObj.captureGroup;

        // Reset lastIndex of the regex
        pattern.lastIndex = 0;

        let match;
        while ((match = pattern.exec(lineText)) !== null) {
          if (match[captureGroup]) {
            matches.push({
              key: match[captureGroup],
              index: match.index,
              length: match[0].length
            });
          }
        }
      }

      // Add decorations if there are matches
      if (matches.length > 0) {
        const translatedTexts = [];

        for (const match of matches) {
          if (arbCache[match.key]) {
            translatedTexts.push(truncateText(arbCache[match.key]));
          }
        }

        // Remove duplicates
        const uniqueTexts = [...new Set(translatedTexts)];

        if (uniqueTexts.length > 0) {
          const decorationText = uniqueTexts.join(", ");

          // Apply decoration at the end of the line
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
      // Ignore errors such as non-existent lines
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

/**
 * Set up watcher for ARB files
 * @param {vscode.ExtensionContext} context Extension context
 * @param {string} arbPath Path to ARB files
 */
function setupArbWatcher(context, arbPath) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return;

  const arbGlobPattern = new vscode.RelativePattern(
    workspaceFolders[0],
    `${arbPath}/**/*.arb`
  );

  // Set up file watching
  arbWatcher = vscode.workspace.createFileSystemWatcher(arbGlobPattern);

  // When a file is created
  context.subscriptions.push(
    arbWatcher.onDidCreate(() => {
      console.log("ARB file created, reloading...");
      loadArbFiles();
      updateDecorations();
    })
  );

  // When a file is changed
  context.subscriptions.push(
    arbWatcher.onDidChange(() => {
      console.log("ARB file changed, reloading...");
      loadArbFiles();
      updateDecorations();
    })
  );

  // When a file is deleted
  context.subscriptions.push(
    arbWatcher.onDidDelete(() => {
      console.log("ARB file deleted, reloading...");
      loadArbFiles();
      updateDecorations();
    })
  );

  // Register the watcher itself
  context.subscriptions.push(arbWatcher);
}

module.exports = {
  activate,
  deactivate
};
