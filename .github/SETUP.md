# Configuração — Callables e Pacote MRI

Este guia descreve como configurar um repositório de script FiveM para usar os workflows reutilizáveis deste repo.

---

## 1. Pré-requisitos (uma vez por organização)

### Secrets via Infisical (OIDC) — como funciona hoje

Os secrets vêm de um Infisical self-hosted, buscados por **OIDC**: o runner prova
quem é com o JWT do próprio GitHub Actions e recebe os secrets do projeto. Não há
token de longa duração guardado nos repos.

O `GH_TOKEN` abaixo continua valendo como **fallback** (padrão `env.X || secrets.X`
em todo consumidor): se o Infisical estiver fora, o workflow segue com o secret
nativo do repo/org.

> **Obrigatório no wrapper:** o job que chama o callable precisa declarar
> `id-token: write` nas suas `permissions`. Um reusable workflow não pode ter mais
> permissões que o job chamador — sem isso o JWT não é emitido, o passo do
> Infisical falha (é `continue-on-error`) e tudo cai no fallback **em silêncio**.
> Os exemplos da seção 3 já trazem o bloco correto para cada callable.

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
| `LLM_MODEL` | Variable | notificação de release | Modelo do GitHub Models. Default: `openai/gpt-4o-mini`. Opcional. |
| `CI_*` | Variable | qualquer callable | Chaves liga-desliga por repositório. Ver abaixo. |

### Chaves liga-desliga (`CI_*`)

Cada job e cada passo opcional dos callables tem uma chave própria, definida como
*variable* do repositório (Settings → Secrets and variables → **Actions** → aba
**Variables**).

- **Ativo por design**: chave ausente ou vazia = ligado. Um repo novo não precisa
  configurar nada.
- **Para desligar**, defina com `false` (também aceita `0`, `off`, `no`).
- São *variables*, não secrets: o GitHub não expõe o contexto `secrets` em
  condições `if:`, então um secret não consegue ligar/desligar um passo.
- Definida na **org** vale para todos os repos; definida no **repo**, vence a da org.

| Chave | Desliga |
|---|---|
| `CI_RELEASE` | o job de release inteiro (`release`, `mirror-release`, `recipe-release`) |
| `CI_SECRETS_INFISICAL` | a busca no Infisical — usa só os secrets nativos do repo/org |
| `CI_RELEASE_NOTIFY_DISCORD` | a notificação de release no Discord |
| `CI_MIRROR_README` | copiar o README do source para o espelho público |
| `CI_MIRROR_NOTIFY_WORKFLOW` | injetar o `release-notify.yml` no espelho público |
| `CI_MIRROR_PUBLIC_RELEASE` | criar a release/zip no público (o sync de código e tag continua) |
| `CI_RECIPE_UPLOAD` | todos os envios para o S3/R2 |
| `CI_RECIPE_SYNC` / `CI_RECIPE_MANIFEST` | só o sync das recipes / só o `recipes.json` |
| `CI_LINT_WEB` / `CI_LINT_LUA` | o job de lint correspondente |
| `CI_TEST_WEB` / `CI_TEST_LUA` | o job de teste correspondente |
| `CI_PORT_PR` | o porte de PRs da comunidade |
| `CI_PORT_PR_CLOSE_PUBLIC` | fechar/comentar o PR público (o porte continua) |
| `CI_TEMPLATE_SYNC` | o sync com o `script-template` |
| `CI_UPDATE_ACTIONS` | a atualização das versões das actions |
| `CI_DOCS_NOTIFY` | o aviso ao repo de documentação |

As chaves **somam-se** aos inputs do wrapper (`web-lint`, `lua-tests`,
`close-public-pr`, …) e às variáveis *opt-in* já existentes (`PORT_TO_SOURCE`):
basta uma das travas estar desligada para o passo não rodar. O input é o padrão
que vem do template; a chave é o override por repositório — e sobrevive ao
`template-sync`, que sobrescreve o wrapper.

```bash
gh variable set CI_LINT_LUA --body false --repo mri-Qbox-Brasil/mri_Qadmin
gh variable list --repo mri-Qbox-Brasil/mri_Qadmin
gh variable delete CI_LINT_LUA --repo mri-Qbox-Brasil/mri_Qadmin   # religa
```

Nos callables com chaves de passo, o **primeiro passo do job** imprime o valor
visto para cada chave — é lá que se descobre por que um passo apareceu como
*skipped*.

---

## 3. Workflows — uso nos repositórios de script

### Release (repo único, auto-liberado)

```yaml
jobs:
  release:
    permissions:            # espelha as permissões do callable; `id-token` é o do Infisical
      contents: write
      issues: write
      pull-requests: write
      packages: write
      models: read
      id-token: write
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
    permissions:
      contents: write
      issues: write
      pull-requests: write
      packages: read
      id-token: write       # OIDC do Infisical
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
    permissions:
      contents: write
      issues: write
      pull-requests: write
      id-token: write       # OIDC do Infisical
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

### Lint e Test

Não usam secrets nem OIDC — dispensam `permissions`. Cada eixo é ligado por input
(e pode ser desligado por repo com `CI_LINT_*` / `CI_TEST_*`):

```yaml
jobs:
  lint:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-lint.yml@main
    with:
      lua-lint: true          # exige .luacheckrc no repo
  test:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-test.yml@main
    with:
      lua-tests: true         # testes de Lua sob o harness wasmoon
      # lua-dir: tests/lua
      # lua-deps-dirs: |      # pacotes locais a instalar antes (harness via link:)
      #   packages/fivem-test-harness
```

### Update Actions

```yaml
jobs:
  update:
    permissions:
      contents: write
      pull-requests: write
      id-token: write       # OIDC do Infisical
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
    permissions:
      id-token: write       # OIDC do Infisical
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-repo-dispatch.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      friendly-name: ${{ vars.DOC_NAME }}   # vazio ⇒ nome do repositório
      publish-as: ${{ vars.DOC_SLUG }}      # vazio ⇒ nome do repositório
```

O caller é **idêntico em todos os repos**: o que varia (nome exibido na sidebar,
slug de publicação) vem das variables `DOC_NAME`/`DOC_SLUG`, e não de um valor
hardcoded — que o `template-sync` sobrescreveria. O `publish-as` existe para os
repos `-source`: o `MANUAL.md` mora no privado, mas a página sai com o nome do
repo público.

### Template Sync

```yaml
jobs:
  sync:
    permissions:
      contents: write
      pull-requests: write
      id-token: write       # OIDC do Infisical
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
  id-token: write           # OIDC do Infisical

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

- [ ] Secret `GH_TOKEN` disponível (herdado da org ou criado no repo) — fallback do Infisical
- [ ] Todo job que chama um callable declara `id-token: write` nas `permissions`
- [ ] `fxmanifest.lua` contém `version '__VERSION__'`
- [ ] `DOC_NAME` / `DOC_SLUG` definidos (nome e slug na documentação)
- [ ] (Opcional) chaves `CI_*` definidas para o que este repo não deve rodar
- [ ] Commits seguem Conventional Commits
- [ ] (Se usar porte de PRs) variável `PORT_TO_SOURCE = true` definida e `GH_TOKEN` com acesso ao repo `-source`
