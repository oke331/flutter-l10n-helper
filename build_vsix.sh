#!/bin/bash

# Flutter L10n Helper VSIX パッケージビルドスクリプト

# エラーが発生したら終了
set -e

echo "Flutter L10n Helper VSIX パッケージのビルドを開始します..."

# 一時ディレクトリを作成
echo "一時ディレクトリを作成しています..."
mkdir -p temp_extract/extension

# 必要なファイルをコピー
echo "必要なファイルをコピーしています..."
cp l10n_helper.js temp_extract/extension/
cp package.json temp_extract/extension/
cp extension.vsixmanifest temp_extract/

# READMEファイルを正しい場所にコピー
echo "READMEファイルをコピーしています..."
# VSCodeが認識する場所にREADMEをコピー
cp README.md temp_extract/
cp README.md temp_extract/extension/
mkdir -p temp_extract/extension/assets
cp README.md temp_extract/extension/assets/

# 画像ディレクトリが存在する場合はコピー
if [ -d "images" ]; then
  echo "画像ディレクトリをコピーしています..."
  cp -r images temp_extract/
  # 画像ディレクトリもextension/assetsにコピー
  mkdir -p temp_extract/extension/assets/images
  cp -r images/* temp_extract/extension/assets/images/
fi

# ディレクトリを移動
echo "VSIXパッケージを作成しています..."
cd temp_extract

# zipファイルとしてパッケージ化
zip -r flutter-l10n-helper.vsix *

# 親ディレクトリに移動してzipファイルを移動
mv flutter-l10n-helper.vsix ../
cd ..

# 一時ディレクトリを削除
echo "一時ファイルを削除しています..."
rm -rf temp_extract

echo "ビルド完了！ flutter-l10n-helper.vsix が作成されました。"
