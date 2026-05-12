module.exports = {
    branches: ['main'],
    plugins: [
        '@semantic-release/commit-analyzer',
        '@semantic-release/release-notes-generator',
        '@semantic-release/changelog',
        ['@semantic-release/npm', { npmPublish: false, pkgRoot: '.release' }],
        [
            '@semantic-release/exec',
            {
                prepareCmd: "sed -i 's/__VERSION__/${nextRelease.version}/g' fxmanifest.lua && REPO_NAME=$(echo $GITHUB_REPOSITORY | cut -d'/' -f2) && bash .release/build.sh $REPO_NAME"
            }
        ],
        [
            '@semantic-release/github',
            {
                assets: [
                    { path: 'dist/*.zip', label: 'Download' }
                ],
                labels: []
            }
        ]
    ]
};
