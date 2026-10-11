#!/usr/bin/env node
// ==================================================================================================
// R-0779 (aufnahme:20260922:gesamt-kundenbetrieb) — DER STARTER BESTÄTIGT DIE LAUFENDE VERSION.
// ==================================================================================================
//
// Bis hierher meldeten beide Doppelklick-Starter (`klarwerk-lokal-starten.command`, Schreibtisch-App)
// die Nummer aus `apps/web/src/version.ts` — also die Fassung, die im QUELLORDNER liegt. Ob der
// gestartete Server dieselbe Fassung fährt, hat niemand gefragt: `/health` wurde nur auf
// `"status":"ok"` geprüft. Ein alter Prozess auf demselben Port hätte genauso „ok" gesagt.
//
// Dieser Baustein fragt die LAUFENDE Instanz (`GET /health` → `version`, `commit`) und vergleicht mit
// dem erwarteten Stand. Ausgabe auf stdout: genau eine Zeile mit der laufenden Version (für den
// Starter); die Erklärung auf stderr. Exitcodes:
//   0  laufende Version == erwartete Version (oder keine Erwartung übergeben)
//   2  keine Auskunft: Server nicht erreichbar, keine JSON-Antwort, kein `status: ok` oder keine Version
//   3  ABWEICHUNG: der Server fährt eine andere Version als erwartet
//
// Aufruf: node scripts/local/laufende-version.mjs <health-url> [<erwartete-version>]
import { pathToFileURL } from "node:url";

export const GLEICH = 0;
export const KEINE_AUSKUNFT = 2;
export const ABWEICHUNG = 3;

/**
 * Fragt `/health` und vergleicht. Wirft nie; jedes Ergebnis ist ein benannter Ausgang.
 * @param {{ url: string, erwartet?: string, zeitMs?: number, fetchImpl?: typeof fetch }} o
 */
export async function bestaetigeLaufendeVersion({ url, erwartet, zeitMs = 3000, fetchImpl = fetch }) {
  let rumpf;
  try {
    const antwort = await fetchImpl(url, { signal: AbortSignal.timeout(zeitMs) });
    if (!antwort.ok) {
      return { code: KEINE_AUSKUNFT, laufend: null, commit: null, grund: `HTTP ${antwort.status}` };
    }
    rumpf = await antwort.json();
  } catch (fehler) {
    const grund = fehler instanceof Error ? fehler.message : String(fehler);
    return { code: KEINE_AUSKUNFT, laufend: null, commit: null, grund: `nicht erreichbar: ${grund}` };
  }
  const laufend = typeof rumpf?.version === "string" && rumpf.version.trim() ? rumpf.version.trim() : null;
  const commit = typeof rumpf?.commit === "string" ? rumpf.commit : null;
  if (rumpf?.status !== "ok" || laufend === null) {
    return { code: KEINE_AUSKUNFT, laufend, commit, grund: "Antwort ohne status ok oder ohne Version" };
  }
  const soll = (erwartet ?? "").trim();
  if (soll && soll !== laufend) {
    return { code: ABWEICHUNG, laufend, commit, grund: `erwartet ${soll}, laufend ${laufend}` };
  }
  return { code: GLEICH, laufend, commit, grund: soll ? "bestätigt" : "ohne Erwartung" };
}

const direktAufgerufen =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (direktAufgerufen) {
  const [url, erwartet] = process.argv.slice(2);
  if (!url) {
    process.stderr.write("Aufruf: laufende-version.mjs <health-url> [<erwartete-version>]\n");
    process.exit(KEINE_AUSKUNFT);
  }
  const ergebnis = await bestaetigeLaufendeVersion({ url, erwartet });
  if (ergebnis.laufend) process.stdout.write(`${ergebnis.laufend}\n`);
  const commit = ergebnis.commit ? ` (Commit ${ergebnis.commit})` : "";
  process.stderr.write(`[laufende-version] ${ergebnis.grund}${commit}\n`);
  process.exit(ergebnis.code);
}
