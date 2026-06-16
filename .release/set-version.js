const fs = require('fs');

// Aceita a versão via argumento (`fivem-scripts set-version <versao>`) e cai
// de volta para npm_package_version quando rodado por um lifecycle do npm.
// O release usa o argumento, pois o prepareCmd do semantic-release não
// popula npm_package_version.
const version = process.argv[2] || process.env.npm_package_version;

const file = 'fxmanifest.lua';

if (!version) {
    console.warn('[set-version] Versao nao informada — pulando injecao (placeholder mantido).');
    process.exit(0);
}

if (!fs.existsSync(file)) {
    console.warn(`[set-version] ${file} nao encontrado — nada a fazer.`);
    process.exit(0);
}

let content = fs.readFileSync(file, 'utf8');

if (!content.includes('__VERSION__')) {
    console.warn(`[set-version] Placeholder "__VERSION__" ausente em ${file}. ` +
        'Defina version "__VERSION__" para que a versao seja injetada no build.');
    process.exit(0);
}

content = content.split('__VERSION__').join(version);

fs.writeFileSync(file, content);

console.log(`[set-version] Versao ${version} injetada em ${file}`);
