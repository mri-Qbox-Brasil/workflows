const pkg = require('./package.json');

module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        ['@semantic-release/npm', { npmPublish: false, pkgRoot: '.release' }],
        [
            '@semantic-release/exec',
            {
                prepareCmd: 'npm_package_version=${nextRelease.version} node .release/set-version.js'
            }
        ],
        '@semantic-release/changelog',
        [
            '@semantic-release/github',
            {
                assets: [
                    { path: `dist/${pkg.name}.zip`, label: 'Download' }
                ],
                labels: []
            }
        ]
    ]
};