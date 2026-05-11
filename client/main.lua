-- NUI command standalone (modo "abrir a UI sozinho", sem passar pelo Qadmin).
-- Quando embedded dentro do Qadmin, o iframe abre direto via URL — esse
-- comando aqui nao e necessario, mas mantemos por compat e dev/debug.

local isOpen = false

-- Cache do config persistido em data/config.json. Hidratado lazy ao primeiro
-- uso e mantido em sync pelo broadcast `plugintest:client:configChanged`.
-- Quem precisar do valor atual chama getConfig() — nao mexa direto na tabela.
local clientConfig = nil

local function getConfig()
    if clientConfig then return clientConfig end
    clientConfig = lib.callback.await('plugintest:server:getConfig', false) or {}
    return clientConfig
end

local function openUi()
    if isOpen then return end
    isOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({ action = 'setVisible', data = { visible = true, config = getConfig() } })
end

local function closeUi()
    if not isOpen then return end
    isOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({ action = 'setVisible', data = { visible = false } })
end

RegisterCommand('plugintest', openUi, false)

RegisterNUICallback('closeUi', function(_, cb)
    closeUi()
    cb({ ok = true })
end)

-- Aba "Configurações" do painel admin — fetch + save dos settings.
RegisterNUICallback('adminGetConfig', function(_, cb)
    cb(getConfig())
end)

RegisterNUICallback('adminSaveConfig', function(payload, cb)
    local ok, result = lib.callback.await('plugintest:server:saveConfig', false, payload)
    if ok and result then clientConfig = result end
    cb({ success = ok == true, config = ok and result or nil })
end)

-- Runtime: server broadcasta quando config muda. Atualiza a cache local e
-- (opcionalmente) reage. Substitua o corpo abaixo pela logica do seu plugin
-- (eg recarregar caches, blips, listeners, etc).
RegisterNetEvent('plugintest:client:configChanged', function(newConfig)
    if type(newConfig) ~= 'table' then return end
    clientConfig = newConfig
    if clientConfig.debug then
        print('[plugintest] ' .. locale('plugin.runtime_config_updated', json.encode(newConfig)))
    end
end)

-- Runtime: convar `mri:color` mudou — repassa pra NUI re-aplicar o tema.
RegisterNetEvent('plugintest:client:accentColorChanged', function(newColor)
    SendNUIMessage({ action = 'accentColorChanged', data = { accentColor = newColor } })
end)
