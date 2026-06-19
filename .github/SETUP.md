# Configuração — Callables e Pacote MRI

Este guia descreve como configurar um repositório de script FiveM para usar os workflows reutilizáveis deste repo.

---

## 1. Pré-requisitos (uma vez por organização)

### PAT `GH_TOKEN`

1. Acesse **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Crie um token com escopo na organização `mri-Qbox-Brasil`
3. Permissões mínimas: **Contents** R&W, **Pull requests** R&W, **Packages** Read, **Actions** R&W
4. Salve como secret de organização `GH_TOKEN`

---

## 2. Secrets e variáveis por repositório

| Nome | Tipo | Obrigatório para | Descrição |
|---|---|---|---|
| `GH_TOKEN` | Secret | Todos | PAT da organização |
| `PR_TEAM` | Variable | `update-actions` | Time do GitHub para atribuir PRs. Opcional. |

---

## 3. Workflows — uso nos repositórios de script

### Release

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

### Recipe Release (repos de receita txAdmin)

Para repos de **receita** (ex.: `mriTxRecipe`) — empacota por `.release-files.json`
e sobe para o S3/R2, em vez de buildar resource:

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-recipe-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
      AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
      AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
      AWS_REGION: ${{ secrets.AWS_REGION }}
      AWS_S3_BUCKET: ${{ secrets.AWS_S3_BUCKET }}
      AWS_S3_ENDPOINT: ${{ secrets.AWS_S3_ENDPOINT }} # opcional (R2)
      AWS_S3_PATH: ${{ secrets.AWS_S3_PATH }}          # opcional
```

### Update Actions

```yaml
jobs:
  update:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-update-actions.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      pr-team: ${{ vars.PR_TEAM }}
```

### Repo Dispatch

```yaml
jobs:
  notify-docs:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-repo-dispatch.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      friendly-name: "Nome do Seu Script"
```

### Template Sync

```yaml
jobs:
  sync:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-template-sync.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 4. Checklist

- [ ] Secret `GH_TOKEN` disponível (herdado da org ou criado no repo)
- [ ] `fxmanifest.lua` contém `version '__VERSION__'`
- [ ] `friendly-name` atualizado em `repo-dispatch.yml`
- [ ] Commits seguem Conventional Commits
