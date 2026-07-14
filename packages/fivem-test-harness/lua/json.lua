-- JSON mínimo para o harness.
--
-- O runtime do FiveM injeta um `json` global (lua-cjson). O wasmoon não tem,
-- então reimplementamos o suficiente para o que o código sob teste usa:
-- `json.encode` de um array de strings (linked_principals) e `json.decode` do
-- mesmo. Tabela vazia codifica como `[]`, que é o que parseLinkedPrincipals
-- espera receber de volta.

json = {}

local ESCAPES = {
    ['"']  = '\\"',
    ['\\'] = '\\\\',
    ['\n'] = '\\n',
    ['\r'] = '\\r',
    ['\t'] = '\\t',
    ['\b'] = '\\b',
    ['\f'] = '\\f',
}

local function escapeString(s)
    return (s:gsub('[%c"\\]', function(c)
        return ESCAPES[c] or string.format('\\u%04x', c:byte())
    end))
end

local function isArray(t)
    local count = 0
    for k in pairs(t) do
        if type(k) ~= 'number' then return false end
        count = count + 1
    end
    return count == #t
end

function json.encode(value)
    local t = type(value)

    if value == nil then
        return 'null'
    elseif t == 'boolean' or t == 'number' then
        return tostring(value)
    elseif t == 'string' then
        return '"' .. escapeString(value) .. '"'
    elseif t == 'table' then
        if isArray(value) then
            local parts = {}
            for i = 1, #value do parts[i] = json.encode(value[i]) end
            return '[' .. table.concat(parts, ',') .. ']'
        end

        local parts = {}
        for k, v in pairs(value) do
            parts[#parts + 1] = '"' .. escapeString(tostring(k)) .. '":' .. json.encode(v)
        end
        return '{' .. table.concat(parts, ',') .. '}'
    end

    error(('json.encode: tipo não suportado: %s'):format(t))
end

-- ─── decode ──────────────────────────────────────────────────────────────────

local Parser = {}
Parser.__index = Parser

function Parser.new(str)
    return setmetatable({ s = str, i = 1 }, Parser)
end

function Parser:error(msg)
    error(('json.decode: %s (posição %d)'):format(msg, self.i))
end

function Parser:skipWhitespace()
    local _, stop = self.s:find('^[ \t\r\n]*', self.i)
    self.i = stop + 1
end

function Parser:peek()
    return self.s:sub(self.i, self.i)
end

function Parser:expect(char)
    if self:peek() ~= char then self:error(('esperava %q'):format(char)) end
    self.i = self.i + 1
end

function Parser:parseString()
    self:expect('"')
    local buf = {}

    while true do
        local c = self:peek()
        if c == '' then self:error('string não terminada') end
        self.i = self.i + 1

        if c == '"' then
            return table.concat(buf)
        elseif c == '\\' then
            local esc = self:peek()
            self.i = self.i + 1
            if     esc == 'n' then buf[#buf + 1] = '\n'
            elseif esc == 't' then buf[#buf + 1] = '\t'
            elseif esc == 'r' then buf[#buf + 1] = '\r'
            elseif esc == 'b' then buf[#buf + 1] = '\b'
            elseif esc == 'f' then buf[#buf + 1] = '\f'
            elseif esc == 'u' then
                local hex = self.s:sub(self.i, self.i + 3)
                self.i = self.i + 4
                buf[#buf + 1] = utf8.char(tonumber(hex, 16))
            else
                buf[#buf + 1] = esc -- " \ /
            end
        else
            buf[#buf + 1] = c
        end
    end
end

function Parser:parseValue()
    self:skipWhitespace()
    local c = self:peek()

    if c == '"' then
        return self:parseString()
    elseif c == '{' then
        self.i = self.i + 1
        local obj = {}
        self:skipWhitespace()
        if self:peek() == '}' then self.i = self.i + 1; return obj end
        while true do
            self:skipWhitespace()
            local key = self:parseString()
            self:skipWhitespace()
            self:expect(':')
            obj[key] = self:parseValue()
            self:skipWhitespace()
            local sep = self:peek()
            self.i = self.i + 1
            if sep == '}' then return obj end
            if sep ~= ',' then self:error('esperava "," ou "}"') end
        end
    elseif c == '[' then
        self.i = self.i + 1
        local arr = {}
        self:skipWhitespace()
        if self:peek() == ']' then self.i = self.i + 1; return arr end
        while true do
            arr[#arr + 1] = self:parseValue()
            self:skipWhitespace()
            local sep = self:peek()
            self.i = self.i + 1
            if sep == ']' then return arr end
            if sep ~= ',' then self:error('esperava "," ou "]"') end
        end
    elseif self.s:sub(self.i, self.i + 3) == 'true' then
        self.i = self.i + 4
        return true
    elseif self.s:sub(self.i, self.i + 4) == 'false' then
        self.i = self.i + 5
        return false
    elseif self.s:sub(self.i, self.i + 3) == 'null' then
        self.i = self.i + 4
        return nil
    end

    local numStr = self.s:match('^%-?%d+%.?%d*[eE]?[%+%-]?%d*', self.i)
    if numStr and numStr ~= '' then
        self.i = self.i + #numStr
        return tonumber(numStr)
    end

    self:error(('token inesperado: %q'):format(c))
end

function json.decode(str)
    if type(str) ~= 'string' then error('json.decode: esperava string') end
    local parser = Parser.new(str)
    local value = parser:parseValue()
    parser:skipWhitespace()
    if parser.i <= #parser.s then parser:error('lixo após o valor') end
    return value
end
