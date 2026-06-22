# Manual — template-fivem Workflow Library

## Visão Geral

Este repositório fornece workflows reutilizáveis (`workflow_call`) e o pacote npm `@mri-qbox-brasil/workflows` para os scripts FiveM da MRI Qbox Brasil.

## Callables disponíveis

### `callable-release.yml`
Executa build do recurso FiveM e cria release semântico no GitHub.

**Inputs:** `node-version` (default: `20`)
**Secrets:** `GH_TOKEN` (required)

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

## Pacote npm

O pacote `@mri-qbox-brasil/workflows` é publicado automaticamente a cada release e expõe:

| Comando | Descrição |
|---|---|
| `workflows build <nome> [web-dir]` | Build e empacotamento do recurso em zip |
| `workflows set-version <versão> [web-dir]` | Injeta versão no `fxmanifest.lua` e sincroniza `web/package.json` |
| `workflows update-actions` | Atualiza versões de actions nos workflows |
