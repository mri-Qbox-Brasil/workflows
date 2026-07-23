# Manual — workflows Workflow Library

## Visão Geral

Este repositório fornece workflows reutilizáveis (`workflow_call`) e o pacote npm `@mri-qbox-brasil/workflows` para os scripts FiveM da MRI Qbox Brasil.

## Secrets — Infisical via OIDC

Os secrets vêm de um Infisical self-hosted, buscados por **OIDC**: o runner prova
a identidade com o JWT do próprio GitHub Actions, sem token de longa duração
guardado nos repos. Por isso o `GH_TOKEN` listado em cada callable é **opcional**:
é o *fallback* usado quando o Infisical está fora do ar (o padrão
`env.X || secrets.X` em todo consumidor).

Duas consequências práticas:

- O **job chamador** (o wrapper no repo do resource) precisa declarar
  `id-token: write` nas suas `permissions` — permissões de um reusable workflow
  não podem ser maiores que as do chamador, então sem isso o JWT não é emitido e
  tudo cai silenciosamente no fallback. Veja os exemplos no `.github/SETUP.md`.
- O passo do Infisical é `continue-on-error: true`: instabilidade lá não derruba
  release nenhuma.

## Chaves liga-desliga

Todo job e todo passo opcional tem uma **chave** por repositório, via *variables*
do repo chamador. **Ativo por design**: chave ausente ou vazia = ligado; desliga
com `false` (também `0`, `off`, `no`). Cada callable lista as suas abaixo, e a
tabela completa está no `README.md`.

## Callables disponíveis

### `callable-release.yml`
Executa build do recurso FiveM e cria release semântico no GitHub. Modelo de **repo único** que se auto-libera (fonte e artefato no mesmo repo).

**Inputs:** `node-version` (default: `20`), `web-path` (default: `web`), `infisical-*` (domínio/identity/projeto/env/audience — raramente mudam)
**Secrets:** `GH_TOKEN` (fallback do Infisical); `GH_MODELS_TOKEN`, `UPDATE_DISCORD_WEBHOOK`, `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`, `INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL` (opcionais)
**Chaves:** `CI_RELEASE` (job), `CI_SECRETS_INFISICAL`, `CI_RELEASE_NOTIFY_DISCORD`

### `callable-mirror-release.yml`
Release no modelo **fonte privada → espelho público built-only**. Roda no repo de fonte privada (`<resource>-source`): calcula a versão por commits, injeta no `fxmanifest.lua` (placeholder `__VERSION__`) via `workflows set-version`, builda o front e empacota o resource com `workflows build` (sem o fonte da UI), sincroniza o resource buildado para o repo **público** e cria a release pública com o zip. Não expõe o fonte no público. Notifica o Discord (opcional, apontando à release pública).

**Inputs:** `public-repo` (required, `owner/repo` do espelho público), `resource-name` (default: nome do `public-repo`), `web-path` (default: `web`), `public-readme` (default: `README.md`), `node-version` (default: `20`)
**Secrets:** `GH_TOKEN` (fallback do Infisical — Contents R&W no source **e** no público, Packages Read); `GH_MODELS_TOKEN`, `UPDATE_DISCORD_WEBHOOK`, `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`, `INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL` (opcionais)
**Chaves:** `CI_RELEASE` (job), `CI_SECRETS_INFISICAL`, `CI_MIRROR_README`, `CI_MIRROR_NOTIFY_WORKFLOW`, `CI_MIRROR_PUBLIC_RELEASE`, `CI_RELEASE_NOTIFY_DISCORD`

**Requisitos no repo de fonte:** `fxmanifest.lua` com `version '__VERSION__'`; front em `web-path` com script `build` (saída em `web/build` ou output separado como `html/`); commits em Conventional Commits.

### `callable-recipe-release.yml`
Release para repos de **receita** do txAdmin (ex.: `mriTxRecipe`). Sem build de resource: roda semantic-release e, quando publica versão, empacota os arquivos de `.release-files.json` num zip e sobe para o S3/R2.

**Inputs:** `node-version`, `release-files` (default: `.release-files.json`), `zip-name`, `recipes-dir`, `recipes-manifest`, `legacy-recipe`
**Secrets:** `GH_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` (todos com fallback do Infisical); `AWS_S3_ENDPOINT`, `AWS_S3_PATH` (opcionais, p/ R2)
**Chaves:** `CI_RELEASE` (job), `CI_SECRETS_INFISICAL`, `CI_RECIPE_UPLOAD`, `CI_RECIPE_SYNC`, `CI_RECIPE_MANIFEST`

### `callable-lint.yml`
Roda ESLint no diretório web e/ou luacheck no Lua. Cada linter é ligado por input.

**Inputs:** `node-version`, `pnpm-version`, `web-dir` (default: `web`), `web-lint` (default: `true`), `lua-lint` (default: `false`)
**Secrets:** nenhum
**Chaves:** `CI_LINT_WEB`, `CI_LINT_LUA` (jobs)

### `callable-test.yml`
Roda os testes do pacote da NUI (Vitest) e/ou os testes de Lua sob o harness
`@mriqbox/fivem-test-harness` (executa o Lua real via wasmoon, sem servidor FiveM
nem MySQL). Cada eixo é ligado por input; nenhum passo usa `continue-on-error`.

**Inputs:** `node-version` (default: `22`), `pnpm-version`, `web-dir` (default: `web`), `web-tests` (default: `true`), `lua-tests` (default: `false`), `lua-dir` (default: `tests/lua`), `lua-deps-dirs` (pacotes locais a instalar antes, um por linha — necessário quando o harness vem via `link:`)
**Secrets:** nenhum
**Chaves:** `CI_TEST_WEB`, `CI_TEST_LUA` (jobs)

### `callable-update-actions.yml`
Atualiza versões das GitHub Actions e Node.js LTS nos workflows, abrindo PR com as mudanças.

**Inputs:** `node-version`, `pr-team`
**Secrets:** `GH_TOKEN` (fallback do Infisical)
**Chaves:** `CI_UPDATE_ACTIONS` (job), `CI_SECRETS_INFISICAL`

### `callable-repo-dispatch.yml`
Envia evento `update-manual` para o repo de documentação quando `MANUAL.md` é atualizado.

**Inputs:** `friendly-name` (vazio ⇒ nome do repo), `publish-as` (slug de publicação; existe para os repos `-source`, cujo manual deve sair com o nome do repo público), `doc-file` (default: `MANUAL.md`), `docs-repository` (default: `mri-Qbox-Brasil/docs-mriqbox`)
**Secrets:** `GH_TOKEN` (fallback do Infisical)
**Chaves:** `CI_DOCS_NOTIFY` (job), `CI_SECRETS_INFISICAL`

### `callable-template-sync.yml`
Abre PR sincronizando o repositório com o `script-template`.

**Inputs:** `source-repo` (default: `mri-Qbox-Brasil/script-template`), `source-branch`, `destination-branch`
**Secrets:** `GH_TOKEN` (opcional; precisa de escopo `workflow` para tocar em `.github/workflows/`)
**Chaves:** `CI_TEMPLATE_SYNC` (job), `CI_SECRETS_INFISICAL`

### `callable-port-pr.yml`
Porta um PR aberto no repo **público** para o repo de **fonte privada** como 1 commit squash **preservando o autor original**, abre um PR no privado e (opcional) fecha o público com um comentário informativo. Em caso de falha, comenta marcando o time da org (`pr-team`) para porte manual.

Disparado por um caller em `pull_request_target` (PR aberto) ou `workflow_dispatch` (porte manual com `pr-number`). É seguro com PRs de fork: nunca executa o código do PR, apenas aplica o diff como texto.

**Inputs:** `private-repo` (vazio ⇒ `<repo>-source`), `private-base` (default: `main`), `pr-number` (vazio no gatilho automático), `apply-exclude` (globs a ignorar no diff, ex.: `html/*`), `close-public-pr` (default: `true`), `pr-team` (slug do time marcado na falha), `messages-repo`/`messages-ref` (onde ficam os textos)
**Secrets:** `GH_TOKEN` (fallback do Infisical) — precisa de Contents R&W + Pull requests R&W no repo público **e** no privado de destino
**Chaves:** `CI_PORT_PR` (job), `CI_SECRETS_INFISICAL`, `CI_PORT_PR_CLOSE_PUBLIC`

Os textos dos comentários ficam versionados em `.github/messages/port-pr-thanks.md` e `port-pr-fail.md` (placeholders: `{{PR_NUMBER}}`, `{{TEAM_MENTION}}`, `{{PRIVATE_PR_URL}}`). Habilite num repo com a variável `PORT_TO_SOURCE=true` — ela é *opt-in* e mora no wrapper, então o porte segue desligado por padrão mesmo com `CI_PORT_PR` ligado. Detalhes e exemplo no `.github/SETUP.md`.

## Pacote npm

O pacote `@mri-qbox-brasil/workflows` é publicado automaticamente a cada release e expõe:

| Comando | Descrição |
|---|---|
| `workflows build <nome> [web-dir]` | Build e empacotamento do recurso em zip |
| `workflows set-version <versão> [web-dir]` | Injeta versão no `fxmanifest.lua` e sincroniza `web/package.json` |
| `workflows update-actions` | Atualiza versões de actions nos workflows |
