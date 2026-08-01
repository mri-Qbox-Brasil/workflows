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
**Chaves:** `CI_RELEASE` (job), `CI_SECRETS_INFISICAL`, `CI_MIRROR_README`, `CI_MIRROR_NOTIFY_WORKFLOW`, `CI_MIRROR_PORT_PR_WORKFLOW` (*opt-in*), `CI_MIRROR_PUBLIC_RELEASE`, `CI_RELEASE_NOTIFY_DISCORD`

**Requisitos no repo de fonte:** `fxmanifest.lua` com `version '__VERSION__'`; front em `web-path` com script `build` (saída em `web/build` ou output separado como `html/`); commits em Conventional Commits.

### `callable-recipe-release.yml`
Release para repos de **receita** do txAdmin (ex.: `mriTxRecipe`). Sem build de resource: roda semantic-release e, quando publica versão, empacota os arquivos de `.release-files.json` num zip e sobe para o S3/R2.

**Inputs:** `node-version`, `release-files` (default: `.release-files.json`), `zip-name`, `recipes-dir`, `recipes-manifest`, `legacy-recipe`
**Secrets:** `GH_TOKEN`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_S3_BUCKET` (todos com fallback do Infisical); `AWS_S3_ENDPOINT`, `AWS_S3_PATH` (opcionais, p/ R2)
**Chaves:** `CI_RELEASE` (job), `CI_SECRETS_INFISICAL`, `CI_RECIPE_UPLOAD`, `CI_RECIPE_SYNC`, `CI_RECIPE_MANIFEST`

### `callable-release-notify.yml`
Posta o embed da release no Discord, com o changelog reescrito por IA (ver "Resumo por IA" no README). É chamado por um wrapper fino que o `mirror-release` injeta no espelho público a cada release — o espelho é quem enxerga a release publicada e quem pode usar secrets de org no plano Free.

O wrapper roda **só por `workflow_dispatch`**, disparado pelo próprio `mirror-release` logo depois de criar a release. Nada de `release: published` ali: como a release é criada com um PAT — e PAT dispara evento, ao contrário do `GITHUB_TOKEN` padrão — os dois gatilhos rodavam e saíam duas mensagens por release. Para re-notificar uma versão à mão, é o mesmo `workflow_dispatch` no espelho, informando a tag.

O notificador em si (`.release/discord-release.js`) é baixado por `raw.githubusercontent` em vez de instalado via npm: o job roda no espelho, que não tem token do registry privado da org, e este repo é público. Segue `main` por padrão, então corrigir o notificador vale para todos os espelhos sem re-liberar nenhum.

**Inputs:** `version` (obrigatório), `notifier-ref` (default: `main`), config do Infisical
**Secrets:** `UPDATE_DISCORD_WEBHOOK`, `AI_API_KEY`, `GH_MODELS_TOKEN`, `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`, `INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL` — todos opcionais, todos com fallback do Infisical
**Chaves:** `CI_RELEASE_NOTIFY_DISCORD` (job), `CI_SECRETS_INFISICAL`

> A identity do Infisical precisa aceitar os **repos espelho**: o wrapper mora lá, então o `job_workflow_ref` do JWT aponta para o espelho e não para este repo. Trust condition amarrada só nos callables não cobre este caso — o OIDC falha, e o resumo cai nas notas cruas sem derrubar nada.

### `callable-lint.yml`
Roda ESLint no diretório web e/ou luacheck no Lua. Cada linter é ligado por input — ou pela chave, que aqui é *tri-state* (vazia ⇒ vale o input; `true` liga; `false` desliga).

**Inputs:** `node-version`, `pnpm-version`, `web-dir` (default: `web`), `web-lint` (default: `true`), `lua-lint` (default: `false`)
**Secrets:** nenhum
**Chaves:** `CI_LINT_WEB`, `CI_LINT_LUA` (jobs, *tri-state*)

O luacheck nasce desligado porque exige um `.luacheckrc`, que o `script-template` não traz — ligue com `CI_LINT_LUA=true` em vez de editar o wrapper, que o `template-sync` sobrescreve. O `lint.yml` do template já lista os caminhos de Lua no `paths:`, senão um PR só de `.lua` nem acordaria o workflow.

### `callable-test.yml`
Roda os testes do pacote da NUI (Vitest) e/ou os testes de Lua sob o harness
`@mriqbox/fivem-test-harness` (executa o Lua real via wasmoon, sem servidor FiveM
nem MySQL). Cada eixo é ligado por input — ou pela chave, que aqui é *tri-state*
(vazia ⇒ vale o input; `true` liga; `false` desliga); nenhum passo usa `continue-on-error`.

**Inputs:** `node-version` (default: `22`), `pnpm-version`, `web-dir` (default: `web`), `web-tests` (default: `true`), `lua-tests` (default: `false`), `lua-dir` (default: `tests/lua`), `lua-deps-dirs` (pacotes locais a instalar antes, um por linha — necessário quando o harness vem via `link:`)
**Secrets:** nenhum
**Chaves:** `CI_TEST_WEB`, `CI_TEST_LUA` (jobs, *tri-state*)

O `test.yml` do template nasce com os **dois** eixos desligados: o `script-template` não tem `tests/` nem script `test` no `web/package.json`, então ligar por default quebraria todo repo novo. Cada repo liga o que de fato tem, por var — que sobrevive ao `template-sync`.

### `callable-update-actions.yml`
Atualiza versões das GitHub Actions e Node.js LTS nos workflows, abrindo PR com as mudanças.

**Inputs:** `node-version`, `pr-team`, `script-ref` (ref usada no fallback por `raw`)
**Secrets:** `GH_TOKEN` (**obrigatório na prática**, fallback do Infisical), `PACKAGES_TOKEN` (opcional, só para consumir o pacote privado de fora da org `mri-Qbox-Brasil`)
**Chaves:** `CI_UPDATE_ACTIONS` (job), `CI_SECRETS_INFISICAL`

> Este é o único callable que **não** funciona com o `GITHUB_TOKEN` padrão. O
> push toca `.github/workflows/`, e o GitHub recusa isso vindo de um GitHub App
> (`refusing to allow a GitHub App to create or update workflow ... without
> 'workflows' permission`) — e `workflows` não existe como escopo declarável em
> `permissions:`. Só um **PAT com escopo `workflow`** resolve. Um preflight
> falha cedo, com mensagem explícita, quando nenhum token chega.

Fora da org `mri-Qbox-Brasil` o registry privado responde 401 e o OIDC do
Infisical não vale. Nesses repos: `PACKAGES_TOKEN` (ou o fallback automático por
`raw`, já que este repo é público), `GH_TOKEN` como secret da org, e
`CI_SECRETS_INFISICAL=false` para não gastar um passo com um OIDC que não pode
ser emitido.

Só mexe em pins de major (`@v4`, `@6`). Referências a *reusable workflows*
(`owner/repo/.github/workflows/x.yml@ref`), SHAs e branches ficam intocadas — e
antes de reescrever, confere que a tag flutuante de major realmente existe no
repositório da action.

### `callable-repo-dispatch.yml`
Envia evento `update-manual` para o repo de documentação quando `MANUAL.md` é atualizado.

**Inputs:** `friendly-name` (vazio ⇒ nome do repo), `publish-as` (slug de publicação; existe para os repos `-source`, cujo manual deve sair com o nome do repo público), `doc-file` (default: `MANUAL.md`), `docs-repository` (default: `mri-Qbox-Brasil/docs-mriqbox`)
**Secrets:** `GH_TOKEN` (fallback do Infisical)
**Chaves:** `CI_DOCS_NOTIFY` (job), `CI_SECRETS_INFISICAL`

### `callable-template-sync.yml`
Abre PR sincronizando o repositório com o `script-template`.

**Inputs:** `source-repo` (default: `mri-Qbox-Brasil/script-template`), `source-branch`, `destination-branch`, `force-deletion` (default: `false`)
**Secrets:** `GH_TOKEN` (opcional; precisa de escopo `workflow` para tocar em `.github/workflows/`)
**Chaves:** `CI_TEMPLATE_SYNC` (job), `CI_SECRETS_INFISICAL`

> **Remoções não propagam por padrão.** A action só adiciona e atualiza: um
> workflow apagado do `script-template` continua existindo para sempre nos repos
> que já o tinham. Ligue `force-deletion: true` para propagar também as remoções.
> O preço é uma troca de semântica do merge — os `git_remote_pull_params` mudam
> junto (a action não suporta force deletion com os padrões), e o sync deixa de
> resolver conflitos sozinho a favor do template (`-X theirs`): quando o repo
> divergiu no mesmo arquivo, o PR passa a trazer conflito de verdade. Por isso o
> default é `false` — ligue repo a repo, conferindo o primeiro PR. O
> `.templatesyncignore` continua valendo.

### `callable-port-pr.yml`
Porta um PR aberto no repo **público** para o repo de **fonte privada** como 1 commit squash **preservando o autor original**, abre um PR no privado e (opcional) fecha o público com um comentário informativo. Em caso de falha, comenta marcando o time da org (`pr-team`) para porte manual.

Disparado por um caller em `pull_request_target` (PR aberto) ou `workflow_dispatch` (porte manual com `pr-number`). É seguro com PRs de fork: nunca executa o código do PR, apenas aplica o diff como texto.

**Inputs:** `private-repo` (vazio ⇒ `<repo>-source`), `private-base` (default: `main`), `pr-number` (vazio no gatilho automático), `apply-exclude` (globs a ignorar no diff, ex.: `html/*`), `close-public-pr` (default: `true`), `pr-team` (slug do time marcado na falha), `messages-repo`/`messages-ref` (onde ficam os textos)
**Secrets:** `GH_TOKEN` (fallback do Infisical) — precisa de Contents R&W + Pull requests R&W no repo público **e** no privado de destino
**Chaves:** `CI_PORT_PR` (job), `CI_SECRETS_INFISICAL`, `CI_PORT_PR_CLOSE_PUBLIC`

Os textos dos comentários ficam versionados em `.github/messages/port-pr-thanks.md` e `port-pr-fail.md` (placeholders: `{{PR_NUMBER}}`, `{{TEAM_MENTION}}`, `{{PRIVATE_PR_URL}}`). Detalhes e exemplo no `.github/SETUP.md`.

Há **dois jeitos** de o wrapper chegar no repo público, conforme o modelo do resource:

- **Repo público versionado à mão** (wrapper vem do `script-template`, em `.github/workflows/port-pr.yml`): habilite com a variável `PORT_TO_SOURCE=true`. Ela é *opt-in* e mora no `if:` do wrapper, então o porte segue desligado mesmo com `CI_PORT_PR` ligado.
- **Espelho built-only** (`mirror-release` limpa o público inteiro a cada release, então nada versionado à mão sobrevive): o `mirror-release` injeta `.release/templates/port-pr.yml` quando o **source** tem `CI_MIRROR_PORT_PR_WORKFLOW=true`. Aqui a injeção *é* o opt-in — o wrapper injetado não checa `PORT_TO_SOURCE`.

No template do espelho, `apply-exclude` sai de `vars.CI_PORT_PR_EXCLUDE` (no repo **público**), com default `web/build/* html/*` — o output do build não existe na fonte, então um PR que o toca nunca aplicaria lá.

## Pacote npm

O pacote `@mri-qbox-brasil/workflows` é publicado automaticamente a cada release e expõe:

| Comando | Descrição |
|---|---|
| `workflows build <nome> [web-dir]` | Build e empacotamento do recurso em zip |
| `workflows set-version <versão> [web-dir]` | Injeta versão no `fxmanifest.lua` e sincroniza `web/package.json` |
| `workflows update-actions` | Atualiza versões de actions nos workflows |
| `workflows notify-discord <versão>` | Posta o embed da release no webhook do Discord |

### `workflows notify-discord`

Fonte única do notificador de release (`.release/discord-release.js`). Recebe
**apenas a versão** — as notas e a descrição vêm da API do GitHub, e o resumo em
PT-BR do GitHub Models. Nunca derruba a release: qualquer falha sai com `0`.

Nunca passe as release notes por linha de comando: elas vêm de mensagens de
commit, e um apóstrofo já quebra o shell — em repo público, quem escreve o commit
pode ser um contribuidor externo.

Usado em dois lugares, a partir do mesmo arquivo:

- `callable-release.yml` — via `npx workflows notify-discord`, no `successCmd` do
  semantic-release (dispara só quando uma versão é de fato publicada).
- `.release/templates/release-notify.yml` — o notificador injetado nos espelhos
  públicos. Lá não há `npm install` nem token do registry privado, então o
  workflow baixa o script por `raw.githubusercontent` (este repo é público).

**Env:** `DISCORD_RELEASE_WEBHOOK` (sem ela, pula), `NOTIFY_REPO` (aponta o embed
a outro repo — usado pelo espelho), `GITHUB_TOKEN`, `GH_MODELS_TOKEN`, `LLM_MODEL`,
`DISCORD_RELEASE_NOTIFY` (kill switch), `LOGO_MRIQBOX_URL`, `RESOURCE_MRIQBOX_URL`,
`INVITE_DISCORD_URL`, `DOCS_MRIQBOX_URL`.
