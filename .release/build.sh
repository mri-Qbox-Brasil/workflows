#!/bin/bash
set -e

SCRIPT_NAME=${1:-"package"}
# Diretorio do front, configuravel; default "web". Mantido em sincronia com o
# set-version (mesmo caminho do package.json bumpado). Ver issue #3.
WEB_DIR=${2:-"web"}

echo "Iniciando build para: $SCRIPT_NAME (web: $WEB_DIR)"

rm -rf dist
mkdir -p "dist/$SCRIPT_NAME"

# Build web (se existir)
if [ -d "$WEB_DIR" ]; then
  echo "Building $WEB_DIR..."
  cd "$WEB_DIR"
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

# Exclusoes extras por-resource: cada linha do .releaseignore (na raiz do
# resource) vira um --exclude do rsync. Aceita # como comentario e ignora
# linhas vazias. Backward-compatible: sem o arquivo, nada muda.
EXTRA_EXCLUDES=()
if [ -f ".releaseignore" ]; then
  echo "Aplicando exclusoes de .releaseignore..."
  while IFS= read -r raw || [ -n "$raw" ]; do
    line="$(printf '%s' "$raw" | sed 's/#.*//; s/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -z "$line" ] && continue
    EXTRA_EXCLUDES+=( --exclude="$line" )
  done < .releaseignore
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
  --exclude="$WEB_DIR" \
  "${EXTRA_EXCLUDES[@]}" \
  . "dist/$SCRIPT_NAME"

# Copia apenas o output do build web
if [ -d "$WEB_DIR/build" ]; then
  echo "Copiando $WEB_DIR/build..."
  mkdir -p "dist/$SCRIPT_NAME/$WEB_DIR"
  cp -r "$WEB_DIR/build" "dist/$SCRIPT_NAME/$WEB_DIR/build"
fi

# Compacta
echo "Compactando..."
cd dist
zip -r "$SCRIPT_NAME.zip" "$SCRIPT_NAME"

echo "Build concluido: dist/$SCRIPT_NAME.zip"
