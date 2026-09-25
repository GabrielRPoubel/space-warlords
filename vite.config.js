import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // necessário p/ GitHub Pages de projeto: https://<user>.github.io/space-warlords/
  base: '/space-warlords/',
  plugins: [react()],
})
