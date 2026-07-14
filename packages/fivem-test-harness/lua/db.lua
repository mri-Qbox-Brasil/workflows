-- Motor de banco de dados falso — agnóstico de schema.
--
-- Não conhece tabela nenhuma. Quem define o schema é o consumidor, chamando
-- DefineTable/DefineQuery. Aqui mora só a máquina: o dispatcher, os wrappers do
-- MySQL do oxmysql e os helpers de consulta.
--
-- ─── A regra de ouro ──────────────────────────────────────────────────────────
-- Um banco falso ERRADO produz resultado errado com cara de verdadeiro. O
-- protótipo deste harness já foi mordido: um dispatcher que casava SQL por
-- substring fazia o padrão de `SELECT ... WHERE group_id = ?` casar TAMBÉM o
-- `DELETE ... WHERE group_id = ?`. O DELETE nunca rodava — e podia igualmente
-- ter PASSADO por sorte.
--
-- Defesa: o dispatcher casa a SQL por IGUALDADE EXATA da string normalizada
-- (whitespace colapsado). Sem regex, sem substring, sem prefixo — é impossível um
-- SELECT casar um DELETE.
--
-- Corolário: SQL não mapeada ESTOURA ERRO. Nunca retorna nil silencioso. Se
-- alguém mudar uma query no código sob teste, o teste quebra alto dizendo qual
-- string não conhece, em vez de virar verde à toa.
-- ──────────────────────────────────────────────────────────────────────────────

DB = {} -- [tabela] = array de linhas
SQL_LOG = {} -- toda query executada, na ordem (para depurar teste)

local HANDLERS = {} -- [sql normalizada] = function(params)
local TABLE_NAMES = {} -- ordem de declaração, para o Reset

-- ─── API de schema (usada pelo consumidor) ───────────────────────────────────

--- Declara uma tabela do banco falso. Começa vazia.
function DefineTable(name)
    if not DB[name] then
        TABLE_NAMES[#TABLE_NAMES + 1] = name
    end
    DB[name] = {}
end

--- Colapsa whitespace para que quebra de linha e indentação no fonte não mudem a
--- chave. NÃO mexe em maiúsculas nem no conteúdo: a comparação segue exata.
local function normalize(sql)
    return (tostring(sql):gsub('%s+', ' '):gsub('^ ', ''):gsub(' $', ''))
end

--- Mapeia uma SQL literal do código sob teste para um handler.
---
--- O handler recebe os params posicionais (`?`) e deve devolver exatamente o que o
--- oxmysql devolveria PARA AQUELE CALL SITE — array de linhas para `.query`, uma
--- linha para `.single`, um escalar para `.scalar`, id/afetadas para `.insert`/`.update`.
function DefineQuery(sql, handler)
    local key = normalize(sql)
    if HANDLERS[key] then
        error(('[harness/db] query definida duas vezes:\n  %s'):format(key))
    end
    HANDLERS[key] = handler
end

function ResetDB()
    for _, name in ipairs(TABLE_NAMES) do DB[name] = {} end
    SQL_LOG = {}
end

-- ─── helpers para quem escreve handler ───────────────────────────────────────

local function copyRow(row)
    local out = {}
    for k, v in pairs(row) do out[k] = v end
    return out
end

--- Linhas que satisfazem `predicate`, como CÓPIAS.
--- Cópias, e não as linhas reais, porque o código sob teste muta o que recebe de
--- uma query (ex.: anexar campos ao resultado antes de devolver para a NUI).
function SelectRows(rows, predicate)
    local out = {}
    for _, row in ipairs(rows) do
        if not predicate or predicate(row) then out[#out + 1] = copyRow(row) end
    end
    return out
end

--- Remove as linhas que satisfazem `predicate`. Devolve quantas saíram.
function DeleteRows(rows, predicate)
    local removed = 0
    for i = #rows, 1, -1 do
        if predicate(rows[i]) then
            table.remove(rows, i)
            removed = removed + 1
        end
    end
    return removed
end

function RowExists(rows, predicate)
    for _, row in ipairs(rows) do
        if predicate(row) then return true end
    end
    return false
end

--- Insere uma linha direto, sem passar pelo dispatcher.
--- Use para montar o estado inicial de um cenário — o que "já estava no banco".
function SeedRow(tableName, row)
    if not DB[tableName] then
        error(('[harness/db] tabela não declarada: %s (falta um DefineTable?)'):format(tostring(tableName)))
    end
    DB[tableName][#DB[tableName] + 1] = row
end

-- ─── dispatcher ──────────────────────────────────────────────────────────────

local function dispatch(method, sql, params)
    local key = normalize(sql)
    SQL_LOG[#SQL_LOG + 1] = { method = method, sql = key, params = params }

    local handler = HANDLERS[key]
    if not handler then
        error(('[harness/db] SQL não mapeada (%s):\n  %s\n\n' ..
               'Declare um DefineQuery para ela. Não devolvemos nil silenciosamente de ' ..
               'propósito: um banco falso incompleto transforma teste quebrado em teste verde.')
              :format(method, key), 2)
    end

    return handler(params or {})
end

MySQL = {
    query  = { await = function(sql, params) return dispatch('query',  sql, params) end },
    single = { await = function(sql, params) return dispatch('single', sql, params) end },
    scalar = { await = function(sql, params) return dispatch('scalar', sql, params) end },
    insert = { await = function(sql, params) return dispatch('insert', sql, params) end },
    update = { await = function(sql, params) return dispatch('update', sql, params) end },
}
