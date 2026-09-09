// ================================================================================================
// JOB 3326 R4 — DER GROESSENDECKEL VON `i18n.ts` IST EIN TEST, KEINE UEBERRASCHUNG IM TOR.
// ================================================================================================
//
// WAS PASSIERT IST. Das Tor der Runde 3 war rot — nicht an einer Funktion, sondern an einer Zahl:
//
//     x Size of ./apps/web/src/i18n.ts is 1.0 MiB which exceeds configured maximum of 1.0 MiB
//
// Biome verarbeitet keine Datei ueber `files.maxSize` (Standard 1 MiB = 1.048.576 B) und bricht mit
// Exit 1 ab. Die Woerterbuchdatei lag auf dem Basisstand bei 1.043.344 B; die 27 Schluessel dieser
// Funktion in DE + EN + NL haben sie auf 1.049.032 B gehoben, 456 B darueber. Gemerkt hat das erst
// der volle Lauf, nach Build und Tests — die teuerste Stelle, an der so etwas auffallen kann.
//
// WARUM DIESER TEST UND NICHT EIN GROESSERER DECKEL. Ein `overrides`-Eintrag, der nur fuer
// `i18n.ts` mehr erlaubt, ist mit Biome 1.9.4 nicht baubar (`overrides` kennt kein `files`,
// gemessen). Den globalen Deckel anzuheben oder die Datei auszunehmen hiesse, den Schutz
// aufzugeben: eine Woerterbuchdatei, die niemand mehr prueft, waechst still weiter. Also bleibt der
// Deckel, die Texte der Lesevariante wohnen bei ihrer Funktion (`apps/web/src/lib/lesevariante.ts`)
// — und dieser Test sagt es der naechsten Bahn in Sekunden statt im Tor nach zehn Minuten.
//
// WAS ER NICHT BEHAUPTET: Er sagt nicht, dass `i18n.ts` klein genug BLEIBT. Er sagt, wo die Grenze
// liegt und wieviel Vorlauf heute noch da ist. Wird er rot, ist das Aufteilen des Woerterbuchs
// faellig — nicht das Anheben des Deckels.
//
// DER STAND VOM 09.09. (JOB 3326 R5, nach dem Rebase auf 1.208): Der Vorlauf, den R4 geschaffen
// hat, ist schon wieder weg. Die Datei misst 1.048.099 B — 477 B unter dem Deckel. Das Auslagern
// der 27 Schluessel dieser Funktion hat 5.688 B frei gemacht, JOB 3140 hat sie mit eigenen
// Schluesseln wieder gefuellt. Der naechste Job, der mehr als ein halbes Kilobyte Text ergaenzt,
// macht diesen Test rot — und das ist dann kein Fehler dieses Jobs, sondern die faellige
// Aufteilung des Woerterbuchs. Der Weg dafuer steht schon da: Schluessel wohnen bei ihrer Funktion
// (Muster `apps/web/src/lib/lesevariante.ts`), und `tests/support/i18nBestand.ts` sorgt dafuer,
// dass die Woerterbuch-Sammler sie trotzdem alle sehen.
import { readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

/** Der Standardwert von Biome, wenn `files.maxSize` nicht gesetzt ist: 1 MiB. */
const BIOME_STANDARD_MAXSIZE = 1_048_576;

const I18N = "apps/web/src/i18n.ts";

interface BiomeKonfiguration {
  files?: { maxSize?: number; ignore?: string[] };
  overrides?: Array<{ include?: string[]; ignore?: string[] }>;
}

function biomeKonfiguration(): BiomeKonfiguration {
  return JSON.parse(readFileSync(repoPfad("biome.json"), "utf8")) as BiomeKonfiguration;
}

describe("JOB 3326 R4 · Groessendeckel der Woerterbuchdatei", () => {
  it("i18n.ts bleibt unter dem Deckel, den Biome tatsaechlich anwendet", () => {
    const deckel = biomeKonfiguration().files?.maxSize ?? BIOME_STANDARD_MAXSIZE;
    const groesse = statSync(repoPfad(I18N)).size;
    // Die Meldung traegt die Zahlen, damit die naechste Bahn nicht selbst nachmessen muss. Neue
    // Schluessel gehoeren zu ihrer Funktion (Muster: apps/web/src/lib/lesevariante.ts), nicht
    // hinter einen angehobenen Deckel.
    const meldung = `${I18N} ist ${groesse} B gross, Biome verarbeitet hoechstens ${deckel} B.`;
    expect(groesse, meldung).toBeLessThan(deckel);
  });

  it("der 1-MiB-Schutz gilt weiter fuer alle Dateien — keine Ausnahme fuer i18n.ts", () => {
    const konfiguration = biomeKonfiguration();
    // Kein angehobener globaler Deckel: der Schutz ist der Grund, aus dem die Texte umgezogen sind.
    expect(konfiguration.files?.maxSize ?? BIOME_STANDARD_MAXSIZE).toBeLessThanOrEqual(
      BIOME_STANDARD_MAXSIZE,
    );
    // Und die Datei ist auch nicht still aus der Pruefung genommen worden.
    const ausnahmen = [
      ...(konfiguration.files?.ignore ?? []),
      ...(konfiguration.overrides ?? []).flatMap((eintrag) => eintrag.ignore ?? []),
    ];
    expect(ausnahmen.filter((muster) => muster.includes("i18n"))).toEqual([]);
  });
});
