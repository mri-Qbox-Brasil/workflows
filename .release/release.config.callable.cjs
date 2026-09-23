module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        ['@semantic-release/npm', { npmPublish: false }],
        [
            '@semantic-release/exec',
            {
                prepareCmd: "REPO_NAME=$(echo $GITHUB_REPOSITORY | cut -d'/' -f2) && npx workflows set-version ${nextRelease.version} \"$WEB_PATH\" && npx workflows build \"$REPO_NAME\" \"$WEB_PATH\""
            }
        ],
        // Commita de volta o fxmanifest.lua, o bump do package.json do front e
        // o CHANGELOG, para que o source sempre reflita a ultima versao lancada.
        [
            '@semantic-release/git',
            {
                assets: ['fxmanifest.lua', (process.env.WEB_PATH || 'web') + '/package.json', 'CHANGELOG.md'],
                message: 'chore(release): ${nextRelease.version} [skip ci]'
            }
        ],
        [
            '@semantic-release/github',
            {
                assets: [{ path: 'dist/*.zip', label: 'Download' }],
                labels: []
            }
        ]
    ]
};
