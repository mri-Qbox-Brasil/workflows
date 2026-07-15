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
| `PORT_TO_SOURCE` | Variable | `port-pr` | `true` habilita o porte de PRs para a fonte privada. |
| `SOURCE_REPO` | Variable | `port-pr` | Repo de destino, se diferente de `<repo>-source`. Opcional. |

---

## 3. Workflows — uso nos repositórios de script

### Release (repo único, auto-liberado)

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

### Mirror Release (fonte privada → espelho público built-only)

Roda no repo de **fonte privada** (`<resource>-source`) e publica o resource
buildado (Lua + `web/build`, **sem** o fonte da UI) no repo **público**. Exige
`version '__VERSION__'` no `fxmanifest.lua` (a versão é injetada só no build,
nunca commitada de volta).

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-mirror-release.yml@main
    secrets: inherit
    with:
      public-repo: mri-Qbox-Brasil/mri_Qdoorlock   # espelho público
      # web-path: web                              # opcional (default: web)
      # resource-name: mri_Qdoorlock               # opcional (default: nome do public-repo)
      # public-readme: README.md                   # opcional (use MANUAL.md p/ publicar o manual)
```

O `GH_TOKEN` precisa de **Contents R&W** no source **e** no público (o
espelhamento faz `push` no público) e **Packages Read** (instala
`@mri-qbox-brasil/workflows`).

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

### Port PR (público → fonte privada)

Porta PRs da comunidade do repo público para o repo de fonte privado como **1
commit squash preservando o autor original**, abre um PR no privado e fecha o PR
público com um comentário informativo. Dispara ao abrir um PR
(`pull_request_target`) ou manualmente (`workflow_dispatch` com `pr-number`).

```yaml
on:
  pull_request_target:
    types: [opened]
  workflow_dispatch:
    inputs:
      pr-number:
        required: true

permissions:
  pull-requests: write
  contents: read

jobs:
  port:
    if: ${{ vars.PORT_TO_SOURCE == 'true' }}
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-port-pr.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      private-repo: ${{ vars.SOURCE_REPO }}   # vazio => <repo>-source
      pr-number: ${{ inputs.pr-number }}
      apply-exclude: 'html/*'
```

**Para habilitar num repo:**

1. Defina a variável de repositório **`PORT_TO_SOURCE = true`** (Settings →
   Secrets and variables → Actions → **Variables**). Sem ela, o workflow fica
   inerte — importante porque o caller é sincronizado para todos os repos via
   template, mas só os que têm fonte privada devem portar.
2. O destino padrão é **`<repo-público>-source`**. Para outro nome, defina a
   variável `SOURCE_REPO = owner/repo`.
3. O `GH_TOKEN` (PAT da org) precisa de **Contents R&W + Pull requests R&W** no
   repo público **e** no privado de destino.

**Textos dos comentários** ficam versionados neste repo em
`.github/messages/port-pr-thanks.md` (agradecimento/fechamento) e
`port-pr-fail.md` (falha). Placeholders suportados: `{{PR_NUMBER}}`,
`{{TEAM_MENTION}}` (só no de falha) e `{{PRIVATE_PR_URL}}` (só no de
agradecimento). O time marcado na falha vem da variável de org `PR_TEAM`.

---

## 4. Checklist

- [ ] Secret `GH_TOKEN` disponível (herdado da org ou criado no repo)
- [ ] `fxmanifest.lua` contém `version '__VERSION__'`
- [ ] `friendly-name` atualizado em `repo-dispatch.yml`
- [ ] Commits seguem Conventional Commits
- [ ] (Se usar porte de PRs) variável `PORT_TO_SOURCE = true` definida e `GH_TOKEN` com acesso ao repo `-source`
