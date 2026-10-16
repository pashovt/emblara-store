import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// Runs the same /api handler the Vercel function uses, inside the dev server,
// so `npm run dev` is the whole store: storefront, API, dashboard.
function api() {
  return {
    name: 'emblara-api',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      for (const [k, v] of Object.entries(env)) process.env[k] ??= v
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const { handle } = await server.ssrLoadModule('/server/router.js')
        await handle(req, res)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), api()],
})
