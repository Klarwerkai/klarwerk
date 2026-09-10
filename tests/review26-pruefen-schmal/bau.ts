// Private Cloud-Schnappschüsse enthalten kein dist. Auch dort dieselbe echte App messen.
// Als globalSetup nutzbar, wenn andere Chromium-Dateien denselben Bau benötigen.
import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { bewerteFrische, sammleFrische } from "../../scripts/dist-frische";

export default async function baueFrisch(): Promise<void> {
  if (bewerteFrische(sammleFrische(process.cwd())).frisch) return;
  const { stdout } = await promisify(execFile)(
    process.execPath,
    [resolve("apps/web/node_modules/vite/bin/vite.js"), "build"],
    { cwd: resolve("apps/web"), timeout: 180_000, maxBuffer: 4 * 1024 * 1024 },
  );
  console.log(stdout.trim().split("\n").at(-1));
}
