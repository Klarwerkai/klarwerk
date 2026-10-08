// ==================================================================================================
// aufnahme:20260922:gesamt-kundenbetrieb (R-1487, K2) — DAS PAKET NENNT SEINE PRÜFSUMME SELBST.
// ==================================================================================================
//
// Bis hierher meldete der Bauer Pfad und Größe des Pakets, aber keine Prüfsumme. Wer ein Paket
// weiterreichte, konnte nicht sagen, ob es dasselbe ist, das der Bauer aus seinem Commit erzeugt hat.
// Jetzt schreibt der Bauer neben `<version>.zip` die Datei `<version>.zip.sha256` und meldet denselben
// Wert in seiner JSON-Ausgabe.
//
// DAS FORMAT IST DAS VON `shasum -a 256` — 64 Hexzeichen, ZWEI Leerzeichen, der Dateiname ohne Pfad —
// dasselbe, das `scripts/backup/backup.sh` für seine Sicherungen schreibt. Damit prüft der Empfänger
// mit `shasum -a 256 -c <version>.zip.sha256` im Paketordner, ohne ein eigenes Werkzeug.
//
// GRENZE, ausdrücklich: Eine Prüfsumme belegt Unversehrtheit gegenüber dem Bauer, nicht Herkunft.
// Wer Paket und Prüfsumme gemeinsam austauscht, fällt damit nicht auf. Die Echtheitsfrage bleibt
// in `docs/operations/insel-hausbetrieb-anforderungen.md` H3 offen; der Updateweg prüft diese
// Datei heute nicht.
import { createHash } from "node:crypto";
import { closeSync, openSync, readSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const BLOCK = 1024 * 1024;

/** SHA-256 einer Datei in Blöcken — ein Paket mit `node_modules` passt nicht sicher in einen Puffer. */
export function sha256Datei(pfad) {
  const hash = createHash("sha256");
  const puffer = Buffer.alloc(BLOCK);
  const fd = openSync(pfad, "r");
  try {
    for (;;) {
      const gelesen = readSync(fd, puffer, 0, BLOCK, null);
      if (gelesen === 0) break;
      hash.update(puffer.subarray(0, gelesen));
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** Die eine Zeile im `shasum -a 256`-Format. */
export function pruefsummenZeile(hex, dateiname) {
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    throw new Error(`Prüfsumme ungültig: „${hex}" ist kein SHA-256 in Kleinbuchstaben-Hex.`);
  }
  if (dateiname.length === 0 || dateiname !== basename(dateiname)) {
    throw new Error(`Prüfsumme: „${dateiname}" ist kein Dateiname ohne Pfad.`);
  }
  return `${hex}  ${dateiname}\n`;
}

/** Der Pfad der Prüfsummendatei neben dem Paket. */
export function pruefsummenPfad(paketPfad) {
  return `${paketPfad}.sha256`;
}

/** Berechnet die Prüfsumme des Pakets und schreibt sie daneben. */
export function schreibePaketPruefsumme(paketPfad) {
  const sha256 = sha256Datei(paketPfad);
  const datei = pruefsummenPfad(paketPfad);
  writeFileSync(datei, pruefsummenZeile(sha256, basename(paketPfad)), "utf8");
  return { sha256, datei };
}
