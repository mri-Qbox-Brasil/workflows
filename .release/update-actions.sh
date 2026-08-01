#!/bin/bash
set -euo pipefail

# Configura git se necessário (em ambiente de CI)
if [ ! -z "${GITHUB_ACTIONS:-}" ]; then
    git config user.name "github-actions[bot]"
    git config user.email "github-actions[bot]@users.noreply.github.com"
fi

# Uma action pode publicar o major como tag flutuante (actions/checkout@v7) ou
# como branch (cycjimmy/semantic-release-action@v6). Checar so tags daria falso
# negativo na segunda forma.
ref_exists() {
    gh api "repos/$1/git/ref/tags/$2" -q .ref >/dev/null 2>&1 && return 0
    gh api "repos/$1/git/ref/heads/$2" -q .ref >/dev/null 2>&1
}

echo "🔍 Buscando actions em .github/workflows/..."

# Lista os arquivos de workflow (.yml e .yaml). `find` em vez de glob: com
# `set -u`/`nullglob` desligado um glob sem match viraria literal e o grep
# abaixo morreria em "No such file or directory".
mapfile -t WORKFLOW_FILES < <(find .github/workflows -maxdepth 1 -type f \( -name '*.yml' -o -name '*.yaml' \) 2>/dev/null | sort)

if [ ${#WORKFLOW_FILES[@]} -eq 0 ]; then
    echo "⚠️ Nenhum workflow encontrado em .github/workflows/. Nada a fazer."
    exit 0
fi

mapfile -t ACTIONS < <(grep -rhoE "uses:[[:space:]]*[^@[:space:]'\"]+@[^[:space:]'\"]+" "${WORKFLOW_FILES[@]}" | sed -E 's/uses:[[:space:]]*//' | sort -u)

UPDATED=false
BRANCH_NAME="chore/update-actions-$(date +%Y%m)"

for ACTION_FULL in "${ACTIONS[@]:-}"; do
    [ -z "$ACTION_FULL" ] && continue

    # Pula actions locais e imagens Docker
    case "$ACTION_FULL" in
        ./*|.\\*|docker://*) continue ;;
    esac

    ACTION=${ACTION_FULL%@*}
    CURRENT_VERSION=${ACTION_FULL##*@}

    # Só `owner/repo` é uma action versionável. Qualquer coisa com mais barras é
    # um reusable workflow (`owner/repo/.github/workflows/x.yml@ref`): `repos/<isso>`
    # não existe na API, e antes desse guard o 404 derrubava o script inteiro no
    # `set -e` — era isso que quebrava todo repo migrado para os callables.
    if [ "$(echo "$ACTION" | tr -cd '/' | wc -c)" -ne 1 ]; then
        echo "⏭️ Ignorando $ACTION_FULL (reusable workflow, não é uma action versionável)."
        continue
    fi

    # Só mexemos em pins de major (`v4`, `6`). SHA completo e branch (`@main`) são
    # pins deliberados — reescrever viraria downgrade ou ref inválida.
    if ! echo "$CURRENT_VERSION" | grep -qE '^v?[0-9]+$'; then
        echo "⏭️ Ignorando $ACTION_FULL (pin em SHA/branch/tag exata, não em major)."
        continue
    fi

    echo "📦 Verificando $ACTION (atual: $CURRENT_VERSION)..."

    # Busca a tag mais recente (tenta release primeiro, depois tags). Cada
    # chamada precisa do `|| VAR=""`: sob `set -e` uma substituição de comando
    # que falha aborta o script antes de qualquer `continue`.
    FULL_LATEST_TAG=$(gh api "repos/$ACTION/releases/latest" -q .tag_name 2>/dev/null) || FULL_LATEST_TAG=""
    if [ -z "$FULL_LATEST_TAG" ] || [ "$FULL_LATEST_TAG" == "null" ]; then
        FULL_LATEST_TAG=$(gh api "repos/$ACTION/tags" -q '.[0].name' 2>/dev/null) || FULL_LATEST_TAG=""
    fi

    if [ -z "$FULL_LATEST_TAG" ] || [ "$FULL_LATEST_TAG" == "null" ]; then
        echo "⚠️ Não foi possível encontrar tags para $ACTION"
        continue
    fi

    # Extrai a versão "fechada" (ex: v4 de v4.1.2 ou 6 de 6.0.1)
    LATEST_TAG=$(echo "$FULL_LATEST_TAG" | grep -oE "^v?[0-9]+") || LATEST_TAG=""

    if [ -z "$LATEST_TAG" ]; then
        echo "⚠️ Tag '$FULL_LATEST_TAG' de $ACTION não segue o padrão de major. Pulando."
        continue
    fi

    if [ "$CURRENT_VERSION" == "$LATEST_TAG" ]; then
        echo "✅ Já está na versão major mais recente ($LATEST_TAG)."
        continue
    fi

    # Nem toda action publica a ref flutuante de major — a Infisical/secrets-action,
    # por exemplo, so tem tags exatas. Apontar para uma ref inexistente quebra o
    # job em "Prepare all required actions", antes de qualquer passo rodar, e
    # `continue-on-error` nao salva: derruba TODOS os workflows do repo. Ja
    # aconteceu em producao, entao confirmamos antes de reescrever.
    if ! ref_exists "$ACTION" "$LATEST_TAG"; then
        echo "⚠️ $ACTION não publica a ref de major '$LATEST_TAG' (release: $FULL_LATEST_TAG). Mantendo $CURRENT_VERSION."
        continue
    fi

    echo "✨ Nova versão fechada encontrada: $LATEST_TAG (baseada em $FULL_LATEST_TAG)"

    # Atualiza em todos os arquivos de workflow
    FILES=$(grep -lE "uses:[[:space:]]*$ACTION@$CURRENT_VERSION" "${WORKFLOW_FILES[@]}") || FILES=""
    for FILE in $FILES; do
        sed -i -E "s|uses:([[:space:]]*)$ACTION@$CURRENT_VERSION|uses:\1$ACTION@$LATEST_TAG|g" "$FILE"
        echo "📝 Atualizado $FILE"
    done
    UPDATED=true
done

echo "📦 Buscando a última versão LTS do Node.js..."
LATEST_NODE=$(curl -sL https://nodejs.org/dist/index.json | jq -r '[.[] | select(.lts != false)] | .[0].version' | grep -oE "^v[0-9]+" | sed 's/v//') || LATEST_NODE=""

if [ ! -z "$LATEST_NODE" ] && [ "$LATEST_NODE" != "null" ]; then
    echo "✨ Última major version do Node.js encontrada: $LATEST_NODE"

    # Verifica em quais arquivos há 'node-version: XX'
    NODE_FILES=$(grep -lE "node-version:[[:space:]]*['\"]?[0-9]+['\"]?" "${WORKFLOW_FILES[@]}") || NODE_FILES=""

    for FILE in $NODE_FILES; do
        if [ ! -z "$FILE" ] && [ -f "$FILE" ]; then
            CURRENT_NODE=$(grep -oE "node-version:[[:space:]]*['\"]?[0-9]+['\"]?" "$FILE" | head -1 | grep -oE "[0-9]+") || CURRENT_NODE=""
            if [ ! -z "$CURRENT_NODE" ] && [ "$CURRENT_NODE" != "$LATEST_NODE" ]; then
                sed -i -E "s/node-version:[[:space:]]*['\"]?[0-9]+['\"]?/node-version: $LATEST_NODE/g" "$FILE"
                echo "📝 Node atualizado de $CURRENT_NODE para $LATEST_NODE em $FILE"
                UPDATED=true
            else
                echo "✅ Node já está na versão LTS mais recente ($LATEST_NODE) em $FILE"
            fi
        fi
    done
else
    echo "⚠️ Não foi possível determinar a última versão do Node.js."
fi

if [ "$UPDATED" != true ]; then
    echo "🎉 Todas as actions estão atualizadas."
    exit 0
fi

echo "🚀 Criando Pull Request..."

# Garante que a opção de excluir a branch após o merge esteja ativada no repositório
echo "⚙️ Configurando o repositório para auto-deletar a branch após o merge..."
gh repo edit --delete-branch-on-merge || echo "⚠️ Aviso: Permissão insuficiente para alterar configurações do repositório. Ative isso manualmente em Settings > Pull Requests."

REPO_FULL=$(gh repo view --json nameWithOwner -q .nameWithOwner)
ORG=${REPO_FULL%%/*}
BASE_BRANCH=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)

# `-B` em vez de `-b`: a branch é mensal e pode ter sobrado de uma execução
# anterior. Com `set -e`, um `checkout -b` em branch existente abortaria tudo.
git checkout -B "$BRANCH_NAME"
git add .github/workflows/
git commit -m "chore: update github actions versions [skip ci]"
git push origin "$BRANCH_NAME" --force

# Busca membros do time para atribuição. O `if` é essencial: com `gh api ... | paste`
# o status do pipeline é o do `paste` (sempre 0), então um 404 do time passava o
# corpo do erro em JSON adiante e o `gh pr create --assignee` morria no parse.
TEAM_NAME=${PR_TEAM:-"mergers"}
ASSIGNEES=""
echo "👥 Buscando membros do time '$TEAM_NAME' em '$ORG'..."
if MEMBERS=$(gh api "orgs/$ORG/teams/$TEAM_NAME/members" -q '.[].login' 2>/dev/null); then
    ASSIGNEES=$(printf '%s' "$MEMBERS" | paste -sd "," -)
fi

PR_ARGS=(
    --title "chore: update github actions versions [skip ci]"
    --body "Automated update of GitHub Actions versions found in .github/workflows/"
    --base "$BASE_BRANCH"
    --head "$BRANCH_NAME"
)

if [ ! -z "$ASSIGNEES" ]; then
    echo "✅ Atribuindo PR para: $ASSIGNEES"
    PR_ARGS+=(--assignee "$ASSIGNEES")
else
    echo "⚠️ Nenhum membro encontrado no time '$TEAM_NAME' ou erro na API. PR seguirá sem assignee."
fi

EXISTING_PR=$(gh pr list --head "$BRANCH_NAME" --state open --json number -q '.[0].number' 2>/dev/null) || EXISTING_PR=""
if [ ! -z "$EXISTING_PR" ]; then
    echo "ℹ️ PR #$EXISTING_PR já aberto para '$BRANCH_NAME'; o push acima já o atualizou."
else
    gh pr create "${PR_ARGS[@]}"
fi
