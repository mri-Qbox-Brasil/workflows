# Manual — workflows Workflow Library

## Visão Geral

Este repositório fornece workflows reutilizáveis (`workflow_call`) e o pacote npm `@mri-qbox-brasil/workflows` para os scripts FiveM da MRI Qbox Brasil.

## Callables disponíveis

### `callable-release.yml`
Executa build do recurso FiveM e cria release semântico no GitHub. Modelo de **repo único** que se auto-libera (fonte e artefato no mesmo repo).

**Inputs:** `node-version` (default: `20`), `web-path` (default: `web`)
**Secrets:** `GH_TOKEN` (required); `GH_MODELS_TOKEN`, `UPDATE_DISCORD_WEBHOOK`, `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`, `INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL` (opcionais)

### `callable-mirror-release.yml`
Release no modelo **fonte privada → espelho público built-only**. Roda no repo de fonte privada (`<resource>-source`): calcula a versão por commits, injeta no `fxmanifest.lua` (placeholder `__VERSION__`) via `workflows set-version`, builda o front e empacota o resource com `workflows build` (sem o fonte da UI), sincroniza o resource buildado para o repo **público** e cria a release pública com o zip. Não expõe o fonte no público. Notifica o Discord (opcional, apontando à release pública).

**Inputs:** `public-repo` (required, `owner/repo` do espelho público), `resource-name` (default: nome do `public-repo`), `web-path` (default: `web`), `public-readme` (default: `README.md`), `node-version` (default: `20`)
**Secrets:** `GH_TOKEN` (required — Contents R&W no source **e** no público, Packages Read); `GH_MODELS_TOKEN`, `UPDATE_DISCORD_WEBHOOK`, `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`, `INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL` (opcionais)

**Requisitos no repo de fonte:** `fxmanifest.lua` com `version '__VERSION__'`; front em `web-path` com script `build` (saída em `web/build` ou output separado como `html/`); commits em Conventional Commits.

### `callable-recipe-release.yml`
Release para repos de **receita** do txAdmin (ex.: `mriTxRecipe`). Sem build de resource: roda semantic-release e, quando publica versão, empacota os arquivos de `.release-files.json` num zip e sobe para o S3/R2.

**Inputs:** `node-version`, `release-files` (default: `.release-files.json`), `zip-name`, `recipes-dir`, `recipes-manifest`, `legacy-recipe`
**Secrets:** `GH_TOKEN` (required), `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` (required); `AWS_S3_ENDPOINT`, `AWS_S3_PATH` (opcionais, p/ R2)

### `callable-lint.yml`
Roda ESLint no diretório web e/ou luacheck no Lua. Cada linter é ligado por input.

**Inputs:** `node-version`, `pnpm-version`, `web-dir` (default: `web`), `web-lint` (default: `true`), `lua-lint` (default: `false`)
**Secrets:** nenhum

### `callable-update-actions.yml`
Atualiza versões das GitHub Actions e Node.js LTS nos workflows, abrindo PR com as mudanças.

**Inputs:** `node-version`, `pr-team`
**Secrets:** `GH_TOKEN` (required)

### `callable-repo-dispatch.yml`
Envia evento `update-manual` para o repo de documentação quando `MANUAL.md` é atualizado.

**Inputs:** `friendly-name` (required), `docs-repository` (default: `mri-Qbox-Brasil/docs-mriqbox`)
**Secrets:** `GH_TOKEN` (required)

### `callable-template-sync.yml`
Abre PR sincronizando o repositório com o `script-template`.

**Inputs:** `source-repo` (default: `mri-Qbox-Brasil/script-template`), `source-branch`, `destination-branch`
**Secrets:** `GH_TOKEN` (optional)

### `callable-port-pr.yml`
Porta um PR aberto no repo **público** para o repo de **fonte privada** como 1 commit squash **preservando o autor original**, abre um PR no privado e (opcional) fecha o público com um comentário informativo. Em caso de falha, comenta marcando o time da org (`pr-team`) para porte manual.

Disparado por um caller em `pull_request_target` (PR aberto) ou `workflow_dispatch` (porte manual com `pr-number`). É seguro com PRs de fork: nunca executa o código do PR, apenas aplica o diff como texto.

**Inputs:** `private-repo` (vazio ⇒ `<repo>-source`), `private-base` (default: `main`), `pr-number` (vazio no gatilho automático), `apply-exclude` (globs a ignorar no diff, ex.: `html/*`), `close-public-pr` (default: `true`), `pr-team` (slug do time marcado na falha), `messages-repo`/`messages-ref` (onde ficam os textos)
**Secrets:** `GH_TOKEN` (required) — precisa de Contents R&W + Pull requests R&W no repo público **e** no privado de destino

Os textos dos comentários ficam versionados em `.github/messages/port-pr-thanks.md` e `port-pr-fail.md` (placeholders: `{{PR_NUMBER}}`, `{{TEAM_MENTION}}`, `{{PRIVATE_PR_URL}}`). Habilite num repo com a variável `PORT_TO_SOURCE=true`. Detalhes e exemplo no `.github/SETUP.md`.

## Pacote npm

O pacote `@mri-qbox-brasil/workflows` é publicado automaticamente a cada release e expõe:

| Comando | Descrição |
|---|---|
| `workflows build <nome> [web-dir]` | Build e empacotamento do recurso em zip |
| `workflows set-version <versão> [web-dir]` | Injeta versão no `fxmanifest.lua` e sincroniza `web/package.json` |
| `workflows update-actions` | Atualiza versões de actions nos workflows |
