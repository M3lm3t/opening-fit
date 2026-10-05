import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig(({ command, mode }) => {
  if (command === "build") {
    // Observe the same mode/process environment Vite consumes; never overwrite
    // the deployment's flag. Only this non-secret boolean is logged.
    const flag = loadEnv(mode, process.cwd(), "VITE_STAGE6_REPORTS_ENABLED").VITE_STAGE6_REPORTS_ENABLED;
    if (flag !== undefined && flag !== "true" && flag !== "false") {
      throw new Error("VITE_STAGE6_REPORTS_ENABLED must be exactly true or false (or unset for default-off).");
    }
    console.info(`[report-pilot] mode=${mode}; VITE_STAGE6_REPORTS_ENABLED=${flag ?? "unset (default false)"}`);
  }
  return {
    plugins: [react(), tailwindcss()],
    build: {
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("chess.js")) return "vendor-chess-core";
            if (id.includes("lucide-react")) return "vendor-icons";
            return "vendor-react";
          },
        },
      },
    },
  };
});
