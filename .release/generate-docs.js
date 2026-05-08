#!/usr/bin/env node

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL || undefined,
});

const MODEL = process.env.AI_MODEL || 'gpt-4o-mini';

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

function buildSourceBlock(sources) {
    return Object.entries(sources)
        .map(([name, content]) => `### ${name}\n\`\`\`${langFor(name)}\n${content}\n\`\`\``)
        .join('\n\n');
}

async function generate(template, sourceBlock) {
    const response = await client.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        messages: [
            {
                role: 'system',
                content: [
                    'You are a technical writer for FiveM Lua scripts.',
                    'Generate documentation in Brazilian Portuguese.',
                    'Follow the exact structure and style of the provided template.',
                    'Replace all placeholder content with accurate information extracted from the source code.',
                    'Return only the final markdown content — no explanations, no surrounding code fences.',
                ].join(' '),
            },
            {
                role: 'user',
                content: `Template (replicate this structure exactly):\n\n${template}\n\n---\n\nSource code:\n\n${sourceBlock}`,
            },
        ],
    });

    return response.choices[0].message.content.trim();
}

async function main() {
    const readmeTemplate = readIfExists('.github/templates/README.template.md');
    const manualTemplate = readIfExists('.github/templates/MANUAL.template.md');

    if (!readmeTemplate || !manualTemplate) {
        console.error('Templates not found in .github/templates/');
        process.exit(1);
    }

    const sources = collectSources();

    if (Object.keys(sources).length === 0) {
        console.error('No source files found (client/, server/, shared/, fxmanifest.lua).');
        process.exit(1);
    }

    console.log(`Provider : ${process.env.AI_BASE_URL || 'OpenAI default'}`);
    console.log(`Model    : ${MODEL}`);
    console.log(`Sources  : ${Object.keys(sources).join(', ')}`);

    const sourceBlock = buildSourceBlock(sources);

    console.log('Generating README.md...');
    const readme = await generate(readmeTemplate, sourceBlock);
    fs.writeFileSync('README.md', readme + '\n');

    console.log('Generating MANUAL.md...');
    const manual = await generate(manualTemplate, sourceBlock);
    fs.writeFileSync('MANUAL.md', manual + '\n');

    console.log('Done.');
}

main().catch(err => {
    console.error(err.message);
    process.exit(1);
});
