#!/usr/bin/env tsx
// AUFTRAG-mega38 BLOCK C — der Aufruf. Die Begruendung steht vollstaendig in `dist-frische.ts`.
// Er ist beiden Smoke-Befehlen vorgeschaltet (`package.json` → `smoke:ui`, `smoke:ui:gate`) und
// bricht mit Exit-Code 1 ab. Kein `warn`, kein `|| true`.
//
// AUFTRAG-mega39 BLOCK E2: „ein Waechter, den man uebergehen kann, ist keiner" stand hier — das war
// zu viel behauptet. Man KANN ihn uebergehen, naemlich durch einen direkten Playwright-Aufruf an den
// npm-Skripten vorbei. Was gilt: fuer die zwei benannten Befehle ist er nicht abschaltbar (hart per
// `&&`, Exit-Code 1). Was nicht gilt: eine allgemeine Zusicherung, dass der Smoke nie ein altes
// Buendel faehrt. Die Grenze ist ausfuehrlich in `dist-frische.ts` begruendet.
import { bewerteFrische, frischeMeldung, sammleFrische } from "./dist-frische";

const wurzel = process.cwd();
const urteil = bewerteFrische(sammleFrische(wurzel));

if (!urteil.frisch) {
  process.stderr.write(`${frischeMeldung(urteil)}\n`);
  process.exit(1);
}
process.stdout.write(`${frischeMeldung(urteil)}\n`);
