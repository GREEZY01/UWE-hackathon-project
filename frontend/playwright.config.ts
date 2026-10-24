import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5174",
    headless: true,
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || "/usr/bin/chromium",
    },
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command:
        "cd ../backend && MODEL_PROVIDER=mock AUDIT_DB=/tmp/finguard-ui-audit.sqlite3 POLICY_DB=/tmp/finguard-ui-policies.sqlite3 EVAL_RESULTS_DIR=/tmp/finguard-ui-eval EVAL_REPORT_PATH=/tmp/finguard-ui-evaluation.md /workspace/finguard-venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8003",
      url: "http://127.0.0.1:8003/health",
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command:
        "API_PROXY_TARGET=http://127.0.0.1:8003 npm run dev -- --port 5174",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
});
