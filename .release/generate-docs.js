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

const RETRIES = 5;

async function callWithRetry(fn, messages, temperature) {
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
        try {
            return await fn(messages, temperature);
        } catch (err) {
            const isLast = attempt === RETRIES;
            const retryInfo = err.body?.error?.details?.find(d => d['@type']?.endsWith('RetryInfo'));
            const suggested = retryInfo?.retryDelay ? parseInt(retryInfo.retryDelay) * 1000 : null;
            const delay = suggested ?? (attempt * 10000);
            const label = isLast ? 'giving up.' : `retrying in ${delay / 1000}s...`;
            console.warn(`  Attempt ${attempt}/${RETRIES} failed (${err.status || err.message}), ${label}`);
            if (isLast) return null;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

const baseCall = NATIVE ? callGemini : callOpenAI;
const call = (messages, temperature) => callWithRetry(baseCall, messages, temperature);

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

function sanitize(text) {
    if (!text) return null;
    const idx = text.indexOf('#');
    return idx > 0 ? text.slice(idx) : text;
}

async function generate(template, summary) {
    const result = await call([
        { role: 'system', content: 'You are a markdown document generator. Output only the completed document — no preamble, no notes, no checklists, no surrounding fences. Your entire response is the document itself.' },
        { role: 'user',   content: `Fill in the markdown template below using the technical information provided. Write all content in Brazilian Portuguese. Replace every placeholder with real content from the technical information. Your response must start directly with the "#" heading and contain nothing else.\n\nIMPORTANT: If a section has no real content to show (no commands, no exports, no events, no modules, etc.), remove that entire section and its heading from the output — do not write placeholder rows, "none" messages, or empty tables.\n\nTemplate:\n\n${template}\n\n---\n\nTechnical information:\n\n${summary}` },
    ], 0);
    return sanitize(result);
}

// --- main --------------------------------------------------------------

async function main() {
    const bundled = path.join(__dirname, 'templates');
    const readmeTemplate = readIfExists('.github/templates/README.template.md')
        || readIfExists(path.join(bundled, 'README.template.md'));
    const manualTemplate = readIfExists('.github/templates/MANUAL.template.md')
        || readIfExists(path.join(bundled, 'MANUAL.template.md'));

    if (!readmeTemplate || !manualTemplate) {
        console.error('Templates not found in .github/templates/ or bundled defaults.');
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
        const result = await extract(buildBlock(chunks[i]), i, chunks.length);
        if (result) summaries.push(result);
    }
    if (summaries.length === 0) {
        console.error('All chunks failed — aborting.');
        process.exit(1);
    }
    const summary = summaries.join('\n\n---\n\n');

    console.log('\nGenerating README.md...');
    const readme = await generate(readmeTemplate, summary);
    if (!readme) { console.error('README generation failed — aborting.'); process.exit(1); }
    fs.writeFileSync('README.md', readme + '\n');

    console.log('Generating MANUAL.md...');
    const manual = await generate(manualTemplate, summary);
    if (!manual) { console.error('MANUAL generation failed — aborting.'); process.exit(1); }
    fs.writeFileSync('MANUAL.md', manual + '\n');

    console.log('Done.');
}

main().catch(err => {
    console.error(err.message);
    if (err.status) console.error(`Status: ${err.status}`);
    if (err.body)   console.error(`Body:`, JSON.stringify(err.body, null, 2));
    process.exit(1);
});
