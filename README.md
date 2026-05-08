# 🚀 FiveM Script Template — React Edition (MRI)

> **Template oficial da MRI Qbox Team** para scripts FiveM com interface NUI. Combina backend Lua com frontend React + Vite + TypeScript + Tailwind CSS, tudo integrado em um pipeline de CI/CD profissional.

![FiveM](https://img.shields.io/badge/FiveM-GTA%20V-green?style=flat-square)
![Lua](https://img.shields.io/badge/Lua-5.4-orange?style=flat-square)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38BDF8?style=flat-square)
![Semantic Release](https://img.shields.io/badge/Semantic%20Release-Automated-blueviolet?style=flat-square)
![MRI Qbox](https://img.shields.io/badge/MRI%20Qbox-Brasil-blue?style=flat-square)

---

## 📋 Table of Contents

- [Destaques](#-destaques-do-template)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Tecnologias](#-tecnologias)
- [Começando](#-começando)
- [Adicionando a um Repositório Existente](#-adicionando-a-um-repositório-existente)
- [Configuração do fxmanifest.lua](#-configuração-do-fxmanifestlua)
- [Build para Produção](#-build-para-produção)
- [Geração de Documentação](#-geração-de-documentação)
- [CI/CD e Automação](#-cicd-e-automação)
- [Convenção de Commits](#-convenção-de-commits)
- [Exemplos de Código](#-exemplos-de-código)
- [Scripts Disponíveis](#-scripts-disponíveis)
- [Links Úteis](#-links-úteis)

---

## ✨ Destaques do Template

| Feature | Descrição |
|---------|-------------|
| 🎯 **Padrões MRI** | Configuração de `lua54`, suporte a `ox_lib`, estrutura organizada |
| ⚛️ **React + NUI** | Interface NUI com React 18, TypeScript, Vite e Tailwind CSS |
| 🔗 **Comunicação NUI** | Hooks `useNuiEvent` e `fetchNui` prontos para usar |
| 🤖 **Automação Total** | Semantic Release, GitHub Actions, releases automáticas |
| 📦 **Build Otimizado** | Build do frontend integrado ao script Bash de empacotamento |
| 🏷️ **Versionamento** | Versionamento semântico automático via commits |
| 🧪 **Pronto para CI** | Lint, testes e deploy automáticos |
| 📝 **Documentação** | Geração automática de README e MANUAL via IA |

---

## 📁 Estrutura de Pastas

```
meu-script/
├── .github/
│   ├── templates/               # Templates para geração de docs via IA
│   └── workflows/               # GitHub Actions workflows
├── .release/                    # Infraestrutura de release (oculto do yarn do FiveM)
│   ├── package.json             # Dependências npm (semantic-release, openai)
│   ├── release.config.js        # Configuração do semantic-release
│   ├── set-version.js           # Injeta versão no fxmanifest.lua
│   └── generate-docs.js         # Geração de docs via IA
├── client/                      # Código fonte Lua do lado do cliente
│   └── main.lua
├── server/                      # Código fonte Lua do lado do servidor
│   └── main.lua
├── shared/                      # Código compartilhado (config, utils)
│   └── config.lua
├── web/                         # Interface NUI (React)
│   ├── src/
│   │   ├── context/
│   │   │   └── NuiContext.tsx   # Contexto e hooks de comunicação NUI
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── styles.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.cjs
│   └── package.json
├── dist/                        # Saída do build (não versionar)
│   └── meu-script.zip
├── scripts/
│   ├── build.sh                 # Script de build para produção
│   └── update-actions.sh        # Atualização automática de actions
├── fxmanifest.lua               # Manifesto do recurso FiveM
├── .gitignore
└── README.md
```

### Descrição das Pastas

| Pasta | Propósito |
|-------|-----------|
| `.release/` | Configs de release — oculto para o yarn do FiveM não processar |
| `client/` | Lógica do cliente (eventos, NUI callbacks) |
| `server/` | Lógica do servidor (API, database, events) |
| `shared/` | Código compartilhado (config, helpers) |
| `web/src/` | Código-fonte da interface React (NUI) |
| `web/build/` | Output do build do frontend (gerado automaticamente, não versionar) |
| `dist/` | Saída do build final (zip pronto para produção) |
| `scripts/` | Scripts de automação |

---

## 🛠️ Tecnologias

### FiveM/Lua

| Tecnologia | Versão | Descrição |
|------------|--------|-------------|
| **FXVersion** | `cerulean` | Versão do FiveM |
| **Lua** | `5.4` | Versão do Lua |
| **ox_lib** | Latest | Framework de UI e utilitários |

### Frontend (NUI)

| Tecnologia | Versão | Descrição |
|------------|--------|-------------|
| **React** | ^18.2 | Biblioteca de interface |
| **TypeScript** | ^5.1 | Tipagem estática |
| **Vite** | ^5.0 | Bundler e dev server |
| **Tailwind CSS** | ^3.3 | Estilização utilitária |
| **lucide-react** | Latest | Ícones |
| **clsx + tailwind-merge** | Latest | Utilitários de classes CSS |

### Node.js (Automação)

| Pacote | Versão | Propósito |
|--------|--------|-----------|
| **semantic-release** | ^23.0.0 | Versionamento automático |
| **@semantic-release/changelog** | ^6.0.0 | Geração de changelog |
| **@semantic-release/github** | ^10.0.0 | Integração GitHub |
| **@semantic-release/exec** | ^6.0.3 | Executar comandos customizados |
| **openai** | ^4.0.0 | Cliente de API para geração de docs via IA |

> Todas as dependências Node ficam em `.release/` — invisíveis para o yarn do FiveM.

---

## 🚀 Começando

### 1. Criar Repositório

Use o botão **"Use this template"** no GitHub:

1. Acesse https://github.com/mri-Qbox-Brasil/template-fivem/tree/react
2. Clique em **Use this template**
3. Crie um novo repositório (ex: `mri_Qmeuscript`)

### 2. Clone o Repositório

```bash
git clone https://github.com/mri-Qbox-Brasil/mri_Qmeuscript.git
cd mri_Qmeuscript
```

### 3. Instale as Dependências

```bash
# Ferramentas de release e automação
npm install --prefix .release

# Frontend React
cd web && npm install
```

### 4. Inicie o servidor de desenvolvimento

```bash
cd web
npm run dev
```

O Vite inicia em `http://localhost:5173`. Para testar a comunicação NUI, utilize `fetchNui` e `useNuiEvent` normalmente — fora do FiveM eles retornam dados mockados.

### 5. Configure as permissões do GitHub Actions

Acesse **Settings → Actions → General → Workflow permissions** e selecione **Read and write permissions**. Isso é necessário para o workflow de release criar tags, changelogs e releases automaticamente.

### 6. Configure o fxmanifest.lua

Edite `fxmanifest.lua`:

```lua
fx_version "cerulean"
game "gta5"

lua54 "yes"

author "MRI Qbox Team"
description "Descrição do meu script"
version "__VERSION__"  -- Será substituído automaticamente

client_scripts { "client/*.lua" }
server_scripts { "server/*.lua" }

-- NUI
ui_page "web/build/index.html"
files { "web/build/**" }
```

---

## 🔧 Adicionando a um Repositório Existente

Se preferir não usar o botão **Use this template**, é possível levar apenas as partes que interessam para um repositório já existente. Abaixo estão os arquivos necessários para cada feature.

### Release automático

Arquivos a copiar:

```
.release/package.json
.release/release.config.js
.release/set-version.js
scripts/build.sh
.github/workflows/release.yml
```

Requisitos:
- O `fxmanifest.lua` deve ter `version "__VERSION__"` — o `set-version.js` substitui esse placeholder automaticamente durante o release.
- Acesse **Settings → Actions → General → Workflow permissions** e ative **Read and write permissions**.

### Atualização automática de GitHub Actions

Arquivos a copiar:

```
scripts/update-actions.sh
.github/workflows/update-actions.yml
```

Requisitos:
- Crie um **Personal Access Token (PAT)** com o escopo `repo` em **GitHub → Settings → Developer settings → Personal access tokens**.
- Adicione-o como secret `GH_TOKEN` no repositório (**Settings → Secrets and variables → Actions**).
- Opcional: crie uma variable `PR_TEAM` com o nome do time do GitHub que deve ser assignado nos PRs gerados (ex: `merge`).

### Geração de documentação via IA

Arquivos a copiar:

```
.release/generate-docs.js
.github/templates/README.template.md
.github/templates/MANUAL.template.md
.github/workflows/generate-docs.yml
```

Requisitos:
- Adicione o pacote `openai` nas `devDependencies` do `.release/package.json`: `"openai": "^4.0.0"`.
- Configure em **Settings → Secrets and variables → Actions**:

| Tipo | Nome | Valor |
|------|------|-------|
| Secret | `AI_API_KEY` | Chave de API do provider |
| Variable | `AI_BASE_URL` | URL base da API (vazio = OpenAI padrão) |
| Variable | `AI_MODEL` | Modelo a usar (ex: `gpt-4o-mini`) |

### Notificação de documentação para repo de docs

Arquivos a copiar:

```
.github/workflows/repo-dispatch.yml
```

Requisitos:
- Edite `FRIENDLY_NAME` no workflow com o nome do script como deve aparecer na sidebar da documentação.
- O mesmo `GH_TOKEN` (PAT com escopo `repo`) é necessário para disparar eventos em outros repositórios.

---

## 📦 Build para Produção

Para gerar o pacote final do recurso, use o script de build:

```bash
# Formato: ./scripts/build.sh [nome_do_script]
./scripts/build.sh mri_meuscript
```

### O que o build faz:

1. ✅ Limpa a pasta `dist/`
2. ⚛️ Executa `npm run build` dentro de `web/` (gera `web/build/`)
3. 📂 Copia arquivos relevantes (exclui `.git`, `node_modules`, `web/src`, etc.)
4. 🗜️ Compacta em `dist/mri_meuscript.zip`
5. 🚀 Pronto para upload no servidor!

### Saída do Build

```
dist/
├── mri_meuscript/
│   ├── fxmanifest.lua
│   ├── client/
│   ├── server/
│   ├── shared/
│   └── web/               # Apenas o output do build (sem src/)
│       └── build/
│           ├── index.html
│           └── assets/
└── mri_meuscript.zip
```

---

## 📄 Geração de Documentação

O template inclui um pipeline de geração automática de `README.md` e `MANUAL.md` via IA, configurável para qualquer provider compatível com a API da OpenAI (OpenAI, Groq, OpenRouter, Together AI, etc.).

### Como funciona

Ao fazer push na `main` com alterações em arquivos `.lua`, `fxmanifest.lua`, `web/src/` ou nos templates, o workflow `.github/workflows/generate-docs.yml` executa `.release/generate-docs.js`, que:

1. Coleta os arquivos-fonte do script (`fxmanifest.lua`, `client/`, `server/`, `shared/` e `web/src/`)
2. Lê os templates em `.github/templates/`
3. Chama a API de IA para gerar os dois arquivos seguindo a estrutura dos templates
4. Commita `README.md` e `MANUAL.md` de volta no repositório (apenas se houver mudança)

### Configuração

Acesse **Settings → Secrets and variables → Actions** no repositório e configure:

| Tipo | Nome | Descrição |
|------|------|-----------|
| Secret | `AI_API_KEY` | Chave de API do provider escolhido |
| Variable | `AI_BASE_URL` | URL base da API (deixe vazio para usar OpenAI padrão) |
| Variable | `AI_MODEL` | Modelo a usar (ex: `gpt-4o-mini`, `llama-3.3-70b-versatile`) |

### Exemplos de providers

| Provider | `AI_BASE_URL` | Modelo sugerido |
|----------|--------------|-----------------|
| OpenAI | *(vazio)* | `gpt-4o-mini` |
| Groq | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| OpenRouter | `https://openrouter.ai/api/v1` | `google/gemini-flash-1.5` |
| Together AI | `https://api.together.xyz/v1` | `meta-llama/Llama-3-70b-chat-hf` |

### Personalizando os templates

Edite os arquivos em `.github/templates/` para ajustar a estrutura e o estilo da documentação gerada:

- `README.template.md` — voltado para desenvolvedores (dependências, API, eventos, exports)
- `MANUAL.template.md` — voltado para admins de servidor (instalação, configuração, comandos)

### Executar manualmente

Na aba **Actions** do repositório, selecione **Generate Docs** e clique em **Run workflow**.

---

## 🤖 CI/CD e Automação

### GitHub Actions Workflow

O template inclui um workflow pré-configurado (`.github/workflows/release.yml`) que ao fazer push na `main`:

| Ação | Descrição |
|------|-----------|
| ✅ Build do frontend | `npm run build` dentro de `web/` |
| ✅ Build do recurso | Empacota tudo em `dist/` |
| ✅ Versionamento semântico | Analisa os commits e determina a versão |
| ✅ Geração de changelog | Atualiza `CHANGELOG.md` automaticamente |
| ✅ Release no GitHub | Cria tag e release com o `.zip` anexado |

---

## 📝 Convenção de Commits

Obrigatório para o funcionamento do **Semantic Release**:

| Tipo | Descrição | Versão |
|------|-------------|--------|
| `feat:` | Novas funcionalidades | **MINOR** (1.1.0) |
| `fix:` | Correções de bugs | **PATCH** (1.0.1) |
| `chore:` | Manutenção geral | - |
| `docs:` | Documentação | - |
| `refactor:` | Refatoração de código | - |
| `breaking change:` | Mudanças que quebram compatibilidade | **MAJOR** (2.0.0) |

### Exemplos:

```bash
git commit -m "feat: adiciona tela de inventário"
git commit -m "fix: corrige fechamento da NUI ao pressionar ESC"
git commit -m "refactor: migra componentes para shadcn/ui"
git commit -m "breaking change: altera estrutura de eventos NUI"
```

---

## 💻 Exemplos de Código

### Comunicação NUI — Lua → React

```lua
-- client/main.lua
RegisterCommand('abrirmenu', function()
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'setVisible', data = true })
end, false)

RegisterNUICallback('fechar', function(data, cb)
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'setVisible', data = false })
    cb('ok')
end)
```

### Comunicação NUI — React → Lua

```tsx
-- web/src/App.tsx
import { useNuiEvent, fetchNui } from './context/NuiContext'

const App = () => {
    useNuiEvent('setVisible', (visible: boolean) => {
        setOpen(visible)
    })

    const handleFechar = async () => {
        await fetchNui('fechar', {})
    }

    return <button onClick={handleFechar}>Fechar</button>
}
```

### Exemplo: shared/config.lua

```lua
Config = {}

Config.Debug = false
Config.MaxItems = 10
Config.NotifyType = 'ox'  -- 'ox' ou 'qb'
```

---

## 📦 Scripts Disponíveis

### Raiz do projeto

| Comando | Descrição |
|---------|-----------|
| `./scripts/build.sh [nome]` | Build completo (web + empacotamento) |

### `web/`

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento Vite |
| `npm run build` | Build de produção para `web/build/` |
| `npm run lint` | Lint com ESLint |

---

## 🔗 Links Úteis

- 📚 [Documentação Qbox](https://docs.qbox.re/)
- 🛠️ [ox_lib](https://github.com/overextended/ox_lib)
- ⚛️ [React](https://react.dev/)
- ⚡ [Vite](https://vitejs.dev/)
- 🎨 [Tailwind CSS](https://tailwindcss.com/)
- 🤖 [Semantic Release](https://github.com/semantic-release/semantic-release)
- 🐙 [MRI Qbox no GitHub](https://github.com/mri-Qbox-Brasil)
- 💬 [Discord da MRI](https://discord.gg/uEfGD4mmVh)

---

## 📄 Licença

MIT License

---

<p align="center">
  <i>Desenvolvido com excelência pela MRI Qbox Team Brasil 🇧🇷</i>
</p>
