const esbuild = require('esbuild');

esbuild
    .build({
        entryPoints: ['src/index.js', 'src/utils.js', 'src/bulkDocs.js', 'src/constants.js', 'src/openDatabase.js', 'src/parseHex.js'],
        outdir: 'lib',
        bundle: false,
        sourcemap: false,
        minify: false,
        splitting: false,
        platform: 'node',
        format: 'cjs',
        target: ['esnext']
    })
    .catch(() => process.exit(1));