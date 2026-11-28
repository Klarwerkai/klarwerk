import { execFileSync } from "node:child_process";

export const KLARA_MACOS_TESTS = [
  "tests/klara-office/begleiter-nativ-bau.test.ts",
  "tests/klara-office/native-fenster-logik.test.ts",
];

/** Nur ein erfolgreich abgeschlossener macOS-Lauf für denselben Checkout ersetzt diese zwei Fälle. */
export function aufMacGeprueft(
  plattform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  leseCommit: () => string = () =>
    execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim(),
): string[] {
  const stand = env.KLARWERK_CI_KLARA_MACOS_COMMIT;
  if (
    plattform !== "linux" ||
    env.KLARWERK_CI_KLARA_MACOS_ERGEBNIS !== "success" ||
    !stand ||
    !/^[a-f0-9]{40}$/.test(stand) ||
    stand !== env.GITHUB_SHA
  ) {
    return [];
  }
  return stand === leseCommit() ? [...KLARA_MACOS_TESTS] : [];
}
