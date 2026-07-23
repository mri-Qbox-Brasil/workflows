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
| `callable-lint.yml` | ESLint (web) e/ou luacheck (Lua) |
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

Para desligar algo em um repo, sem sair do terminal:

```bash
gh variable set CI_LINT_LUA --body false --repo mri-Qbox-Brasil/mri_Qadmin
gh variable list --repo mri-Qbox-Brasil/mri_Qadmin      # conferir
gh variable delete CI_LINT_LUA --repo mri-Qbox-Brasil/mri_Qadmin  # religar
```

## Template de script

Para criar um novo script FiveM, use o repositório `mri-Qbox-Brasil/script-template`, que vem pré-configurado com todos os workflows delegando para os callables deste repo.
