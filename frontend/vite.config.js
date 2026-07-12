import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("react-chessboard")) return "vendor-chessboard";
          if (id.includes("chess.js")) return "vendor-chess-core";
          if (id.includes("jspdf") || id.includes("qrcode")) return "vendor-export";
          if (id.includes("lucide-react")) return "vendor-icons";
          return "vendor-react";
        },
      },
    },
  },
});
