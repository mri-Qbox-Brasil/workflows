const fs = require('fs');

const version = process.env.npm_package_version;

if (!version) {
    console.error('Version not found');
    process.exit(1);
}

const file = 'fxmanifest.lua';

let content = fs.readFileSync(file, 'utf8');

content = content.replace("__VERSION__", version);

fs.writeFileSync(file, content);

console.log(`Version ${version} injected into fxmanifest.lua`);