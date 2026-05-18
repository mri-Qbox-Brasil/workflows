#!/usr/bin/env node
'use strict'

const { execFileSync } = require('child_process')
const path = require('path')

const [, , command, ...args] = process.argv

const pkgRoot = path.resolve(__dirname, '..')

const commands = {
    build: 'build.sh',
    'update-actions': 'update-actions.sh',
    'generate-docs': 'generate-docs.js',
    'set-version': 'set-version.js',
}

if (!command || !commands[command]) {
    console.error(`Usage: fivem-scripts <${Object.keys(commands).join('|')}> [args...]`)
    process.exit(1)
}

const target = commands[command]
const isJs = target.endsWith('.js')
const targetPath = path.join(pkgRoot, target)

try {
    if (isJs) {
        execFileSync(process.execPath, [targetPath, ...args], { stdio: 'inherit' })
    } else {
        execFileSync('bash', [targetPath, ...args], { stdio: 'inherit' })
    }
} catch (err) {
    process.exit(err.status ?? 1)
}
