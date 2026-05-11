-- Boot do plugin. Registra com o mri_Qadmin via export (fail-silent se
-- Qadmin nao tiver) e mantem o NUI command standalone funcionando sempre.

local HEX_PATTERN = '^#%x%x%x%x%x%x$'

local function isValidHex(value)
    return type(value) == 'string' and value:match(HEX_PATTERN) ~= nil
end

local function resolveAccentColor()
    local convar = GetConvar('mri:color', '')
    if isValidHex(convar) then return convar end
    return '#00E699'
end

-- Runtime: convar trocou → broadcast pra todos os clients re-aplicarem o tema
-- sem precisar restart.
AddConvarChangeListener('mri:color', function(name)
    if name ~= 'mri:color' then return end
    TriggerClientEvent('plugintest:client:accentColorChanged', -1, resolveAccentColor())
end)

-- Registra o painel admin como plugin do mri_Qadmin via export. Se Qadmin nao
-- tiver rodando, o pcall protege e o painel continua acessivel via /plugintest
-- standalone normalmente. Manifest shape espelha web/src/plugin/types.ts
-- (drift control manual).
CreateThread(function()
    -- Espera o Qadmin terminar de iniciar (resources podem subir em ordens
    -- diferentes). Se nem tiver no server, o while sai pelo timeout.
    local deadline = GetGameTimer() + 10000
    while GetResourceState('mri_Qadmin') ~= 'started' and GetGameTimer() < deadline do
        Wait(200)
    end
    if GetResourceState('mri_Qadmin') ~= 'started' then return end -- Qadmin ausente, ok

    local ok, result = pcall(function()
        return exports['mri_Qadmin']:RegisterPlugin({
            id = 'plugintest',
            label = 'Plugin Test',
            icon = 'box',
            resource = GetCurrentResourceName(),
            htmlPath = 'html/index.html',
            -- Semantica OR (qualquer uma libera). `command` cobre god/console
            -- como fallback alem do ace especifico.
            requiredPerms = { 'plugintest.admin', 'command' },
            description = 'Plugin de exemplo / template base',
        })
    end)
    if not ok or result == false then
        print('[plugintest] ' .. locale('plugin.register_failed', tostring(result)))
    end
end)
