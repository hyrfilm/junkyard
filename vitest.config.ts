/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      $utils: fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    globals: true
  }
})
