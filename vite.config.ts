/// <reference types="vitest" />
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vitest/config"

// https://vite.dev/config/
const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    react(),
    !isTest && tailwindcss(),
  ].filter(Boolean) as any,
  base: "/Ai-News-Dashboard/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  ssr: {
    noExternal: ["@csstools/css-calc", "@asamuzakjp/css-color"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.{test,spec}.ts"],
    server: {
      deps: {
        inline: ["@csstools/css-calc", "@asamuzakjp/css-color"],
      },
    },
  },
})
