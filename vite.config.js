import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: './',
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
    },
    build: {
        target: 'chrome120', // Electron 28 uses Chrome 120
        minify: 'esbuild',
        sourcemap: false,
        chunkSizeWarningLimit: 1000,
    }
})
