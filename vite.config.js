import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// When deployed to GitHub Pages the app lives at  /<repo-name>/
// The VITE_BASE_PATH env-var is injected by the deploy workflow.
// Locally it falls back to '/' so `npm run dev` works without changes.
export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
})
