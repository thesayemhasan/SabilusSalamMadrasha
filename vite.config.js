import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' : GitHub Pages (সাবফোল্ডার) এবং নিজের ডোমেইন/cPanel, দুই জায়গাতেই চলবে
export default defineConfig({
  base: './',
  plugins: [react()],
})
