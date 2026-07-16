import { defineConfig } from "playwright/test";

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./test-results",
  reporter: "line",
  use: {
    trace: "retain-on-failure",
  },
});
