import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
// Relative asset paths so the built app works from any folder or GitHub Pages project URL
export default defineConfig({
  base: './',
  plugins: [react()],
})
