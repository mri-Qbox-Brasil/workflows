#!/bin/bash
set -euo pipefail

# Garante delete_branch_on_merge=true em todo repo nao arquivado da org.
#
# O GitHub nao tem default de org para "Automatically delete head branches":
# repo novo nasce com false. Esta varredura liga o flag onde estiver false,
# sem tocar em nenhuma outra configuracao (o PATCH manda so esse campo).
#
# Uso:
#   ./.release/enforce-delete-branch.sh [--dry-run] [--org NOME]
#
# Env:
#   GH_TOKEN ou GITHUB_TOKEN ... auth da API (o gh usa sozinho).
#   ORG ........................ org alvo (default: mri-Qbox-Brasil).
#   DRY_RUN .................... "true" = so leitura, nenhum PATCH.
#
# Permissao necessaria no token: administration (repo settings) write —
# fine-grained "Administration: Read and write" na org; sem ela o GET
# funciona mas o PATCH responde 403. O dry-run precisa so de leitura.
#
# Saida: resumo no $GITHUB_STEP_SUMMARY (quando definido) + stdout.
# Exit 1 se algum GET/PATCH falhar — mas tenta todos antes de sair.

ORG="${ORG:-mri-Qbox-Brasil}"
DRY_RUN="${DRY_RUN:-false}"

while [ $# -gt 0 ]; do
    case "$1" in
        --dry-run) DRY_RUN="true" ;;
        --org=*) ORG="${1#--org=}" ;;
        --org)
            ORG="${2:?--org precisa de um valor}"
            shift
            ;;
        -h|--help)
            echo "Uso: $0 [--dry-run] [--org NOME]"
            exit 0
            ;;
        *)
            echo "❌ Argumento desconhecido: $1 (use --help)" >&2
            exit 2
            ;;
    esac
    shift
done

if [ -z "${GH_TOKEN:-}" ] && [ -z "${GITHUB_TOKEN:-}" ]; then
    echo "❌ Nenhum token: defina GH_TOKEN ou GITHUB_TOKEN." >&2
    exit 2
fi

if [ "$DRY_RUN" = "true" ]; then
    echo "🔍 Modo dry-run: so leitura, nenhum PATCH sera feito."
else
    echo "🔧 Modo escrita: repos com o flag false serao ligados."
fi

echo "📋 Listando repos nao arquivados de $ORG..."

# Paginacao: --paginate concatena as paginas; o -q filtra cada uma.
# O endpoint de lista nao devolve delete_branch_on_merge (vem null),
# entao aqui coletamos so os nomes e o flag e lido repo a repo abaixo.
mapfile -t REPOS < <(gh api --paginate "orgs/$ORG/repos?type=all&per_page=100" \
    -q '.[] | select(.archived == false) | .full_name')

TOTAL=${#REPOS[@]}
echo "📦 $TOTAL repos nao arquivados."

OK=0
LIGADOS=0
PENDENTES=0
FALHAS=0
FALHADOS=()

for REPO in "${REPOS[@]}"; do
    [ -z "$REPO" ] && continue

    # Leitura repo a repo: o unico jeito confiavel de ler o flag.
    VALOR="$(gh api "repos/$REPO" -q '.delete_branch_on_merge' 2>/dev/null)" || VALOR="__ERRO__"

    if [ "$VALOR" = "__ERRO__" ]; then
        echo "⚠️ $REPO: falha ao ler (GET). Registrado e seguindo."
        FALHAS=$((FALHAS + 1))
        FALHADOS+=("$REPO (leitura)")
        continue
    fi

    if [ "$VALOR" = "true" ]; then
        OK=$((OK + 1))
        continue
    fi

    if [ "$DRY_RUN" = "true" ]; then
        echo "🔧 $REPO: ligaria (atual: $VALOR)."
        PENDENTES=$((PENDENTES + 1))
        continue
    fi

    # Escrita minima: so este campo, nunca outra configuracao.
    NOVO="$(gh api --method PATCH "repos/$REPO" \
        -f delete_branch_on_merge=true \
        -q '.delete_branch_on_merge' 2>/dev/null)" || NOVO="__ERRO__"

    if [ "$NOVO" = "true" ]; then
        echo "✅ $REPO: ligado."
        LIGADOS=$((LIGADOS + 1))
    else
        echo "⚠️ $REPO: falha ao ligar (PATCH). Registrado e seguindo."
        FALHAS=$((FALHAS + 1))
        FALHADOS+=("$REPO (escrita)")
    fi
done

if [ "$DRY_RUN" = "true" ]; then
    RESUMO="total=$TOTAL, ja ok=$OK, a ligar=$PENDENTES, falhas=$FALHAS"
else
    RESUMO="total=$TOTAL, ja ok=$OK, ligados=$LIGADOS, falhas=$FALHAS"
fi

echo "---"
echo "📊 $RESUMO"
if [ ${#FALHADOS[@]} -gt 0 ]; then
    echo "❌ Com falha:"
    for F in "${FALHADOS[@]}"; do
        echo "   - $F"
    done
fi

# Resumo visivel na pagina do run (quando em Actions).
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
    {
        echo "## Delete branch on merge — varredura $ORG"
        echo ""
        echo "- Total (nao arquivados): **$TOTAL**"
        echo "- Ja ok: **$OK**"
        if [ "$DRY_RUN" = "true" ]; then
            echo "- A ligar (dry-run, sem PATCH): **$PENDENTES**"
        else
            echo "- Ligados neste run: **$LIGADOS**"
        fi
        echo "- Falhas: **$FALHAS**"
        if [ ${#FALHADOS[@]} -gt 0 ]; then
            echo ""
            echo "Repos com falha:"
            for F in "${FALHADOS[@]}"; do
                echo "- \`$F\`"
            done
        fi
    } >> "$GITHUB_STEP_SUMMARY"
fi

if [ "$FALHAS" -gt 0 ]; then
    echo "❌ $FALHAS repo(s) com falha — job marcado como falho." >&2
    exit 1
fi

echo "🎉 Varredura concluida sem falhas."
