-- Persiste settings da aba Configuracoes em data/config.json. Editavel via
-- aba "Configurações" do /plugintest (gateado por plugintest.admin OU
-- `command` ACE). Padrao: copia em memoria + SaveResourceFile a cada
-- escrita + broadcast pra clients reaplicarem sem restart.

local CONFIG_FILE = 'data/config.json'

-- Defaults: usados como fallback se o JSON estiver ausente/corrompido OU
-- se faltar campo (forward-compat — adicionar setting novo nao quebra
-- installs antigos). Devem bater com os defaults documentados em
-- shared/config.lua.
local DEFAULTS = {
    debug = false,
    welcomeMessage = 'Hello, Plugin Test!',
}

local config = {}

local function applyDefaults(input)
    local out = {}
    for k, v in pairs(DEFAULTS) do
        if input[k] ~= nil then
            out[k] = input[k]
        else
            out[k] = v
        end
    end
    return out
end

local function loadFromDisk()
    local raw = LoadResourceFile(GetCurrentResourceName(), CONFIG_FILE)
    if not raw or raw == '' then
        config = applyDefaults({})
        return
    end
    local ok, parsed = pcall(json.decode, raw)
    config = applyDefaults((ok and type(parsed) == 'table') and parsed or {})
end

local function saveToDisk()
    local ok = SaveResourceFile(
        GetCurrentResourceName(),
        CONFIG_FILE,
        json.encode(config, { indent = true }),
        -1
    )
    if not ok then
        print('[' .. GetCurrentResourceName() .. '] ' .. locale('plugin.file_write_failed', CONFIG_FILE))
    end
    return ok
end

local function isAdmin(source)
    return IsPlayerAceAllowed(source, 'plugintest.admin')
        or IsPlayerAceAllowed(source, 'command')
end

loadFromDisk()

-- Lua-side getter pra outros scripts/comandos lerem (ex: o broadcast usa
-- pra mandar a versao corrente em runtime sem reler do disco).
function GetPluginConfig()
    return config
end

lib.callback.register('plugintest:server:getConfig', function()
    return config
end)

lib.callback.register('plugintest:server:saveConfig', function(source, payload)
    if not isAdmin(source) then return false, locale('plugin.no_permission') end
    if type(payload) ~= 'table' then return false, locale('plugin.invalid_payload') end

    -- Merge defaults+payload pra garantir shape valido (ignora chaves extras).
    config = applyDefaults(payload)
    if not saveToDisk() then return false, locale('plugin.config_save_failed') end

    -- Broadcast pra todos os clients reaplicarem sem restart.
    TriggerClientEvent('plugintest:client:configChanged', -1, config)
    return true, config
end)
