-- Stubs do runtime do FiveM (+ ox_lib + QBCore).
--
-- Um resource FiveM não roda sozinho: tudo que ele consome vem de globais que o
-- runtime injeta — `exports`, `lib`, `MySQL`, os natives de ACE, CreateThread,
-- TriggerEvent. Globais dá para falsificar, e é isso que permite carregar o
-- server/*.lua REAL, lido do disco, sem port e sem reescrita.
--
-- Dois truques carregam qualquer suíte construída em cima disto:
--
--   1. O ESTADO É UMA TABELA LUA. ACEs viram entradas em `ACES`, o banco vira
--      tabelas em `DB` (ver db.lua). Depois de dirigir uma operação, o teste lê
--      essas tabelas e compara com o esperado.
--
--   2. OS PONTOS DE ENTRADA SE AUTO-CAPTURAM. `lib.callback.register` guarda o
--      handler em CALLBACKS, então o teste invoca um callback exatamente como a
--      NUI invocaria. `AddEventHandler` faz o mesmo, o que permite disparar o
--      evento de boot do resource e simular a inicialização inteira.
--
-- ─── O que este harness NÃO modela (e ninguém deve fingir que modela) ─────────
--   • CreateThread roda SÍNCRONO e Wait() é no-op. Corrida de verdade não é fiel.
--     Um `while true ... Wait(100)` trava — não carregue arquivos que tenham um.
--   • O SQL é falso (ver db.lua). Isto testa LÓGICA, não PERSISTÊNCIA: um INSERT
--     com coluna errada passa aqui e quebra em produção.
--   • Natives do jogo (SetEntityCoords, spawn de veículo, noclip) estão fora de
--     alcance, e não há utilidade em fingir que não estão.

-- ─── estado observável pelo teste ─────────────────────────────────────────────

ACES              = {} -- [principal][object] = true
PRINCIPAL_PARENTS = {} -- [child] = { parent, ... }  (child herda as ACEs do parent)
CALLBACKS         = {} -- [name] = fn   (lib.callback.register)
EVENTS            = {} -- [name] = { fn, ... }  (AddEventHandler / RegisterNetEvent)
COMMANDS          = {} -- [name] = fn   (lib.addCommand)
CLIENT_EVENTS     = {} -- { name, target, args }  (TriggerClientEvent)
NOTIFICATIONS     = {} -- { src, message, type }  (QBCore.Functions.Notify)
LOGS              = {} -- { src, resource, category, level, message, data }  (AddLog)
PLAYERS           = {} -- [src] = { citizenid, license, name, job, gang, identifiers }

function ResetRuntime()
    ACES, PRINCIPAL_PARENTS = {}, {}
    CALLBACKS, EVENTS, COMMANDS = {}, {}, {}
    CLIENT_EVENTS, NOTIFICATIONS, LOGS = {}, {}, {}
    PLAYERS, CONVARS = {}, {}
end

-- ─── ACEs e principals ────────────────────────────────────────────────────────
--
-- O FiveM resolve ACE por HERANÇA de principal: um ACE em `mri.group.god` vale
-- para `char:ABC` se char:ABC herda de mri.group.god, e por sua vez para
-- `identifier.license:xxx` se este herda de char:ABC. Sem modelar essa cadeia, um
-- HasPerms que a percorre não significaria nada aqui.

local function addAce(principal, object)
    ACES[principal] = ACES[principal] or {}
    ACES[principal][object] = true
end

local function removeAce(principal, object)
    if ACES[principal] then ACES[principal][object] = nil end
end

local function addPrincipal(child, parent)
    PRINCIPAL_PARENTS[child] = PRINCIPAL_PARENTS[child] or {}
    for _, p in ipairs(PRINCIPAL_PARENTS[child]) do
        if p == parent then return end -- já herda
    end
    table.insert(PRINCIPAL_PARENTS[child], parent)
end

local function removePrincipal(child, parent)
    local parents = PRINCIPAL_PARENTS[child]
    if not parents then return end
    for i = #parents, 1, -1 do
        if parents[i] == parent then table.remove(parents, i) end
    end
end

--- Resolve o ACE subindo a cadeia de herança. `seen` protege de ciclo.
local function principalAllowed(principal, object, seen)
    seen = seen or {}
    if seen[principal] then return false end
    seen[principal] = true

    local granted = ACES[principal]
    if granted and granted[object] then return true end

    for _, parent in ipairs(PRINCIPAL_PARENTS[principal] or {}) do
        if principalAllowed(parent, object, seen) then return true end
    end
    return false
end

function IsPrincipalAceAllowed(principal, object)
    return principalAllowed(principal, object)
end

function IsPlayerAceAllowed(src, object)
    local player = PLAYERS[tonumber(src) or src]
    if not player then return false end
    for _, id in ipairs(player.identifiers) do
        if principalAllowed('identifier.' .. id, object) then return true end
        if principalAllowed(id, object) then return true end
    end
    return false
end

function GetNumPlayerIdentifiers(src)
    local player = PLAYERS[tonumber(src) or src]
    return player and #player.identifiers or 0
end

function GetPlayerIdentifier(src, index)
    local player = PLAYERS[tonumber(src) or src]
    return player and player.identifiers[index + 1] -- o native é 0-based
end

function GetAces()
    local lines = {}
    for principal, objects in pairs(ACES) do
        for object in pairs(objects) do
            lines[#lines + 1] = ('allow %s %s'):format(principal, object)
        end
    end
    return table.concat(lines, '\n')
end

function GetPrincipals()
    local lines = {}
    for child, parents in pairs(PRINCIPAL_PARENTS) do
        for _, parent in ipairs(parents) do
            lines[#lines + 1] = ('%s %s'):format(child, parent)
        end
    end
    return table.concat(lines, '\n')
end

-- ─── jogadores ────────────────────────────────────────────────────────────────

--- Registra um jogador online no runtime falso.
--- Os principals NÃO são escritos aqui: quem os escreve é o código sob teste,
--- disparado pelo evento de player loaded. É esse o caminho que interessa testar.
function AddPlayer(src, opts)
    local license = opts.license or ('license:%s'):format(src)

    -- Handle de ped estável e distinto do source. Distinto de propósito: confundir os
    -- dois é um bug real e recorrente (passar cache.serverId onde se espera uma entidade),
    -- e um harness em que ped == src esconderia isso.
    local ped = opts.ped or (1000 + src)

    PLAYERS[src] = {
        citizenid    = opts.citizenid,
        license      = license,
        name         = opts.name or ('Player%s'):format(src),
        charinfo     = opts.charinfo or { firstname = 'Nome', lastname = ('Sobrenome%s'):format(src) },
        job          = opts.job or { name = 'unemployed', grade = { level = 0 } },
        gang         = opts.gang or { name = 'none', grade = { level = 0 } },
        qbPermission = opts.qbPermission, -- 'god' / 'admin', para o auto-sync do QBCore
        identifiers  = { license },
        ped          = ped,
        money        = opts.money or { cash = 500, bank = 5000, crypto = 0 },
    }

    local c = opts.coords or { x = 100.0, y = 200.0, z = 30.0 }
    ENTITY_COORDS[ped] = { x = c.x, y = c.y, z = c.z }
end

function GetPlayerName(src)
    local player = PLAYERS[tonumber(src) or src]
    return player and player.name or ('Unknown(%s)'):format(tostring(src))
end

function GetPlayers()
    local ids = {}
    for src in pairs(PLAYERS) do ids[#ids + 1] = tostring(src) end
    table.sort(ids)
    return ids
end

-- ─── entidades (peds) ─────────────────────────────────────────────────────────
--
-- Modelamos o suficiente para testar CONTROLE DE ALVO — congelar, teleportar,
-- mover. Não é fingir que temos GTA: é reproduzir o contrato dos natives que a
-- lógica do servidor consome, incluindo os valores de borda que causam bug.
--
-- O detalhe que mais importa: GetPlayerPed de um jogador que não existe devolve
-- **0**, e GetEntityCoords(0) devolve **vec3(0,0,0)** — a origem do mapa. Não é
-- erro, é silêncio. É exatamente assim que um admin vai parar embaixo do mapa ao
-- teleportar para um alvo que acabou de desconectar. Um harness que devolvesse nil
-- aqui esconderia a classe inteira de bug.

FROZEN_PEDS   = {} -- [ped] = true/false, o que FreezeEntityPosition recebeu
ENTITY_COORDS = {} -- [ped] = { x, y, z }

local ORIGIN = { x = 0.0, y = 0.0, z = 0.0 }

function vector3(x, y, z)
    return { x = x, y = y, z = z }
end

function GetPlayerPed(src)
    local player = PLAYERS[tonumber(src) or src]
    return player and player.ped or 0 -- 0 = ped inválido, como o native
end

function GetEntityCoords(ped)
    if not ped or ped == 0 then return vector3(ORIGIN.x, ORIGIN.y, ORIGIN.z) end
    local c = ENTITY_COORDS[ped] or ORIGIN
    return vector3(c.x, c.y, c.z)
end

function SetEntityCoords(ped, x, y, z)
    ENTITY_COORDS[ped] = { x = x, y = y, z = z }
end

function FreezeEntityPosition(ped, frozen)
    FROZEN_PEDS[ped] = frozen and true or false
end

--- O ped está congelado AGORA? Distingue "nunca tocado" (nil) de "descongelado" (false).
function IsPedFrozen(src)
    local ped = GetPlayerPed(src)
    if ped == 0 then return nil end
    return FROZEN_PEDS[ped]
end

-- ─── routing buckets ─────────────────────────────────────────────────────────

local BUCKETS = {} -- [src] = bucket

function GetPlayerRoutingBucket(src) return BUCKETS[tonumber(src) or src] or 0 end
function SetPlayerRoutingBucket(src, bucket) BUCKETS[tonumber(src) or src] = bucket end

-- ─── eventos ──────────────────────────────────────────────────────────────────

function AddEventHandler(name, fn)
    EVENTS[name] = EVENTS[name] or {}
    table.insert(EVENTS[name], fn)
end

RegisterNetEvent = AddEventHandler

function TriggerEvent(name, ...)
    for _, fn in ipairs(EVENTS[name] or {}) do fn(...) end
end

--- Simula um evento vindo de um client: o FiveM expõe o remetente no global
--- `source`, e vários handlers fazem `local src = source` na primeira linha.
function FireNetEvent(src, name, ...)
    local previous = source
    source = src
    local ok, err = pcall(TriggerEvent, name, ...)
    source = previous
    if not ok then error(err, 0) end
end

function TriggerClientEvent(name, target, ...)
    CLIENT_EVENTS[#CLIENT_EVENTS + 1] = { name = name, target = target, args = { ... } }
end

-- ─── threads ──────────────────────────────────────────────────────────────────
-- Síncrono de propósito. Ver o aviso no topo do arquivo.

function CreateThread(fn) fn() end
function Wait(_) end
function SetTimeout(_, fn) fn() end

local gameTimer = 0
function GetGameTimer()
    gameTimer = gameTimer + 1000 -- monotônico: rate limiting depende disso
    return gameTimer
end

-- ─── resource ────────────────────────────────────────────────────────────────

RESOURCE_NAME = 'test_resource'

function GetCurrentResourceName() return RESOURCE_NAME end
function GetResourceState(_) return 'stopped' end
function LoadResourceFile(_, _) return nil end

-- ─── dinheiro ─────────────────────────────────────────────────────────────────
--
-- AddMoney/RemoveMoney do QBCore NÃO são somadores burros: eles validam o valor
-- antes de tocar no saldo. Reproduzir essa guarda é obrigatório — um harness que
-- somasse qualquer coisa faria um teste de "valor negativo drena todo mundo"
-- passar com cara de verdadeiro, provando um bug que o core não deixa acontecer.
--
-- O contrato abaixo é o do core de verdade (qb-core e qbx_core concordam):
--
--   qb-core  server/player.lua : `amount = tonumber(amount)
--                                 if not amount or amount < 0 then return end`
--   qbx_core server/player.lua : validateMoneyAmount() — tonumber, rejeita não-finito,
--                                arredonda, rejeita < 0
--
-- Ou seja: valor negativo, nil ou não-numérico é RECUSADO pelo core, sem erro e sem
-- mexer no saldo. Tipo de dinheiro inexistente idem. É por isso que a validação do
-- lado do mri_Qadmin é defesa em profundidade (mensagem e log corretos), e não a
-- única linha entre o admin e um saldo negativo.

--- Espelha o validateMoneyAmount do qbx_core.
local function validateMoneyAmount(value)
    value = tonumber(value)
    if not value then return nil end
    if value ~= value then return nil end                       -- NaN
    if value == math.huge or value == -math.huge then return nil end
    value = math.floor(value + 0.5)                             -- round
    if value < 0 then return nil end
    return value
end

local function playerMoneyFns(src, player)
    return {
        GetMoney = function(moneyType)
            return player.money[moneyType]
        end,

        AddMoney = function(moneyType, amount)
            local amt = validateMoneyAmount(amount)
            if not amt or player.money[moneyType] == nil then return false end
            player.money[moneyType] = player.money[moneyType] + amt
            return true
        end,

        RemoveMoney = function(moneyType, amount)
            local amt = validateMoneyAmount(amount)
            if not amt or player.money[moneyType] == nil then return false end
            player.money[moneyType] = player.money[moneyType] - amt
            return true
        end,
    }
end

--- Saldo atual de um jogador. É o estado EFETIVO, depois de o core ter validado.
function MoneyOf(src, moneyType)
    local player = PLAYERS[tonumber(src) or src]
    if not player then return nil end
    return player.money[moneyType]
end

-- ─── convars ──────────────────────────────────────────────────────────────────

CONVARS = {} -- [name] = value

function GetConvar(name, default) return CONVARS[name] or default end
function SetConvar(name, value) CONVARS[name] = value end
function SetConvarReplicated(name, value) CONVARS[name] = value end
function AddConvarChangeListener(_, _) end

-- ─── QBCore ───────────────────────────────────────────────────────────────────

QBCore = {
    Functions = {
        GetPlayers = function()
            local ids = {}
            for src in pairs(PLAYERS) do ids[#ids + 1] = src end
            table.sort(ids)
            return ids
        end,

        GetPlayer = function(src)
            local player = PLAYERS[tonumber(src) or src]
            if not player then return nil end
            return {
                PlayerData = {
                    source    = tonumber(src) or src,
                    citizenid = player.citizenid,
                    license   = player.license,
                    name      = player.name,
                    charinfo  = player.charinfo,
                    job       = player.job,
                    gang      = player.gang,
                    -- A MESMA tabela, não uma cópia: o que AddMoney escreve tem que
                    -- ser o que MoneyOf lê.
                    money     = player.money,
                },
                Functions = playerMoneyFns(src, player),
            }
        end,

        GetIdentifier = function(src, _)
            local player = PLAYERS[tonumber(src) or src]
            return player and player.license
        end,

        HasPermission = function(src, rank)
            local player = PLAYERS[tonumber(src) or src]
            return player ~= nil and player.qbPermission == rank
        end,

        Notify = function(src, message, mType)
            NOTIFICATIONS[#NOTIFICATIONS + 1] = { src = src, message = message, type = mType }
        end,
    },
    Shared = {
        Trim = function(s) return (tostring(s):gsub('^%s+', ''):gsub('%s+$', '')) end,
    },
}

-- ─── exports ──────────────────────────────────────────────────────────────────
-- Dois usos, uma tabela só:
--   exports['qb-core']:GetCoreObject()   -> indexação + chamada com `:`
--   exports('RegisterPermissions', fn)   -> chamada direta, registra um export

EXPORTS = {} -- [name] = fn, os exports registrados pelo código sob teste

local resourceProxy = {
    GetCoreObject = function() return QBCore end,
}

exports = setmetatable({}, {
    __index = function() return resourceProxy end,
    __call  = function(_, name, fn) EXPORTS[name] = fn end,
})

-- ─── ox_lib ───────────────────────────────────────────────────────────────────

lib = {
    addAce          = function(principal, object) addAce(principal, object) end,
    removeAce       = function(principal, object) removeAce(principal, object) end,
    addPrincipal    = function(child, parent) addPrincipal(child, parent) end,
    removePrincipal = function(child, parent) removePrincipal(child, parent) end,

    -- Ponto de captura: guarda o handler para o teste invocar como a NUI invocaria.
    callback = {
        register = function(name, fn) CALLBACKS[name] = fn end,
    },

    addCommand = function(name, _, fn) COMMANDS[name] = fn end,

    -- Um Debug() típico faz lib.print[level](...) — qualquer nível vira no-op.
    print = setmetatable({}, { __index = function() return function() end end }),

    string = {
        random = function(pattern) return (tostring(pattern):gsub('%a', 'A'):gsub('%d', '1')) end,
    },
}

-- ─── globais que outros arquivos do resource definiriam ───────────────────────

--- Normalmente vem de um logs.lua. Carregar o arquivo inteiro traria webhooks de
--- Discord e buffers em memória que não interessam a um teste de lógica.
function AddLog(src, resource, category, level, message, data)
    LOGS[#LOGS + 1] = {
        src = src, resource = resource, category = category,
        level = level, message = message, data = data,
    }
end

--- Vem do ox_lib (`ox_lib "locale"`). Devolve a própria chave: os testes asseveram
--- comportamento, não texto traduzido.
function locale(key, ...)
    local args = { ... }
    if #args == 0 then return key end

    local parts = {}
    for i, v in ipairs(args) do parts[i] = tostring(v) end
    return ('%s(%s)'):format(key, table.concat(parts, ','))
end

-- ─── helpers de teste ─────────────────────────────────────────────────────────

--- Invoca um callback registrado (lib.callback.register) como a NUI faria.
function Callback(name, src, ...)
    local fn = CALLBACKS[name]
    if not fn then
        error(('[harness] callback não registrado: %s'):format(tostring(name)))
    end
    return fn(src, ...)
end

--- ACEs concedidas a um principal, ordenadas. É o estado EFETIVO — o que o FiveM
--- responderia — em oposição ao que está salvo no banco.
function AcesOf(principal)
    local out = {}
    for object in pairs(ACES[principal] or {}) do out[#out + 1] = object end
    table.sort(out)
    return out
end

--- Mensagens de notificação enviadas a um jogador.
function NotificationsFor(src)
    local out = {}
    for _, n in ipairs(NOTIFICATIONS) do
        if n.src == src then out[#out + 1] = n.message end
    end
    return out
end

--- Mensagens registradas em LOGS numa categoria ('money', 'bans', ...).
--- Um log é uma AFIRMAÇÃO de que algo aconteceu: se a operação foi recusada e o log
--- foi escrito assim mesmo, a trilha de auditoria está mentindo. Isso é testável.
function LogMessages(category)
    local out = {}
    for _, l in ipairs(LOGS) do
        if l.category == category then out[#out + 1] = l.message end
    end
    return out
end
