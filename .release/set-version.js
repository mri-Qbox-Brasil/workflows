const fs = require('fs');
const path = require('path');

// Versao via argumento (`set-version <versao> [web-dir]`), com fallback para
// npm_package_version quando rodado por um lifecycle do npm. O release usa o
// argumento, pois o prepareCmd do semantic-release nao popula npm_package_version.
const version = process.argv[2] || process.env.npm_package_version;

// Diretorio do front (onde mora o package.json exibido na UI). Configuravel via
// 2o argumento ou WEB_PATH; default "web". Ver issue #3.
const webDir = process.argv[3] || process.env.WEB_PATH || 'web';

if (!version) {
    console.warn('[set-version] Versao nao informada — pulando injecao (placeholder mantido).');
    process.exit(0);
}

// ── 1) fxmanifest.lua: grava a versao lancada ────────────────────────────────
// O manifest e commitado de volta pelo release, entao o source sempre reflete a
// ultima versao lancada. Aceita os dois estados do arquivo:
//   - placeholder __VERSION__ (repo ainda nao migrado / primeira release);
//   - versao concreta de uma release anterior (`version '1.2.3'`), que e
//     substituida pela nova.
const manifest = 'fxmanifest.lua';
// Linha `version '...'` / `version "..."` / `version('...')` no inicio da linha
// (nao casa `fx_version`, que tem prefixo).
const versionLine = /^([ \t]*version[ \t]*\(?[ \t]*)(['"])[^'"\n]*\2/m;

if (!fs.existsSync(manifest)) {
    console.warn(`[set-version] ${manifest} nao encontrado — pulando injecao no manifest.`);
} else {
    const content = fs.readFileSync(manifest, 'utf8');
    let updated;
    if (content.includes('__VERSION__')) {
        updated = content.split('__VERSION__').join(version);
    } else if (versionLine.test(content)) {
        updated = content.replace(versionLine, (_, head, q) => `${head}${q}${version}${q}`);
    } else {
        console.warn(`[set-version] Nenhuma linha "version" em ${manifest}. ` +
            "Defina version '__VERSION__' para que a versao seja injetada.");
    }
    if (updated !== undefined) {
        fs.writeFileSync(manifest, updated);
        console.log(`[set-version] Versao ${version} gravada em ${manifest}`);
    }
}

// ── 2) <web-dir>/package.json: sincroniza o fallback exibido na UI ───────────
// Em builds de fonte com o fxmanifest ainda em __VERSION__ a UI cai no
// pkg.version baked no bundle. Sem este sync esse fallback nunca e bumpado e a
// versao fica congelada. Roda independente do bloco do manifest acima.
const pkgPath = path.join(webDir, 'package.json');

if (!fs.existsSync(pkgPath)) {
    console.log(`[set-version] ${pkgPath} nao encontrado — pulando sync do front.`);
} else {
    const raw = fs.readFileSync(pkgPath, 'utf8');
    const pkg = JSON.parse(raw);
    pkg.version = version;
    // Preserva a indentacao existente (default 2 espacos, padrao npm) para nao
    // sujar o diff reformatando o arquivo inteiro.
    const indent = (raw.match(/^([ \t]+)"/m) || [null, '  '])[1];
    const trailingNl = raw.endsWith('\n') ? '\n' : '';
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, indent) + trailingNl);
    console.log(`[set-version] Versao ${version} sincronizada em ${pkgPath}`);
}
