import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src", "renderer")
    }
  },
  root: ".",
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("@xyflow/react")) {
            return "flow-vendor";
          }
          if (id.includes("radix-ui") || id.includes("lucide-react")) {
            return "ui-vendor";
          }
          return undefined;
        }
      }
    }
  }
});
