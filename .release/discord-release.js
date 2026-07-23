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
const model = (process.env.LLM_MODEL || '').trim() || 'openai/gpt-4o-mini'
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

// Reescreve o changelog técnico como um resumo curto e amigável em PT-BR.
// Em qualquer falha, cai para as notas cruas (truncadas).
async function aiSummary(rawNotes) {
    const fallback = (rawNotes || 'Nova versão publicada.').slice(0, FIELD_MAX)
    if (!modelsToken || !rawNotes) return fallback
    try {
        const res = await fetch('https://models.github.ai/inference/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${modelsToken}` },
            body: JSON.stringify({
                model,
                temperature: 0.5,
                messages: [
                    {
                        role: 'system',
                        content:
                            'Você é o redator de notas de versão do MRI QBOX, um conjunto de resources ' +
                            'para servidores FiveM (framework QBox). Recebe um changelog técnico gerado ' +
                            'por conventional commits e o reescreve como um resumo curto, claro e amigável ' +
                            'em português do Brasil, voltado para donos de servidor e jogadores. Regras: ' +
                            'use no máximo 5 bullets em markdown (use "- "); foque no que muda na prática; ' +
                            'não invente recursos que não estão no changelog; não inclua links, hashes de ' +
                            'commit nem nomes de autores; máximo ~800 caracteres; se não houver mudanças ' +
                            'relevantes para o usuário, escreva uma única linha de melhorias internas.',
                    },
                    { role: 'user', content: `Changelog técnico da ${tag}:\n\n${rawNotes}` },
                ],
            }),
        })
        if (!res.ok) throw new Error(`GitHub Models ${res.status}`)
        const data = await res.json()
        const text = data.choices?.[0]?.message?.content?.trim()
        if (!text) throw new Error('resposta vazia do modelo')
        console.log('[discord] descrição gerada via IA.')
        return text.slice(0, FIELD_MAX)
    } catch (e) {
        console.error('[discord] IA falhou, usando notas cruas:', e.message)
        return fallback
    }
}

;(async () => {
    let rawNotes = ''
    let description = ''
    try {
        const rel = await ghJson(`/repos/${repo}/releases/tags/${tag}`)
        rawNotes = rel.body || ''
    } catch (e) { console.error('[discord] não obteve notas da release:', e.message) }
    try {
        const info = await ghJson(`/repos/${repo}`)
        description = info.description || ''
    } catch (e) { console.error('[discord] não obteve descrição do repo:', e.message) }

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
