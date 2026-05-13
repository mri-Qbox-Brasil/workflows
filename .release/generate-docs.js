#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const MODEL   = process.env.AI_MODEL    || 'gpt-4o-mini';
const CHUNKS  = Math.max(1, parseInt(process.env.AI_CHUNKS || '4', 10));
const NATIVE  = (process.env.AI_PROVIDER || '').toLowerCase() === 'gemini';

// --- clients -----------------------------------------------------------

async function callOpenAI(messages, temperature) {
    const OpenAI = require('openai');
    const client = new OpenAI({
        apiKey:  process.env.AI_API_KEY,
        baseURL: process.env.AI_BASE_URL || undefined,
    });
    const { choices } = await client.chat.completions.create({ model: MODEL, temperature, messages });
    return choices[0].message.content.trim();
}

async function callGemini(messages, temperature) {
    const key = process.env.AI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;

    const system = messages.find(m => m.role === 'system');
    const user   = messages.find(m => m.role === 'user');

    const body = {
        systemInstruction: system ? { parts: [{ text: system.content }] } : undefined,
        contents: [{ role: 'user', parts: [{ text: user.content }] }],
        generationConfig: { temperature, maxOutputTokens: 8192 },
    };

    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();

    if (!res.ok) throw Object.assign(new Error(data.error?.message || res.statusText), { status: res.status, body: data });

    return data.candidates[0].content.parts[0].text.trim();
}

const call = NATIVE ? callGemini : callOpenAI;

// --- source collection -------------------------------------------------

function readIfExists(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function luaFilesIn(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => f.endsWith('.lua')).map(f => path.join(dir, f));
}

function tsFilesIn(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts')).map(f => path.join(dir, f));
}

function collectSources() {
    const candidates = [
        'fxmanifest.lua',
        ...luaFilesIn('client'),
        ...luaFilesIn('server'),
        ...luaFilesIn('shared'),
        ...tsFilesIn('web/src'),
    ];
    return Object.fromEntries(candidates.map(f => [f, readIfExists(f)]).filter(([, c]) => c !== null));
}

function langFor(filePath) {
    const ext = path.extname(filePath).slice(1);
    if (ext === 'tsx') return 'tsx';
    if (ext === 'ts')  return 'typescript';
    return 'lua';
}

function buildBlock(entries) {
    return entries.map(([name, content]) => `### ${name}\n\`\`\`${langFor(name)}\n${content}\n\`\`\``).join('\n\n');
}

function splitIntoChunks(entries, n) {
    const size = Math.ceil(entries.length / n);
    const chunks = [];
    for (let i = 0; i < entries.length; i += size) chunks.push(entries.slice(i, i + size));
    return chunks;
}

// --- AI steps ----------------------------------------------------------

async function extract(block, index, total) {
    console.log(`  Chunk ${index + 1}/${total}...`);
    return call([
        { role: 'system', content: 'You are a code analyst for FiveM resources. Extract technical information from source code concisely and accurately. Return markdown.' },
        { role: 'user',   content: `Extract from this source code (part ${index + 1} of ${total}):\n- Resource name and description\n- Dependencies\n- Commands (name, permission, description)\n- Exports (name, parameters, description)\n- Key events triggered or listened to\n- Configuration options\n- Main features and functionality\n\nSource:\n\n${block}` },
    ], 0);
}

async function generate(template, summary) {
    return call([
        { role: 'system', content: 'You are a technical writer for FiveM scripts. Generate documentation in Brazilian Portuguese. Follow the exact structure and style of the provided template. Use only information from the technical summary. Return only the final markdown — no explanations, no surrounding code fences.' },
        { role: 'user',   content: `Template:\n\n${template}\n\n---\n\nTechnical summary extracted from source code:\n\n${summary}` },
    ], 0.2);
}

// --- main --------------------------------------------------------------

async function main() {
    const readmeTemplate = readIfExists('.github/templates/README.template.md');
    const manualTemplate = readIfExists('.github/templates/MANUAL.template.md');

    if (!readmeTemplate || !manualTemplate) {
        console.error('Templates not found in .github/templates/');
        process.exit(1);
    }

    const sources = collectSources();
    const entries = Object.entries(sources);

    if (entries.length === 0) {
        console.error('No source files found (client/, server/, shared/, fxmanifest.lua).');
        process.exit(1);
    }

    console.log(`Provider : ${NATIVE ? 'Gemini native' : (process.env.AI_BASE_URL || 'OpenAI default')}`);
    console.log(`Model    : ${MODEL}`);
    console.log(`Chunks   : ${CHUNKS}`);
    console.log(`Sources  : ${Object.keys(sources).join(', ')}`);

    console.log('\nExtracting from source chunks...');
    const chunks = splitIntoChunks(entries, CHUNKS);
    const summaries = [];
    for (let i = 0; i < chunks.length; i++) {
        summaries.push(await extract(buildBlock(chunks[i]), i, chunks.length));
    }
    const summary = summaries.join('\n\n---\n\n');

    console.log('\nGenerating README.md...');
    fs.writeFileSync('README.md', await generate(readmeTemplate, summary) + '\n');

    console.log('Generating MANUAL.md...');
    fs.writeFileSync('MANUAL.md', await generate(manualTemplate, summary) + '\n');

    console.log('Done.');
}

main().catch(err => {
    console.error(err.message);
    if (err.status) console.error(`Status: ${err.status}`);
    if (err.body)   console.error(`Body:`, JSON.stringify(err.body, null, 2));
    process.exit(1);
});
