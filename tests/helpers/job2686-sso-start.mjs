// ================================================================================================
// JOB 2686 D3 — STARTER FÜR DEN SSO-TESTSERVER
// ================================================================================================
//
// Diese Datei ist kein Test. Sie übersetzt `job2686-sso-server.ts` und startet ihn.
//
// WARUM DAS BÜNDELN HIER GESCHIEHT und nicht im Test: Der UI-Test läuft in jsdom, und jsdoms
// `TextEncoder` liefert ein `Uint8Array` aus einem anderen Realm. esbuild prüft beim Laden
// `new TextEncoder().encode("") instanceof Uint8Array` und bricht dort ab
// („Invariant violation … your JavaScript environment is broken"). In diesem Prozess — reines
// Node, kein jsdom — gilt die Prüfung.
//
// WARUM NICHT `tsx`: `tsx` legt einen Unix-Socket als IPC-Pipe an; `listen` auf einen Pipe ist in
// dieser Bahn `EPERM` (gemessen). TCP dagegen geht, deshalb läuft der Server selbst einwandfrei.
//
// Aufruf:   node tests/helpers/job2686-sso-start.mjs <szenario> <buendelpfad>
// Ausgabe:  PORT=<nummer> auf stdout (vom Server selbst)

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const [, , szenario, buendel] = process.argv;
if (!szenario || !buendel) {
  process.stderr.write("Aufruf: job2686-sso-start.mjs <szenario> <buendelpfad>\n");
  process.exit(2);
}

const hier = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [join(hier, "job2686-sso-server.ts")],
  bundle: true,
  platform: "node",
  // CJS, nicht ESM: fastify und avvio rufen `require("node:events")` zur Laufzeit auf; in einem
  // ESM-Bündel ersetzt esbuild `require` durch einen Werfer. Vollständig gebündelt, weil der
  // Bündel ausserhalb des Klons liegt und dort kein `node_modules` steht.
  format: "cjs",
  outfile: buendel,
  logLevel: "silent",
});

// Der Server nimmt sein Szenario aus argv[2] — hier neu gesetzt, weil der Bündel als eigenes
// Programm läuft.
process.argv = [process.argv[0], buendel, szenario];
createRequire(import.meta.url)(buendel);
