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
                prepareCmd: "REPO_NAME=$(echo $GITHUB_REPOSITORY | cut -d'/' -f2) && npx fivem-scripts build $REPO_NAME"
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
