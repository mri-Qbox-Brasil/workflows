#!/usr/bin/env node
'use strict'

// Gera o catálogo de documentação (docs-repos.json) a partir das receitas do
// txAdmin em mriTxRecipe/recipes/*.yaml.
//
// O catálogo é COMMITADO, não gerado em tempo de execução: os nomes derivados
// aqui são só um ponto de partida e devem ser revisados à mão antes do rollout.
//
//   uso: node build-docs-catalog.js <dir-do-mriTxRecipe> [> docs-repos.json]

const fs = require('fs')
const path = require('path')

const ORG = 'mri-Qbox-Brasil'

// Repos que ficam FORA da documentação de recursos. Continuam no catálogo com
// publish:false para que a exclusão seja explícita e auditável, em vez de
// alguém se perguntar depois por que sumiram.
const EXCLUDE = {
    ox_lib: 'já documentado em /overextended',
    ox_inventory: 'já documentado em /overextended',
    ox_target: 'já documentado em /overextended',
    ox_doorlock: 'já documentado em /overextended',
    ox_compat: 'camada de compatibilidade, sem manual próprio',
    'cfx-server-data': 'coleção de resources, não é um recurso',
    addons: 'assets/mapas, não é um recurso',
    PolyZone: 'biblioteca',
    RageUI: 'biblioteca',
    bl_bridge: 'biblioteca (bridge)',
    jim_bridge: 'biblioteca (bridge)',
    object_gizmo: 'biblioteca',
    MugShotBase64: 'biblioteca',
    mri_Qlogo: 'asset',
    'ps-adminmenu': 'repositório arquivado (read-only)',
}

// Repos de fonte privada: o MANUAL.md mora no -source, mas a página deve ser
// publicada com o nome do repo público.
const SOURCE_OF = {
    mri_Qspawn: 'mri_Qspawn-source',
}

const ACRONYMS = new Set([
    'PS', 'CW', 'ND', 'CDN', 'MDT', 'PMA', 'RHD', 'IPL', 'UI', 'NPWD',
    'MM', 'ARS', 'LVC', 'FPS', 'HUD', 'NPC',
])

function friendlyName(repo) {
    // mri_Qbackpack -> "MRI Qbackpack". Preserva a capitalização depois do Q,
    // seguindo o que já está publicado ("MRI Qadmin", "MRI Qbox").
    const mri = repo.match(/^mri[_-]Q(.+)$/i)
    if (mri) return `MRI Q${mri[1]}`

    const words = repo.split(/[_-]/).filter(Boolean).map((w) => {
        const up = w.toUpperCase()
        if (ACRONYMS.has(up)) return up
        return w[0].toUpperCase() + w.slice(1)
    })

    return words.join(' ')
}

function reposFromRecipes(dir) {
    const recipesDir = path.join(dir, 'recipes')
    const found = new Set()

    for (const file of fs.readdirSync(recipesDir).filter((f) => /\.ya?ml$/.test(f))) {
        const text = fs.readFileSync(path.join(recipesDir, file), 'utf8')

        for (const line of text.split('\n')) {
            // Itens comentados são recursos desativados na receita — não entram.
            if (/^\s*#/.test(line)) continue

            const m = line.match(new RegExp(`github\\.com/${ORG}/([A-Za-z0-9_.-]+)`))
            if (!m) continue

            found.add(m[1].replace(/\.git$/, ''))
        }
    }

    return [...found]
}

function main() {
    const dir = process.argv[2]

    if (!dir || !fs.existsSync(path.join(dir, 'recipes'))) {
        console.error('uso: build-docs-catalog.js <dir-do-mriTxRecipe>')
        process.exit(1)
    }

    const repos = reposFromRecipes(dir)
    const bySlug = new Map()

    for (const repo of repos.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()))) {
        const entry = { repo, name: friendlyName(repo) }

        // O MANUAL.md vem do -source; a página sai com o nome do público.
        if (SOURCE_OF[repo]) {
            entry.repo = SOURCE_OF[repo]
            entry.slug = repo
        }

        if (EXCLUDE[repo]) {
            entry.publish = false
            entry.reason = EXCLUDE[repo]
        }

        bySlug.set(repo, entry)
    }

    const catalog = [...bySlug.values()]
    const publishing = catalog.filter((e) => e.publish !== false).length

    console.error(`repos da org nas receitas: ${catalog.length}`)
    console.error(`a publicar: ${publishing} | excluídos: ${catalog.length - publishing}`)

    process.stdout.write(JSON.stringify(catalog, null, 2) + '\n')
}

main()
