#!/bin/bash
set -e

SCRIPT_NAME=${1:-"package"}

echo "Iniciando build para: $SCRIPT_NAME"

rm -rf dist
mkdir -p "dist/$SCRIPT_NAME"

# Build web (se existir)
if [ -d "web" ]; then
  echo "Building web..."
  cd web
  if [ -f "pnpm-lock.yaml" ]; then
    if ! command -v pnpm &> /dev/null; then
      npm install -g pnpm@9
    fi
    pnpm install --prefer-offline
    pnpm run build
  else
    npm install --prefer-offline --no-audit --no-fund
    npm run build
  fi
  cd ..
fi

# Copia arquivos relevantes
echo "Copiando arquivos..."
rsync -av \
  --exclude=".git" \
  --exclude=".github" \
  --exclude=".gitignore" \
  --exclude=".release" \
  --exclude="scripts" \
  --exclude="README.md" \
  --exclude="MANUAL.md" \
  --exclude="CHANGELOG.md" \
  --exclude="node_modules" \
  --exclude="dist" \
  --exclude="web" \
  . "dist/$SCRIPT_NAME"

# Copia apenas o output do build web
if [ -d "web/build" ]; then
  echo "Copiando web/build..."
  mkdir -p "dist/$SCRIPT_NAME/web"
  cp -r web/build "dist/$SCRIPT_NAME/web/build"
fi

# Compacta
echo "Compactando..."
cd dist
zip -r "$SCRIPT_NAME.zip" "$SCRIPT_NAME"

echo "Build concluido: dist/$SCRIPT_NAME.zip"
