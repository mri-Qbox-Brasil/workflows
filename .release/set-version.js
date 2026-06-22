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

// ── 1) fxmanifest.lua: injeta a versao no placeholder __VERSION__ ────────────
// Em release real o manifest passa a ter a versao concreta e a UI a usa direto.
// Atencao: este arquivo NAO deve ser commitado de volta — o source mantem o
// placeholder __VERSION__ para que builds de fonte continuem funcionando.
const manifest = 'fxmanifest.lua';

if (!fs.existsSync(manifest)) {
    console.warn(`[set-version] ${manifest} nao encontrado — pulando injecao no manifest.`);
} else {
    let content = fs.readFileSync(manifest, 'utf8');
    if (!content.includes('__VERSION__')) {
        console.warn(`[set-version] Placeholder "__VERSION__" ausente em ${manifest}. ` +
            'Defina version "__VERSION__" para que a versao seja injetada no build.');
    } else {
        content = content.split('__VERSION__').join(version);
        fs.writeFileSync(manifest, content);
        console.log(`[set-version] Versao ${version} injetada em ${manifest}`);
    }
}

// ── 2) <web-dir>/package.json: sincroniza o fallback exibido na UI ───────────
// Em builds de fonte (onde o fxmanifest ainda e __VERSION__) a UI cai no
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
