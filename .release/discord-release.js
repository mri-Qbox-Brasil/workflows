#!/usr/bin/env node
'use strict'

// Notificador de release para o Discord — FONTE ÚNICA.
//
// Consumido em dois lugares, e é por isso que ele mora aqui e não inline em YAML:
//
//   1. `callable-release.yml`, via `npx workflows notify-discord <versão>` no
//      successCmd do semantic-release (o pacote já está instalado no job).
//   2. `.release/templates/release-notify.yml`, injetado nos espelhos públicos
//      pelo `callable-mirror-release`. Lá não há `npm install` nem token do
//      registry privado, então o workflow baixa ESTE arquivo por raw.githubusercontent
//      (o repo `workflows` é público) e roda com o node do runner.
//
// Recebe apenas a versão (semver, à prova de shell) — as notas vêm pela API do
// GitHub. Nunca interpole markdown de commit numa linha de comando: um apóstrofo
// numa mensagem de commit quebra o shell, e em repo público quem escreve o commit
// pode ser um contribuidor externo.
//
// Nunca derruba a release: qualquer falha sai com 0.

// ── Configuração via env ────────────────────────────────────────────────────
const webhook = process.env.DISCORD_RELEASE_WEBHOOK
const apiToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
const modelsToken = process.env.GH_MODELS_TOKEN || apiToken
// Vazio de proposito: cada provedor tem o proprio default (ver PROVIDERS).
// LLM_MODEL e o nome antigo, mantido para nao quebrar quem ja o definiu.
const model = (process.env.AI_MODEL || process.env.LLM_MODEL || '').trim()
// Aponta o embed ao repo público quando fornecido (caso do espelho); senão ao
// repositório atual.
const repo = process.env.NOTIFY_REPO || process.env.GITHUB_REPOSITORY
const author = process.env.GITHUB_ACTOR || ''
const env = (k) => (process.env[k] || '').trim()

const version = (process.argv[2] || '').replace(/^v/, '')

// Kill switch por repo: a variável DISCORD_RELEASE_NOTIFY (ou a chave
// CI_RELEASE_NOTIFY_DISCORD, que o workflow mapeia para cá) desliga a
// notificação. Ligado por padrão.
const notify = env('DISCORD_RELEASE_NOTIFY').toLowerCase()
if (['false', '0', 'off', 'no'].includes(notify)) {
    console.log('[discord] notificação desligada por variável, pulando.')
    process.exit(0)
}
if (!webhook) { console.log('[discord] sem DISCORD_RELEASE_WEBHOOK, pulando.'); process.exit(0) }
if (!repo || !version) { console.log('[discord] repo/versão ausentes, pulando.'); process.exit(0) }

const name = repo.split('/')[1]

// Denylist: repos que nunca avisam no Discord. Mora em .release/notify-denylist.txt
// deste repo e é lida pela `main` a cada aviso, então editar a lista vale na hora
// para todos, sem publicar pacote. A cópia que vai junto no pacote só é usada se
// o raw não responder; no espelho o script roda sozinho e não tem essa cópia.
const DENYLIST_URL =
    'https://raw.githubusercontent.com/mri-Qbox-Brasil/workflows/main/.release/notify-denylist.txt'

function parseDenylist(text) {
    return text
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*/, '').trim().toLowerCase())
        .filter(Boolean)
}

// Devolve a lista, ou null se nenhuma fonte respondeu.
async function loadDenylist() {
    try {
        const res = await fetch(DENYLIST_URL, { signal: AbortSignal.timeout(15000) })
        if (res.ok) return parseDenylist(await res.text())
        console.error(`[discord] denylist: raw respondeu ${res.status}.`)
    } catch (e) { console.error('[discord] denylist: raw falhou:', e.message) }
    try {
        const local = require('path').join(__dirname, 'notify-denylist.txt')
        return parseDenylist(require('fs').readFileSync(local, 'utf8'))
    } catch { return null }
}

// Aceita `dono/repo` ou só `repo` (vale em qualquer dono).
const isDenied = (list, fullName) => {
    const full = fullName.toLowerCase()
    const short = full.split('/')[1]
    return list.some((e) => (e.includes('/') ? e === full : e === short))
}
const tag = `v${version}`
const releaseUrl = `https://github.com/${repo}/releases/tag/${tag}`
const FIELD_MAX = 1000 // limite de field do embed é 1024; folga de segurança.

async function ghJson(path) {
    const res = await fetch(`https://api.github.com${path}`, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'mri-release-notifier',
            ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
        },
    })
    if (!res.ok) throw new Error(`GitHub API ${path} -> ${res.status}`)
    return res.json()
}

const SYSTEM_PROMPT =
    'Você é o redator de notas de versão do MRI QBOX, um conjunto de resources ' +
    'para servidores FiveM (framework QBox). Recebe um changelog técnico gerado ' +
    'por conventional commits e o reescreve como um resumo curto, claro e amigável ' +
    'em português do Brasil, voltado para donos de servidor e jogadores. Regras: ' +
    'use no máximo 5 bullets em markdown (use "- "); foque no que muda na prática; ' +
    'não invente recursos que não estão no changelog; não inclua links, hashes de ' +
    'commit nem nomes de autores; máximo ~800 caracteres; se não houver mudanças ' +
    'relevantes para o usuário, escreva uma única linha de melhorias internas.'

// ── Provedores de IA ────────────────────────────────────────────────────────
// Escolhido por AI_PROVIDER; a chave vem de AI_API_KEY. Só o `github` funciona
// sem chave própria, caindo no token do Actions — e é justamente ele que dá 403
// em org no plano free, que foi o motivo de existir esta abstração.
//
//   groq    grátis, sem cartão. OpenAI-compatible.
//   gemini  grátis com limite diário. Formato próprio de request/response.
//   github  GitHub Models. Precisa de PAT com escopo `models`.
//   custom  qualquer endpoint OpenAI-compatible, via AI_BASE_URL.
//
// Um provedor novo é só mais uma entrada aqui: `url`, `headers`, `body`, `read`.
const PROVIDERS = {
    groq: {
        model: 'llama-3.3-70b-versatile',
        url: () => 'https://api.groq.com/openai/v1/chat/completions',
        headers: (key) => ({ Authorization: `Bearer ${key}` }),
        body: (m, notes) => openaiBody(m, notes),
        read: (d) => d.choices?.[0]?.message?.content,
        needsKey: true,
    },
    gemini: {
        model: 'gemini-2.5-flash',
        // A chave vai na querystring, não no header — o Gemini não usa Bearer.
        url: (m, key) =>
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`,
        headers: () => ({}),
        body: (m, notes) => ({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ role: 'user', parts: [{ text: userPrompt(notes) }] }],
            generationConfig: { temperature: 0.5 },
        }),
        read: (d) => d.candidates?.[0]?.content?.parts?.map((p) => p.text).join(''),
        needsKey: true,
    },
    github: {
        model: 'openai/gpt-4o-mini',
        url: () => 'https://models.github.ai/inference/chat/completions',
        headers: (key) => ({ Authorization: `Bearer ${key}` }),
        body: (m, notes) => openaiBody(m, notes),
        read: (d) => d.choices?.[0]?.message?.content,
        needsKey: false, // cai no GH_MODELS_TOKEN/GITHUB_TOKEN
    },
    custom: {
        model: '',
        url: () => env('AI_BASE_URL'),
        headers: (key) => (key ? { Authorization: `Bearer ${key}` } : {}),
        body: (m, notes) => openaiBody(m, notes),
        read: (d) => d.choices?.[0]?.message?.content,
        needsKey: false,
    },
}

const userPrompt = (notes) => `Changelog técnico da ${tag}:\n\n${notes}`
const openaiBody = (m, notes) => ({
    model: m,
    temperature: 0.5,
    messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt(notes) },
    ],
})

// Reescreve o changelog técnico como um resumo curto e amigável em PT-BR.
// Em qualquer falha, cai para as notas cruas (truncadas).
async function aiSummary(rawNotes) {
    const fallback = (rawNotes || 'Nova versão publicada.').slice(0, FIELD_MAX)
    if (!rawNotes) return fallback

    const chosen = (env('AI_PROVIDER') || 'github').toLowerCase()
    const provider = PROVIDERS[chosen]
    if (!provider) {
        console.error(`[discord] AI_PROVIDER="${chosen}" desconhecido, usando notas cruas.`)
        return fallback
    }

    // `github` aceita o token do Actions; os demais exigem AI_API_KEY própria.
    const key = env('AI_API_KEY') || (chosen === 'github' ? modelsToken : '')
    if (!key && provider.needsKey !== false) {
        console.error(`[discord] sem AI_API_KEY para "${chosen}", usando notas cruas.`)
        return fallback
    }
    if (chosen === 'custom' && !env('AI_BASE_URL')) {
        console.error('[discord] AI_PROVIDER=custom sem AI_BASE_URL, usando notas cruas.')
        return fallback
    }
    if (chosen === 'github' && !key) return fallback

    const m = model || provider.model
    try {
        const res = await fetch(provider.url(m, key), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...provider.headers(key) },
            body: JSON.stringify(provider.body(m, rawNotes)),
        })
        if (!res.ok) throw new Error(`${chosen} ${res.status}`)
        const text = provider.read(await res.json())?.trim()
        if (!text) throw new Error('resposta vazia do modelo')
        console.log(`[discord] descrição gerada via IA (${chosen}/${m}).`)
        return text.slice(0, FIELD_MAX)
    } catch (e) {
        console.error('[discord] IA falhou, usando notas cruas:', e.message)
        return fallback
    }
}

;(async () => {
    // Filtros antes de qualquer dado sair do GitHub (Discord ou provedor de IA).
    // Na dúvida não avisa: perder um aviso é melhor que anunciar repo privado
    // (link 404 pra todo mundo) ou mandar changelog privado pra fora.
    let info
    try { info = await ghJson(`/repos/${repo}`) } catch (e) {
        console.log(`[discord] não consegui ver se ${repo} é público (${e.message}), pulando.`)
        return
    }
    if (info.private || (info.visibility && info.visibility !== 'public')) {
        console.log(`[discord] ${repo} não é público, pulando.`)
        return
    }
    const denylist = await loadDenylist()
    if (!denylist) { console.log('[discord] não consegui ler a denylist, pulando.'); return }
    if (isDenied(denylist, info.full_name || repo)) {
        console.log(`[discord] ${repo} está na denylist, pulando.`)
        return
    }

    const description = info.description || ''
    let rawNotes = ''
    try {
        const rel = await ghJson(`/repos/${repo}/releases/tags/${tag}`)
        rawNotes = rel.body || ''
    } catch (e) { console.error('[discord] não obteve notas da release:', e.message) }

    const whatsNew = await aiSummary(rawNotes)

    // Campos de branding entram só quando a secret correspondente existe: um
    // link vazio ou `image.url: ''` faz o Discord recusar o embed com 400.
    const fields = [{ name: 'O que há de novo?', value: whatsNew }]
    fields.push({
        name: 'Veja todas as mudanças',
        value: `[Veja aqui](https://github.com/${repo}/commits/${tag})`,
    })
    if (env('INVITE_DISCORD_URL'))
        fields.push({ name: 'Precisa de ajuda?', value: `[Participe da comunidade](${env('INVITE_DISCORD_URL')})`, inline: true })
    if (env('DOCS_MRIQBOX_URL'))
        fields.push({ name: 'Documentação', value: `[Acesse aqui](${env('DOCS_MRIQBOX_URL')})`, inline: true })

    const embed = {
        author: { name: 'MRI QBOX - Updates', ...(env('LOGO_MRIQBOX_URL') ? { icon_url: env('LOGO_MRIQBOX_URL') } : {}) },
        title: `[${name}] Nova versão disponível: ${tag}`.slice(0, 256),
        url: releaseUrl,
        description: description.slice(0, 4096),
        fields,
        color: 4243543,
        footer: { text: `Realizado por: ${author}`.slice(0, 2048), ...(env('LOGO_MRIQBOX_URL') ? { icon_url: env('LOGO_MRIQBOX_URL') } : {}) },
        timestamp: new Date().toISOString(),
    }
    if (env('RESOURCE_MRIQBOX_URL')) embed.image = { url: env('RESOURCE_MRIQBOX_URL') }

    const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ embeds: [embed] }),
    })
    console.log('[discord] status', res.status)
    if (!res.ok) console.error('[discord] corpo:', (await res.text()).slice(0, 500))
})().catch((e) => { console.error('[discord] erro não fatal:', e.message); process.exit(0) })
