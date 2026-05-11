import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'

// Em prod, `locales/*.json` sao servidos pelo FiveM via fxmanifest files{}
// (caminho `/locales/{lang}.json` resolve via cfx-nui-{resource}). Em dev,
// o Vite server precisa de um middleware que sirva esses mesmos arquivos
// da raiz do resource pro fetch funcionar.
function serveLocales(): Plugin {
    return {
        name: 'serve-locales',
        configureServer(server) {
            server.middlewares.use('/locales', (req, res, next) => {
                const filePath = resolve(__dirname, '..', 'locales', (req.url ?? '').replace(/^\//, ''))
                if (!existsSync(filePath)) return next()
                res.setHeader('Content-Type', 'application/json; charset=utf-8')
                res.end(readFileSync(filePath, 'utf-8'))
            })
        },
    }
}

// Build outputa pra ../html/ (raiz do resource), padronizado com mri_Qmultichar
// e mri_Qspawn. fxmanifest.lua aponta `ui_page 'html/index.html'`.
export default defineConfig({
    plugins: [react(), serveLocales()],
    base: './', // Vital pra NUI do FiveM (paths relativos no index.html)
    resolve: {
        alias: {
            '@': resolve(__dirname, './src'),
        },
    },
    build: {
        outDir: resolve(__dirname, '../html'),
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
            },
            output: {
                entryFileNames: 'assets/[name].js',
                chunkFileNames: 'assets/[name].js',
                assetFileNames: 'assets/[name].[ext]',
            },
        },
    },
})
