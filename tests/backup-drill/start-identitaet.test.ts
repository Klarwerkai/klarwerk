import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

// Diagnose des Auftragskonflikts: echtes npx/tsx, keine PATH-Attrappe.
// server.ts schreibt genau process.pid. Die unveränderte Drill-Prüfung verlangt dagegen $!.
it("misst die getrennten PIDs von produktivem Launcher und TypeScript-Prozess", () => {
  const r = spawnSync(
    "npx",
    ["--no-install", "tsx", "-e", "console.log('SERVER_PID=' + process.pid)"],
    {
      cwd: resolve(import.meta.dirname, "../.."),
      encoding: "utf8",
      timeout: 20000,
      env: { ...process.env, npm_config_offline: "true" },
    },
  );
  expect(r.status, r.stderr).toBe(0);
  const serverPid = Number(r.stdout.match(/SERVER_PID=(\d+)/)?.[1]);
  expect(serverPid).toBeGreaterThan(0);
  console.log(`PID-Befund: Launcher=${r.pid} Server=${serverPid} Identität=${r.pid === serverPid}`);
  expect(serverPid).not.toBe(r.pid);
});
