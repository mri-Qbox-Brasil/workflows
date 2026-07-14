# @mriqbox/fivem-test-harness

Roda o **Lua real** de um resource FiveM dentro do Node — sem servidor FiveM, sem GTA, sem MySQL.

Um resource não roda sozinho: a primeira linha de um `server/*.lua` típico já é
`exports['qb-core']:GetCoreObject()`, e o arquivo inteiro depende de `MySQL`, `lib`, `Config`,
`TriggerEvent` — tudo global, injetado pelo runtime.

Globais dá para falsificar. É essa a ideia inteira: carregamos os stubs primeiro e o **arquivo de
verdade, lido do disco**, por cima. Sem cópia, sem port, sem reescrita — o código sob teste é o
mesmo que vai para o servidor.

O Lua é o 5.4 do [wasmoon](https://github.com/ceifa/wasmoon), que bate com o `lua54 'yes'` do
`fxmanifest.lua`.

## Instalação

```bash
pnpm add -D @mriqbox/fivem-test-harness
```

## A linha de corte: o que entra aqui e o que fica no seu repo

Este pacote é o **runtime**, e só. Ele modela o que **todo** resource FiveM tem pela frente —
`exports`, `ox_lib`, QBCore, natives, ACEs com herança de principal, um banco falso. Nada aqui
sabe o que é um "grupo", uma "permissão de página" ou a sua tabela de `settings`.

O que é **do seu resource** fica **no seu resource**:

| Fica no seu repo | Por quê |
|---|---|
| O schema do banco (`DefineTable` / `DefineQuery`) | As tabelas e as SQL são suas |
| Helpers de domínio (`FireDbReady`, `GroupAces`…) | Nomeiam conceitos que só existem no seu resource |
| Os specs | Óbvio |

O `mri_Qadmin` é a referência: o runtime vem daqui, e o `tests/lua/schema.lua` dele declara as
próprias tabelas e os próprios atalhos.

**Precisa de algo que o runtime não tem?** Duas saídas, nesta ordem:

1. **Defina no seu lado.** O harness carrega o schema *depois* dos stubs, então qualquer global
   que você declarar lá sobrescreve ou complementa o runtime. Isso resolve a esmagadora maioria
   dos casos e não exige mexer neste pacote.
2. **Só então, proponha aqui** — e apenas se for algo que *qualquer* resource FiveM encontraria.
   Um native novo, um campo de `AddPlayer`: sim. A regra de negócio do seu script: não.

A régua para aceitar mudança neste pacote é essa: **serve para qualquer resource, ou só para o
seu?** Se for só para o seu, a resposta é o item 1.

### Fidelidade não é opcional

Os stubs reproduzem o **contrato real** do que falsificam, não uma versão conveniente.

O caso que ensinou isso: `AddMoney` do QBCore não é um somador burro — ele valida antes de tocar
no saldo (`qb-core` e `qbx_core` fazem `if not amount or amount < 0 then return end`). Um harness
que somasse qualquer coisa faria um teste de *"valor negativo drena todo mundo"* passar com cara de
verdadeiro — provando um bug que o core **não deixa acontecer**. Foi exatamente assim que a suíte
do `mri_Qadmin` desmentiu um achado 🔴 da própria auditoria.

Um fake errado produz resultado errado com cara de verdadeiro. Se você adicionar um stub aqui,
vá ler a fonte do que está falsificando.

## Uso

```js
import { readFileSync } from 'node:fs'
import { createHarness, luaList, luaValue } from '@mriqbox/fivem-test-harness'

const lua = await createHarness({
    resourceName: 'meu_resource',
    schema: readFileSync('tests/schema.lua', 'utf8'),   // DefineTable / DefineQuery
    seed: `
        SeedRow('groups', { id = 'mod' })
        AddPlayer(1, { citizenid = 'ABC', license = 'license:xyz' })
    `,
    sources: ['shared/config.lua', 'server/permissions.lua'].map(f => readFileSync(f, 'utf8')),
})

await lua.doString(`
    TriggerEvent('meu_resource:db:ready')
    Callback('meu_resource:server:SalvarGrupo', 1, 'mod', { 'perm.a' })
`)

expect(await luaList(lua, "AcesOf('grupo.mod')")).toEqual(['perm.a'])
```

A ordem de carga é sempre essa e **importa**: runtime → schema → seed → sources. O seed vem antes
do source porque o código do resource lê o banco já no boot.

## Os dois truques que fazem funcionar

**O estado é uma tabela Lua.** ACEs viram entradas em `ACES`; o banco vira tabelas em `DB`. Depois
de dirigir uma operação, o teste lê essas tabelas e compara com o esperado.

**Os pontos de entrada se auto-capturam.** `lib.callback.register` guarda o handler em `CALLBACKS`,
então o teste invoca um callback exatamente como a NUI invocaria. `AddEventHandler` faz o mesmo, o
que permite disparar o evento de boot e simular a inicialização inteira do resource.

## O banco falso

O motor não conhece tabela nenhuma — quem declara é o consumidor:

```lua
DefineTable('groups')

DefineQuery("SELECT * FROM meus_grupos WHERE id = ?", function(params)
    return SelectRows(DB.groups, function(row) return row.id == params[1] end)
end)
```

O dispatcher casa a SQL por **igualdade exata** da string normalizada (whitespace colapsado). Sem
regex, sem substring, sem prefixo.

Isso não é preciosismo. O protótipo deste harness já foi mordido exatamente aí: um dispatcher que
casava por substring fazia o padrão de `SELECT ... WHERE group_id = ?` casar **também** o
`DELETE ... WHERE group_id = ?`. O DELETE nunca rodava — e podia igualmente ter passado por sorte,
em vez de falhar. **Um banco falso errado produz resultado errado com cara de verdadeiro.**

Corolário: SQL não mapeada **estoura erro**. Nunca devolve `nil` silencioso. Se alguém mudar uma
query no resource, o teste quebra alto dizendo qual string ficou órfã, em vez de virar verde à toa.

## O que ele modela

- **ACEs com herança de principal.** `IsPrincipalAceAllowed` sobe a cadeia
  (`identifier.license:x` → `char:ABC` → `grupo.god`), que é como o FiveM resolve de verdade. Sem
  isso, um `HasPerms` que percorre a cadeia não significaria nada.
- `exports`, tanto `exports['qb-core']:GetCoreObject()` quanto `exports('Nome', fn)`.
- `lib` do ox_lib: `addAce`, `removeAce`, `addPrincipal`, `removePrincipal`, `callback.register`,
  `addCommand`, `print`.
- QBCore: `GetPlayer`, `GetPlayers`, `GetIdentifier`, `HasPermission`, `Notify`.
- **Dinheiro** (`Player.Functions.AddMoney` / `RemoveMoney` / `GetMoney`), com a **mesma guarda do core
  de verdade**: `tonumber`, recusa não-finito e recusa negativo — `qb-core` faz
  `if not amount or amount < 0 then return end`, `qbx_core` faz o mesmo em `validateMoneyAmount()`.
  Isto **não** é detalhe: um `AddMoney` que fosse um somador burro faria um teste de "valor negativo
  drena todo mundo" passar com cara de verdadeiro, provando um bug que o core não deixa acontecer. Foi
  exatamente o que a suíte deste repo desmentiu no S-12 do `BUGS_AUDIT.md`.
- Peds e coords (`GetPlayerPed`, `GetEntityCoords`, `FreezeEntityPosition`), incluindo as bordas que
  causam bug de verdade: `GetPlayerPed` de quem não existe devolve **0**, e `GetEntityCoords(0)` devolve
  **vec3(0,0,0)** — a origem do mapa, não um erro.
- Convars (`GetConvar`, `SetConvarReplicated`, `AddConvarChangeListener`) e routing buckets.
- Eventos, incluindo o global `source` que o FiveM expõe em net event (`FireNetEvent`).
- `json` (encode/decode) e `locale`.

## O que ele NÃO modela — e ninguém deve fingir que modela

- **O SQL é falso.** Isto testa *lógica*, não *persistência*. Um `INSERT` com coluna errada passa
  aqui e quebra em produção.
- **`CreateThread` roda síncrono** e `Wait()` é no-op. Corrida de verdade não é fiel — e um
  `while true ... Wait(100)` **trava**. Não carregue arquivos que tenham um; chame direto a função
  que o laço chamaria.
- **Natives do jogo** (`SetEntityCoords`, spawn de veículo, noclip) estão fora de alcance.

O alvo útil é **autorização e integridade de dados** — o núcleo de risco, e o que não precisa de
GTA nenhum para se manifestar.

## Regra de ouro ao escrever teste

Todo teste de correção deve ser rodado **contra a versão sem a correção** e falhar lá. Um teste que
passa nos dois lados não está provando nada — e o jeito mais barato de garantir isso para sempre é
congelar o arquivo vulnerável numa fixture e afirmar, num teste, que o bug ainda aparece nele.

## API

| Símbolo | Onde | O que é |
|---|---|---|
| `createHarness({ schema, seed, sources, resourceName })` | JS | Cria o estado Lua com tudo carregado |
| `luaList(lua, expr)` / `luaValue(lua, expr)` | JS | Lê array / escalar do Lua |
| `DefineTable(nome)` / `DefineQuery(sql, fn)` | Lua | Declara o schema do banco falso |
| `SeedRow(tabela, linha)` | Lua | Escreve estado inicial sem passar pelo dispatcher |
| `SelectRows` / `DeleteRows` / `RowExists` | Lua | Helpers para escrever handler |
| `AddPlayer(src, opts)` | Lua | Registra jogador online (`opts.money`, `opts.coords`, `opts.job`, …) |
| `Callback(nome, src, ...)` | Lua | Invoca um `lib.callback` como a NUI faria |
| `FireNetEvent(src, nome, ...)` | Lua | Dispara net event com o global `source` setado |
| `FireStateBagChange(bag, chave, valor)` | Lua | Dispara os handlers de state bag capturados |
| `AcesOf(principal)` / `NotificationsFor(src)` | Lua | Lê o estado efetivo |
| `MoneyOf(src, tipo)` | Lua | Saldo depois de o core ter validado |
| `LogMessages(categoria)` | Lua | Logs escritos — um log é uma *afirmação* de que algo ocorreu |
| `IsPedFrozen(src)` | Lua | Distingue "descongelado" (false) de "nunca tocado" (nil) |
| `DB`, `ACES`, `LOGS`, `CLIENT_EVENTS`, `SQL_LOG` | Lua | Estado cru, para assert |
