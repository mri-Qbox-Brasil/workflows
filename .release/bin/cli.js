#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const [, , command, ...args] = process.argv;
const ROOT = path.join(__dirname, '..');

const commands = {
    'build':          { cmd: 'bash', script: 'build.sh' },
    'generate-docs':  { cmd: 'node', script: 'generate-docs.js' },
    'set-version':    { cmd: 'node', script: 'set-version.js' },
    'update-actions': { cmd: 'bash', script: 'update-actions.sh' },
};

const def = commands[command];

if (!def) {
    const names = Object.keys(commands).join(', ');
    console.error(`Usage: fivem-scripts <command> [args]`);
    console.error(`Commands: ${names}`);
    process.exit(1);
}

const { status } = spawnSync(def.cmd, [path.join(ROOT, def.script), ...args], { stdio: 'inherit' });
process.exit(status ?? 0);
