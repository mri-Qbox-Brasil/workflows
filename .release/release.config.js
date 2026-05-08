const pkg = require('./package.json');

module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'node .release/set-version.js'
            }
        ],
        '@semantic-release/changelog',
        [
            '@semantic-release/github',
            {
                assets: [
                    { path: `dist/${pkg.name}.zip`, label: 'Download' }
                ]
            }
        ]
    ]
};