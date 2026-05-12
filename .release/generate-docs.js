#!/usr/bin/env node

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || undefined,
});

const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';
const CHUNKS = Math.max(1, parseInt(process.env.AI_CHUNKS || '4', 10));

function readIfExists(filePath) {
    return fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
}

function luaFilesIn(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => f.endsWith('.lua'))
        .map(f => path.join(dir, f));
}

function tsFilesIn(dir) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts'))
        .map(f => path.join(dir, f));
}

function collectSources() {
    const candidates = [
        'fxmanifest.lua',
        ...luaFilesIn('client'),
        ...luaFilesIn('server'),
        ...luaFilesIn('shared'),
        ...tsFilesIn('web/src'),
    ];
    return Object.fromEntries(
        candidates
            .map(f => [f, readIfExists(f)])
            .filter(([, content]) => content !== null)
    );
}

function langFor(filePath) {
    const ext = path.extname(filePath).slice(1);
    if (ext === 'tsx') return 'tsx';
    if (ext === 'ts') return 'typescript';
    return 'lua';
}

function buildBlock(entries) {
    return entries
        .map(([name, content]) => `### ${name}\n\`\`\`${langFor(name)}\n${content}\n\`\`\``)
        .join('\n\n');
}

function splitIntoChunks(entries, n) {
    const size = Math.ceil(entries.length / n);
    const chunks = [];
    for (let i = 0; i < entries.length; i += size) {
        chunks.push(entries.slice(i, i + size));
    }
    return chunks;
}

async function extract(block, index, total) {
    console.log(`  Chunk ${index + 1}/${total}...`);
    const { choices } = await client.chat.completions.create({
        model: MODEL,
        temperature: 0,
        messages: [
            {
                role: 'system',
                content: 'You are a code analyst for FiveM resources. Extract technical information from source code concisely and accurately. Return markdown.',
            },
            {
                role: 'user',
                content: `Extract from this source code (part ${index + 1} of ${total}):\n- Resource name and description\n- Dependencies\n- Commands (name, permission, description)\n- Exports (name, parameters, description)\n- Key events triggered or listened to\n- Configuration options\n- Main features and functionality\n\nSource:\n\n${block}`,
            },
        ],
    });
    return choices[0].message.content.trim();
}

async function generate(template, summary) {
    const { choices } = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: 'You are a technical writer for FiveM scripts. Generate documentation in Brazilian Portuguese. Follow the exact structure and style of the provided template. Use only information from the technical summary. Return only the final markdown — no explanations, no surrounding code fences.',
            },
            {
                role: 'user',
                content: `Template:\n\n${template}\n\n---\n\nTechnical summary extracted from source code:\n\n${summary}`,
            },
        ],
    });
    return choices[0].message.content.trim();
}

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

    console.log(`Provider : ${process.env.AI_BASE_URL || 'OpenAI default'}`);
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
    const readme = await generate(readmeTemplate, summary);
    fs.writeFileSync('README.md', readme + '\n');

    console.log('Generating MANUAL.md...');
    const manual = await generate(manualTemplate, summary);
    fs.writeFileSync('MANUAL.md', manual + '\n');

    console.log('Done.');
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
