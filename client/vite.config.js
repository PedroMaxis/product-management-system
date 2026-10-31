import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// em desenvolvimento, /api vai para o Express (porta 3001): mesmo domínio, sem CORS
export default defineConfig({
  plugins: [react()],
  server: { port: 5176, proxy: { "/api": "http://localhost:3001" } },
  test: { environment: "node" },
});
