import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // BASE_PATH is set by the GitHub Pages workflow (e.g. /luke/); defaults to / for local dev.
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss()],
})
