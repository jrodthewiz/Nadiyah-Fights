import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vitest/config";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const clientPort = Number(process.env.NADIYAH_DEV_CLIENT_PORT ?? process.env.VITE_PORT ?? 5173);
const serverPort = process.env.NADIYAH_DEV_SERVER_PORT ?? process.env.PORT ?? "2567";

export default defineConfig({
  root: "client",
  publicDir: false,
  test: {
    root: projectRoot,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**", "dist/**"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(projectRoot, "shared"),
    },
  },
  server: {
    port: clientPort,
    proxy: {
      "/api": `http://localhost:${serverPort}`,
    },
    fs: {
      allow: [projectRoot],
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
  },
});
