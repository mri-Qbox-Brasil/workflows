# [Nome do Recurso]

[Descrição curta e objetiva do que o recurso faz.]

## Principais recursos

- **[Feature principal 1]** — [Descrição].
- **[Feature principal 2]** — [Descrição].
- **[Feature principal 3]** — [Descrição].

## Instalação rápida

1. Copie a pasta `[nome_recurso]` para a pasta de resources do servidor.
2. [Passos adicionais, ex: build do frontend se houver NUI]
3. Adicione `ensure [nome_recurso]` no `server.cfg` (após as dependências obrigatórias).
4. [Execute o script SQL se houver banco de dados]

## Configuração

### Dependências obrigatórias

- `[dependência]` — [Para que é utilizada].

[Se houver banco de dados, descreva o schema e as tabelas aqui.]

### Permissões

[Se houver sistema de permissões, descreva os grupos e níveis de acesso aqui.]

## Comandos

| Comando | Descrição |
|---|---|
| `/[comando]` | [O que o comando faz]. |

## Exports

### Client

| Export | Descrição |
|---|---|
| `[ExportName]` | [O que faz]. |

### Server

| Export | Descrição |
|---|---|
| `[ExportName]` | [O que faz]. |

## Server Modules

| Módulo | Descrição |
|---|---|
| `main.lua` | Lógica principal do servidor. |

## Client Modules

| Módulo | Descrição |
|---|---|
| `main.lua` | Entry point do cliente. |

## Estrutura de arquivos 📁

```
[nome_recurso]/
├── client/
├── server/
├── shared/
[└── web/                 # Apenas se houver NUI]
└── fxmanifest.lua
```

## Observações importantes ⚠️

- [Observação técnica ou de uso relevante para quem for instalar ou usar o recurso.]
