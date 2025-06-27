#!/bin/bash
set -e

echo "🚀 Starting build process..."
echo "📋 Build ID: $BUILD_ID"
echo "📥 Downloading source from: $SOURCE_ZIP_URL"

# Download and extract source
wget -O source.zip "$SOURCE_ZIP_URL"
unzip -q source.zip -d ./source

# Navigate to source and handle nested folders
cd source
if [ $(ls | wc -l) -eq 1 ] && [ -d "$(ls)" ]; then
  mv $(ls)/* ./
  mv $(ls)/.* ./ 2>/dev/null || true
  rmdir $(ls)
fi

# Install and build
echo "📦 Installing dependencies..."
npm install

echo "🔨 Building project..."
npx vite build --base="./"

# Find build output
if [ -d "./dist" ]; then
  BUILD_DIR="./dist"
elif [ -d "./build" ]; then
  BUILD_DIR="./build"
else
  echo "❌ No build output found"
  exit 1
fi

echo "✅ Build output found in: $BUILD_DIR"

# Create ZIP
ZIP_NAME="build_${BUILD_ID}.zip"
cd "$BUILD_DIR" && zip -r "../$ZIP_NAME" . && cd ..

# Upload to Azure Blob Storage
echo "☁️ Uploading ZIP to Azure Blob Storage..."
az storage blob upload \
  --file "$ZIP_NAME" \
  --container-name "build-outputs" \
  --name "${BUILD_ID}/${ZIP_NAME}" \
  --connection-string "$STORAGE_CONNECTION_STRING" \
  --overwrite

echo "✅ Build completed and uploaded"
echo "📦 ZIP URL: https://${STORAGE_ACCOUNT_NAME}.blob.core.windows.net/build-outputs/${BUILD_ID}/${ZIP_NAME}"