# workflows — Workflow Library

Repositório central de workflows reutilizáveis (callables) para os scripts FiveM da MRI Qbox Brasil.

Também publica o pacote npm `@mri-qbox-brasil/workflows`, que contém os scripts de build e release usados pelos callables.

---

## Workflows disponíveis

| Workflow | O que faz |
|---|---|
| `callable-release.yml` | Build do recurso + semantic release automatizado (repo único que se auto-libera) |
| `callable-mirror-release.yml` | Release no modelo fonte privada → espelho público built-only (build no source, sync do resource buildado e release no repo público) |
| `callable-recipe-release.yml` | Release de repos de receita txAdmin (empacota e sobe para S3/R2) |
| `callable-release-notify.yml` | Embed de release no Discord, com resumo por IA. Chamado pelo wrapper injetado no espelho público |
| `callable-lint.yml` | ESLint (web) e/ou luacheck (Lua) |
| `callable-test.yml` | Vitest (web) e/ou testes de Lua sob o harness wasmoon |
| `callable-update-actions.yml` | Atualização de versões das GitHub Actions |
| `callable-repo-dispatch.yml` | Notificação ao repo de documentação |
| `callable-template-sync.yml` | Sincronização com o `script-template` |
| `callable-port-pr.yml` | Porta PRs da comunidade (repo público) para a fonte privada preservando o autor |

## Como usar

Nos repositórios de script, delegue para os callables:

```yaml
jobs:
  release:
    uses: mri-Qbox-Brasil/workflows/.github/workflows/callable-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

Consulte `.github/SETUP.md` para a lista completa de inputs, secrets e checklist de configuração.

## Chaves liga-desliga

Cada job e cada passo opcional dos callables tem uma **chave** própria, controlada
por *variables* do repositório que chama o workflow (Settings → Secrets and
variables → **Actions** → aba **Variables**).

- **Ativo por design**: chave ausente ou vazia = ligado. Não é preciso configurar
  nada para o comportamento atual continuar igual.
- **Para desligar**, defina a variável com `false` (também aceita `0`, `off`, `no`;
  maiúsculas/minúsculas não importam). Qualquer outro valor mantém ligado.
- São **variables, não secrets**: o GitHub não expõe o contexto `secrets` em
  condições `if:` (nem de job, nem de passo), então um secret não consegue ligar
  ou desligar um passo. E um liga-desliga não é informação sigilosa.
- Definidas na **organização**, valem para todos os repos; definidas no repo,
  vencem a da org. Como o `vars` dentro de um callable resolve as variáveis do
  repositório **chamador**, cada resource controla os próprios passos sem editar
  o wrapper — que é sobrescrito pelo `template-sync`.
- Nos callables com chaves de passo, o primeiro passo do job (`Chaves (vars) deste
  repositório`) imprime o valor visto para cada chave. Se um passo apareceu como
  *skipped*, o motivo está ali. Chaves de job dispensam isso: o job some da
  execução. Em `lint` e `test` só existem chaves de job.

> **Ao mexer numa dessas expressões, mantenha o `format('{0}', vars.X)`.**
> Sem ele a chave se inverte: var inexistente vale `null`, e comparando tipos
> diferentes o GitHub converte os dois lados para número — `null` e `"0"` viram
> ambos `0`, então o `contains` dá `true` justamente quando a var está vazia, e o
> passo é pulado em todo repo que não definiu nada. O `format` força string dos
> dois lados. Foi o que deixou a frota inteira sem release entre 23/07 e 30/07 de
> 2026, escondido atrás de um `startup_failure` que mascarava o sintoma.

| Chave | Desliga | Callable |
|---|---|---|
| `CI_RELEASE` | o job de release inteiro | `release`, `mirror-release`, `recipe-release` |
| `CI_SECRETS_INFISICAL` | a busca de secrets no Infisical (cai nos secrets nativos do repo/org) | todos os que usam OIDC |
| `CI_RELEASE_NOTIFY_DISCORD` | a notificação de release no Discord | `release`, `mirror-release` |
| `CI_MIRROR_README` | copiar o README do source para o espelho público | `mirror-release` |
| `CI_MIRROR_NOTIFY_WORKFLOW` | injetar o `release-notify.yml` no espelho público | `mirror-release` |
| `CI_MIRROR_PUBLIC_RELEASE` | criar a release (e o zip) no repo público — o sync do código e da tag continua | `mirror-release` |
| `CI_RECIPE_UPLOAD` | todos os envios para o S3/R2 | `recipe-release` |
| `CI_RECIPE_SYNC` | só o sync da pasta de recipes | `recipe-release` |
| `CI_RECIPE_MANIFEST` | só o envio do `recipes.json` | `recipe-release` |
| `CI_LINT_WEB` / `CI_LINT_LUA` | o job de lint correspondente | `lint` |
| `CI_TEST_WEB` / `CI_TEST_LUA` | o job de teste correspondente | `test` |
| `CI_PORT_PR` | o porte de PRs da comunidade | `port-pr` |
| `CI_PORT_PR_CLOSE_PUBLIC` | fechar/comentar o PR público após portar (o porte continua) | `port-pr` |
| `CI_TEMPLATE_SYNC` | o sync com o `script-template` | `template-sync` |
| `CI_UPDATE_ACTIONS` | a atualização automática das versões das actions | `update-actions` |
| `CI_DOCS_NOTIFY` | o aviso ao repo de documentação | `repo-dispatch` |

As chaves **somam-se** aos inputs existentes (`web-lint`, `lua-tests`,
`close-public-pr`, …): o input é o padrão que vem do template, a chave é o
override por repositório. Basta um dos dois estar desligado para o passo não rodar.

As quatro chaves de `lint` e `test` (`CI_LINT_WEB`, `CI_LINT_LUA`,
`CI_TEST_WEB`, `CI_TEST_LUA`) vão além disso: são **tri-state**, e também
*ligam*.

| Valor | Efeito |
|---|---|
| vazia | decide o input do wrapper (o default que veio do template) |
| `true` | liga, mesmo com o input `false` |
| `false` | desliga, mesmo com o input `true` |

O `true` existe porque essas trilhas nascem desligadas no template — o
`script-template` não tem `.luacheckrc`, nem `tests/`, nem script `test` no
`web/package.json`, então ligá-las por default quebraria todo repo novo. E
editar `lua-lint: true` no wrapper do repo não resolve: o `template-sync`
sobrescreve o arquivo (`-X theirs` no pull default) e o luacheck para de rodar
em silêncio. A var mora fora do arquivo e sobrevive.

Ligar a chave só adianta se o `paths:` do wrapper também acordar o workflow para
aqueles arquivos — por isso o `lint.yml`/`test.yml` do template já listam os
caminhos de Lua mesmo com a trilha desligada. Filtro de caminho decide se o
workflow dispara; a chave decide se o job roda.

Uma única chave é **opt-in** — vazia significa desligada, e só `true` liga:

| Chave | Liga | Callable |
|---|---|---|
| `CI_MIRROR_PORT_PR_WORKFLOW` | injetar o `port-pr.yml` no espelho público (definir no **source**) | `mirror-release` |

Ela é a exceção porque portar e fechar o PR de um terceiro é visível demais para
valer em todos os espelhos por padrão. Ligado o porte, o `CI_PORT_PR` e o
`CI_PORT_PR_CLOSE_PUBLIC` (definidos no **público**, que é quem chama o
`port-pr`) seguem a regra normal de desligar.

Para desligar algo em um repo, sem sair do terminal:

```bash
gh variable set CI_LINT_LUA --body false --repo mri-Qbox-Brasil/mri_Qadmin
gh variable list --repo mri-Qbox-Brasil/mri_Qadmin      # conferir
gh variable delete CI_LINT_LUA --repo mri-Qbox-Brasil/mri_Qadmin  # religar
```

## Resumo por IA na notificação de release

O notificador do Discord reescreve o changelog técnico como um resumo curto em
PT-BR. O provedor é configurável — se a chamada falhar por qualquer motivo, o
embed sai com as notas cruas e a release **nunca** é derrubada.

| Variável | Onde | Para quê |
|---|---|---|
| `AI_PROVIDER` | Infisical ou var | `groq`, `gemini`, `github` ou `custom`. Vazio ⇒ `github` |
| `AI_MODEL` | Infisical ou var | Modelo. Vazio ⇒ o default do provedor |
| `AI_BASE_URL` | Infisical ou var | Só para `custom`: endpoint OpenAI-compatible |
| `AI_API_KEY` | Infisical ou secret | Chave do provedor |

As quatro saem do Infisical (projeto `github-releases-k1-qq`, env `prod`), que as
exporta como env; var/secret do repo é só o fallback para quando o OIDC não
responde. Por isso todo consumo é `${{ env.X || vars.X }}` — escrever só
`vars.X` sobrescreveria com string vazia o que o Infisical exportou.

- **`groq`** — grátis, sem cartão. API OpenAI-compatible. Default:
  `llama-3.3-70b-versatile`.
- **`gemini`** — grátis com limite diário. Formato próprio de request/response.
  Default: `gemini-2.5-flash`.
- **`github`** — GitHub Models. É o default histórico e o único que roda sem
  chave própria, caindo no token do Actions — mas **em org no plano free ele
  responde 403** e o resumo cai para as notas cruas. Para valer, precisa de um
  PAT com escopo `models` em `GH_MODELS_TOKEN`.
- **`custom`** — qualquer endpoint OpenAI-compatible via `AI_BASE_URL`.

Ligar o Groq na org inteira:

```bash
gh variable set AI_PROVIDER --org mri-Qbox-Brasil --body groq --visibility all
gh variable set AI_MODEL    --org mri-Qbox-Brasil --body llama-3.3-70b-versatile --visibility all
gh secret   set AI_API_KEY  --org mri-Qbox-Brasil --visibility all   # cola a chave
```

> **Trocar `AI_PROVIDER` sem trocar `AI_MODEL` não funciona.** As duas são vars
> de organização, e hoje `AI_MODEL=gemini-2.5-flash`. Apontar o provedor para o
> Groq deixando esse valor manda um modelo do Gemini para a API do Groq: 400, e
> o resumo volta para as notas cruas. Ou atualize as duas, ou apague `AI_MODEL`
> e deixe o default do provedor valer.
>
> `AI_API_KEY`, `AI_BASE_URL` e `AI_MODEL` também são lidas pelo
> `repo-bootstrap/.release/generate-docs.js` (SDK da OpenAI). Uma chave só serve
> um provedor só: se os dois consumidores voltarem a rodar ao mesmo tempo,
> separe as chaves antes.

Um provedor novo é uma entrada a mais na tabela `PROVIDERS` do
`.release/discord-release.js` (`url`, `headers`, `body`, `read`).

## Template de script

Para criar um novo script FiveM, use o repositório `mri-Qbox-Brasil/script-template`, que vem pré-configurado com todos os workflows delegando para os callables deste repo.
