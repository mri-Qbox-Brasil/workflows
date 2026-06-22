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
                prepareCmd: "REPO_NAME=$(echo $GITHUB_REPOSITORY | cut -d'/' -f2) && npx fivem-scripts set-version ${nextRelease.version} \"$WEB_PATH\" && npx fivem-scripts build \"$REPO_NAME\" \"$WEB_PATH\""
            }
        ],
        // Commita de volta o bump do package.json do front e o CHANGELOG para
        // que builds de fonte reflitam a ultima versao (issue #3). NUNCA inclui
        // fxmanifest.lua: o source mantem o placeholder __VERSION__.
        [
            '@semantic-release/git',
            {
                assets: [(process.env.WEB_PATH || 'web') + '/package.json', 'CHANGELOG.md'],
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
