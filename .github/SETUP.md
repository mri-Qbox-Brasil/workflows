# Configuração — Workflows e Pacote MRI

Este guia descreve o que precisa ser feito em cada repositório de script FiveM da MRI para usar os workflows reutilizáveis e o pacote `@mri-qbox-brasil/fivem-scripts`.

---

## 1. Pré-requisitos (uma vez por organização)

### 1.1 Publicar o pacote npm

O pacote `@mri-qbox-brasil/fivem-scripts` é publicado automaticamente no GitHub Packages a cada release do `template-fivem`. Nenhuma ação manual é necessária após o primeiro release.

### 1.2 Criar o PAT `GH_TOKEN`

Os workflows precisam de um **Personal Access Token** com permissões além do `GITHUB_TOKEN` padrão (leitura de packages, criação de PRs entre repos).

1. Acesse **Settings → Developer settings → Personal access tokens → Fine-grained tokens**
2. Crie um token com escopo na organização `mri-Qbox-Brasil`
3. Permissões mínimas necessárias:
   - **Contents**: Read & Write
   - **Pull requests**: Read & Write
   - **Packages**: Read
   - **Actions**: Read & Write (para `workflow_dispatch`)
4. Salve o token como um **secret de organização** chamado `GH_TOKEN` em **Settings → Secrets and variables → Actions**, disponível para todos os repositórios

---

## 2. Configuração por repositório

### 2.1 Arquivo `.npmrc`

Adicione este arquivo na raiz do repositório para que o `npm install` saiba onde buscar o pacote `@mri-qbox-brasil/*`:

```
@mri-qbox-brasil:registry=https://npm.pkg.github.com
```

> Sem este arquivo, a instalação do `fivem-scripts` vai falhar nos workflows.

### 2.2 Secrets e variáveis

Acesse **Settings → Secrets and variables → Actions** no repositório e configure:

| Nome | Tipo | Obrigatório para | Descrição |
|---|---|---|---|
| `GH_TOKEN` | Secret | Todos | PAT da organização (ver 1.2) |
| `AI_API_KEY` | Secret | `generate-docs` | Chave da API de IA (OpenAI ou compatível) |
| `AI_BASE_URL` | Variable | `generate-docs` | URL base da API (deixe vazio para OpenAI padrão) |
| `AI_MODEL` | Variable | `generate-docs` | Modelo a usar (ex: `gpt-4o-mini`). Padrão: `gpt-4o-mini` |
| `PR_TEAM` | Variable | `update-actions` | Nome do time do GitHub para atribuir PRs (ex: `merge`). Opcional. |

> `GH_TOKEN` herdado da organização já basta — não é preciso recriá-lo no repositório.

### 2.3 `fxmanifest.lua`

O workflow de release injeta a versão gerada pelo semantic-release no manifest. Certifique-se de que o arquivo contém o placeholder:

```lua
version '__VERSION__'
```

O release substitui `__VERSION__` pela versão real (ex: `1.3.0`) antes de empacotar o zip.

### 2.4 Convenção de commits

O semantic-release determina a versão com base nas mensagens de commit. Siga o padrão [Conventional Commits](https://www.conventionalcommits.org):

| Prefixo | Versão gerada | Exemplo |
|---|---|---|
| `fix:` | Patch (1.0.**1**) | `fix: corrige crash ao abrir inventário` |
| `feat:` | Minor (1.**1**.0) | `feat: adiciona sistema de crafting` |
| `feat!:` ou `BREAKING CHANGE` | Major (**2**.0.0) | `feat!: refatora API de eventos` |
| `chore:`, `docs:`, `refactor:` | Nenhuma release | `chore: atualiza dependências` |

> Commits sem prefixo convencional **não geram release**. Use `chore:` para mudanças que não merecem versão.

---

## 3. Workflows disponíveis

### 3.1 Release automático

**O que faz:** A cada push na `main`, analisa os commits, incrementa a versão, atualiza o `CHANGELOG.md`, gera o zip do recurso e cria uma GitHub Release com o arquivo para download.

Crie `.github/workflows/release.yml` no repositório:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    uses: mri-Qbox-Brasil/template-fivem/.github/workflows/callable-release.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
```

---

### 3.2 Geração automática de documentação

**O que faz:** Quando arquivos de código (`client/`, `server/`, `shared/`, `fxmanifest.lua`) são alterados na `main`, lê o código-fonte e usa IA para regenerar o `README.md` e o `MANUAL.md` com base nos templates em `.github/templates/`.

Crie `.github/workflows/generate-docs.yml` no repositório:

```yaml
name: Generate Docs

on:
  push:
    branches: [main]
    paths:
      - 'client/**'
      - 'server/**'
      - 'shared/**'
      - 'fxmanifest.lua'
      - '.github/templates/**'

jobs:
  docs:
    uses: mri-Qbox-Brasil/template-fivem/.github/workflows/callable-generate-docs.yml@main
    secrets:
      AI_API_KEY: ${{ secrets.AI_API_KEY }}
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      ai-base-url: ${{ vars.AI_BASE_URL }}
      ai-model: ${{ vars.AI_MODEL }}
```

> Os templates em `.github/templates/README.template.md` e `.github/templates/MANUAL.template.md` precisam existir no repositório. Copie-os do `template-fivem` e ajuste o conteúdo de exemplo.

---

### 3.3 Atualização automática de actions

**O que faz:** No primeiro dia de cada mês, verifica se há versões mais recentes das GitHub Actions usadas nos workflows e da versão LTS do Node.js. Se houver, abre um Pull Request com as atualizações.

Crie `.github/workflows/update-actions.yml` no repositório:

```yaml
name: Update Actions Versions

on:
  schedule:
    - cron: '0 0 1 * *'
  workflow_dispatch:

jobs:
  update:
    uses: mri-Qbox-Brasil/template-fivem/.github/workflows/callable-update-actions.yml@main
    secrets:
      GH_TOKEN: ${{ secrets.GH_TOKEN }}
    with:
      pr-team: ${{ vars.PR_TEAM }}
```

---

## 4. Checklist de configuração

Use esta lista ao configurar um repositório novo ou ao migrar um existente:

- [ ] `.npmrc` criado na raiz com o registry do GitHub Packages
- [ ] Secret `GH_TOKEN` disponível (herdado da org ou criado no repo)
- [ ] Secret `AI_API_KEY` configurado (para `generate-docs`)
- [ ] Variável `AI_BASE_URL` configurada (ou deixada vazia para OpenAI)
- [ ] Variável `AI_MODEL` configurada (ou deixada vazia para o padrão)
- [ ] `fxmanifest.lua` contém `version '__VERSION__'`
- [ ] Templates de doc existem em `.github/templates/`
- [ ] Commits seguem Conventional Commits
- [ ] `.github/workflows/release.yml` criado
- [ ] `.github/workflows/generate-docs.yml` criado
- [ ] `.github/workflows/update-actions.yml` criado

---

## 5. Migração de repos que usavam `.release/` local

Se o repositório tinha uma cópia local da pasta `.release/` (padrão anterior ao pacote npm):

1. Delete a pasta `.release/` do repositório
2. Delete `node_modules/` se houver um `package.json` na raiz do repo
3. Remova qualquer `package.json` na raiz que existia apenas para o semantic-release
4. Substitua os workflows existentes pelos snippets da seção 3 acima
5. Adicione o `.npmrc` (seção 2.1)
6. Verifique se `fxmanifest.lua` tem o placeholder `__VERSION__` (seção 2.3)
