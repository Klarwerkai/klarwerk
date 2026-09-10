import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  execFileSync("./tools/build", [], {
    cwd: fileURLToPath(new URL("../../", import.meta.url)),
    stdio: "inherit",
    timeout: 1_200_000,
  });
}
