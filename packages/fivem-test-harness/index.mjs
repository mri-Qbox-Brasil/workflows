// @mriqbox/fivem-test-harness
//
// Roda o Lua REAL de um resource FiveM dentro do Node, sem servidor e sem MySQL.
//
// O resource não roda sozinho porque depende de globais que o runtime do FiveM
// injeta. Globais dá para falsificar — então carregamos os stubs primeiro e o
// arquivo de verdade, lido do disco, por cima. Sem cópia, sem port: o código sob
// teste é o mesmo que vai para o servidor.
//
// Uso:
//
//   const lua = await createHarness({
//       schema:  readFileSync('tests/lua/schema.lua', 'utf8'),   // DefineTable/DefineQuery
//       seed:    "SeedRow('groups', { id = 'mod' })",            // estado inicial
//       sources: ['shared/config.lua', 'server/perms.lua'].map(f => readFileSync(f, 'utf8')),
//   })
//
//   await lua.doString("FireEvent('resource:ready')")
//   expect(await luaList(lua, "AcesOf('group.mod')")).toEqual([...])

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { LuaFactory } from 'wasmoon'

const LUA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), 'lua')
const readLua = (file) => readFileSync(resolve(LUA_DIR, file), 'utf8')

/**
 * Cria um estado Lua com o runtime do FiveM falsificado e o código do resource por cima.
 *
 * A ordem é sempre esta, e importa:
 *   1. runtime  — os globais que o FiveM daria (exports, lib, MySQL, natives)
 *   2. schema   — as tabelas e as SQL do consumidor (DefineTable / DefineQuery)
 *   3. seed     — o estado inicial do cenário (linhas no banco, jogadores online)
 *   4. sources  — o Lua real do resource
 *
 * O seed vem ANTES do source de propósito: o código do resource lê o banco já no
 * boot, então o estado precisa existir antes dele carregar.
 *
 * @param {object}   [options]
 * @param {string}   [options.schema]    Lua com DefineTable/DefineQuery e helpers do consumidor.
 * @param {string}   [options.seed]      Lua que monta o estado inicial.
 * @param {string[]} [options.sources]   Conteúdo dos arquivos .lua do resource, na ordem de carga.
 * @param {string}   [options.resourceName]
 * @returns {Promise<import('wasmoon').LuaEngine>}
 */
export async function createHarness({ schema = '', seed = '', sources = [], resourceName } = {}) {
    const lua = await new LuaFactory().createEngine()

    await lua.doString(readLua('json.lua'))
    await lua.doString(readLua('db.lua'))
    await lua.doString(readLua('fivem.lua'))

    if (resourceName) {
        await lua.doString(`RESOURCE_NAME = ${JSON.stringify(resourceName)}`)
    }

    if (schema) await lua.doString(schema)
    if (seed) await lua.doString(seed)

    for (const source of sources) {
        await lua.doString(source)
    }

    return lua
}

// ─── leitura do estado Lua a partir do JS ─────────────────────────────────────
//
// O wasmoon converte tabela Lua para objeto JS de um jeito que não distingue array
// de dicionário. Em vez de depender disso, atravessamos a fronteira sempre como
// string: o Lua concatena, o JS separa. Chato, mas sem ambiguidade.

// U+0001: não ocorre em nome de permissão, de principal nem de ACE.
const SEPARATOR = String.fromCharCode(1)

/** Avalia uma expressão Lua que devolve um array de strings. */
export async function luaList(lua, expression) {
    const joined = await lua.doString(`return table.concat(${expression}, '\\1')`)
    return joined === '' ? [] : joined.split(SEPARATOR)
}

/** Avalia uma expressão Lua que devolve um escalar (bool, number, string). */
export async function luaValue(lua, expression) {
    return lua.doString(`return ${expression}`)
}
