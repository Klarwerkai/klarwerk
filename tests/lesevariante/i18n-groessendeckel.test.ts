// ================================================================================================
// JOB 3326 R4 / JOB 3364 — DER GROESSENDECKEL VON `i18n.ts` IST EIN TEST, KEINE UEBERRASCHUNG IM TOR.
// ================================================================================================
//
// WAS PASSIERT IST. Das Tor der Runde 3 von JOB 3326 war rot — nicht an einer Funktion, sondern an
// einer Zahl:
//
//     x Size of ./apps/web/src/i18n.ts is 1.0 MiB which exceeds configured maximum of 1.0 MiB
//
// Biome verarbeitet keine Datei ueber `files.maxSize` und bricht mit Exit 1 ab. Ohne Eintrag steht
// der Wert auf 1 MiB (1.048.576 B). Die Woerterbuchdatei lag am 09.09. bei 1.047.941 B — 635 B
// Vorlauf. Jeder Job, der DE/EN-Texte ergaenzt, kippte damit im Tor, nach Build und Tests, an der
// teuersten Stelle: JOB 3326 R3, und im Arbeitsbaum von JOB 3357 gemessene 1.050.970 B.
//
// WAS JOB 3364 GEAENDERT HAT, UND WAS DAS WERT IST. `files.maxSize` steht jetzt auf 2 MiB
// (2.097.152). Das ist eine WERKZEUG- UND RESSOURCENGRENZE, kein inhaltlicher Sicherheitsnachweis:
// Biomes eigener Text sagt, wozu sie da ist („to prevent us inadvertently slowing down and loading
// large files"). Sie hoeher zu setzen macht das Woerterbuch nicht besser — sie macht nur den
// Vorlauf wieder so gross, dass ein Textjob nicht mehr an der Dateigroesse scheitert. Die
// dauerhafte Antwort bleibt das Aufteilen des Woerterbuchs (Schluessel wohnen bei ihrer Funktion,
// Muster `apps/web/src/lib/lesevariante.ts`; `tests/support/i18nBestand.ts` sammelt sie trotzdem
// alle ein) und ist als eigener Auftrag verzeichnet.
//
// WAS AUSDRUECKLICH NICHT GESCHEHEN IST: keine `files.ignore`-Ausnahme fuer `i18n.ts` und keine
// Attrappe, die eine Groesse gruen rechnet. Die Datei wird von `npx biome check .` weiterhin
// vollstaendig geprueft — D4 unten misst am echten Binaerprogramm nach, dass der Deckel dabei
// wirklich greift und nicht bloss in der Konfiguration steht.
//
// WAS DIESE VIER FAELLE ZUSAGEN:
//   D1  `i18n.ts` liegt unter dem Deckel, den Biome heute tatsaechlich anwendet.
//   D2  Der Deckel steht ausdruecklich in `biome.json` und ueberschreitet 2 MiB nicht — ein
//       weiteres stilles Anheben wird hier rot, nicht erst im Tor eines fremden Jobs.
//   D3  FRUEHWARNUNG: `i18n.ts` bleibt unter 90 % des Deckels. Wer diesen Fall rot macht, hat noch
//       ueber 200 KB Luft und Zeit zum Aufteilen — statt einer Torueberraschung bei 100 %.
//   D4  Der Deckel WIRKT: in einer eigenen Buehne (Temp-Ordner, Kopie der echten `biome.json`)
//       wird derselbe Inhalt knapp ueber dem Deckel verweigert und knapp darunter wirklich
//       geprueft. Kein Produktpfad wird dafuer angefasst.
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

/** Der Standardwert von Biome, wenn `files.maxSize` nicht gesetzt ist: 1 MiB. */
const BIOME_STANDARD_MAXSIZE = 1_048_576;

/** Die Obergrenze, die JOB 3364 festhaelt: 2 MiB. Hoeher heisst aufteilen, nicht anheben. */
const HOECHSTER_ERLAUBTER_DECKEL = 2_097_152;

/** Ab diesem Fuellstand ist das Aufteilen faellig — D3 wird rot, solange noch Luft ist. */
const FRUEHWARNUNG_ANTEIL = 0.9;

const I18N = "apps/web/src/i18n.ts";

// KEIN `npx`: das Tor laeuft ohne Netz. Derselbe Binaerpfad, den `tools/lint` am Ende ausfuehrt.
const BIOME_BIN = repoPfad("node_modules/.bin/biome");

interface BiomeKonfiguration {
  files?: { maxSize?: number; ignore?: string[] };
  overrides?: Array<{ include?: string[]; ignore?: string[] }>;
}

function biomeKonfigurationRoh(): string {
  return readFileSync(repoPfad("biome.json"), "utf8");
}

function biomeKonfiguration(): BiomeKonfiguration {
  return JSON.parse(biomeKonfigurationRoh()) as BiomeKonfiguration;
}

/** Der Deckel, den Biome auf diesem Stand tatsaechlich anwendet. */
function angewandterDeckel(): number {
  return biomeKonfiguration().files?.maxSize ?? BIOME_STANDARD_MAXSIZE;
}

const buehnen: string[] = [];
afterAll(() => {
  for (const ordner of buehnen) {
    rmSync(ordner, { recursive: true, force: true });
  }
});

/**
 * Eine Datei der gewuenschten Groesse mit EINER absichtlichen Formatabweichung am Ende. Die
 * Abweichung ist der Beweis, dass Biome die Datei wirklich gelesen hat: sie taucht nur in der
 * Ausgabe auf, wenn die Datei nicht am Deckel abgewiesen wurde.
 */
function inhaltMitMakel(zielgroesse: number): string {
  const makel = "export const  makel    =   1\n";
  const grundlast = zielgroesse - Buffer.byteLength(makel);
  const teile: string[] = [];
  let bytes = 0;
  for (let i = 0; bytes < grundlast; i++) {
    const zeile = `export const w${String(i).padStart(6, "0")} = "fuellung";\n`;
    if (bytes + Buffer.byteLength(zeile) > grundlast) {
      break;
    }
    teile.push(zeile);
    bytes += Buffer.byteLength(zeile);
  }
  return `${teile.join("")}${makel}`;
}

/**
 * Legt eine Buehne mit einer KOPIE der echten `biome.json` an und laesst Biome dort ueber eine
 * einzige Datei laufen. Die Kopie ist wichtig: gemessen wird der Deckel des Produkts, nicht ein
 * fuer den Test erfundener.
 */
function pruefeInBuehne(dateiname: string, inhalt: string): { code: number | null; aus: string } {
  const wurzel = mkdtempSync(join(tmpdir(), "kw-job3364-"));
  buehnen.push(wurzel);
  writeFileSync(join(wurzel, "biome.json"), biomeKonfigurationRoh(), "utf8");
  writeFileSync(join(wurzel, dateiname), inhalt, "utf8");
  const lauf = spawnSync(BIOME_BIN, ["check", dateiname], { cwd: wurzel, encoding: "utf8" });
  return { code: lauf.status, aus: `${lauf.stdout ?? ""}${lauf.stderr ?? ""}` };
}

describe("JOB 3364 · Groessendeckel der Woerterbuchdatei", () => {
  it("D1 · i18n.ts bleibt unter dem Deckel, den Biome tatsaechlich anwendet", () => {
    const deckel = angewandterDeckel();
    const groesse = statSync(repoPfad(I18N)).size;
    // Die Meldung traegt die Zahlen, damit die naechste Bahn nicht selbst nachmessen muss. Neue
    // Schluessel gehoeren zu ihrer Funktion (Muster: apps/web/src/lib/lesevariante.ts), nicht
    // hinter einen noch einmal angehobenen Deckel.
    const meldung = `${I18N} ist ${groesse} B gross, Biome verarbeitet hoechstens ${deckel} B.`;
    expect(groesse, meldung).toBeLessThan(deckel);
  });

  it("D2 · der Deckel steht ausdruecklich in biome.json und bleibt bei hoechstens 2 MiB", () => {
    const konfiguration = biomeKonfiguration();
    // Ausdruecklich gesetzt: ein Wegfall des Eintrags faellt auf 1 MiB zurueck und wuerde jeden
    // Textjob wieder im Tor stoppen — das soll hier auffallen, nicht dort.
    expect(
      konfiguration.files?.maxSize,
      "biome.json muss files.maxSize ausdruecklich setzen (JOB 3364: 2 MiB).",
    ).toBe(HOECHSTER_ERLAUBTER_DECKEL);
    // Und nicht weiter: der naechste Schritt ist das Aufteilen des Woerterbuchs, nicht 3 MiB.
    expect(
      konfiguration.files?.maxSize ?? BIOME_STANDARD_MAXSIZE,
      "Ueber 2 MiB wird nicht angehoben — dann wird das Woerterbuch aufgeteilt.",
    ).toBeLessThanOrEqual(HOECHSTER_ERLAUBTER_DECKEL);
    // Und die Datei ist auch nicht still aus der Pruefung genommen worden.
    const ausnahmen = [
      ...(konfiguration.files?.ignore ?? []),
      ...(konfiguration.overrides ?? []).flatMap((eintrag) => eintrag.ignore ?? []),
    ];
    expect(ausnahmen.filter((muster) => muster.includes("i18n"))).toEqual([]);
  });

  it("D3 · Fruehwarnung: i18n.ts bleibt unter 90 % des Deckels", () => {
    const deckel = angewandterDeckel();
    const warnschwelle = Math.floor(deckel * FRUEHWARNUNG_ANTEIL);
    const groesse = statSync(repoPfad(I18N)).size;
    const anteil = Math.round(FRUEHWARNUNG_ANTEIL * 100);
    const meldung = `${I18N} ist ${groesse} B gross und damit ueber ${anteil} % des Deckels (${warnschwelle} B von ${deckel} B). Jetzt ist das Aufteilen des Woerterbuchs faellig — nicht das naechste Anheben des Deckels.`;
    expect(groesse, meldung).toBeLessThan(warnschwelle);
  });

  it("D4 · der Deckel wirkt am echten Biome: knapp darueber verweigert, knapp darunter geprueft", () => {
    const deckel = angewandterDeckel();
    const ABSTAND = 3_000;

    const darueber = pruefeInBuehne("ueber.ts", inhaltMitMakel(deckel + ABSTAND));
    expect(darueber.code, darueber.aus).not.toBe(0);
    expect(
      darueber.aus,
      "Biome muss die zu grosse Datei mit der maxSize-Meldung abweisen",
    ).toContain("exceeds configured maximum");
    expect(
      darueber.aus,
      "eine abgewiesene Datei kann nicht formatgeprueft worden sein",
    ).not.toContain("Formatter would have printed");

    const darunter = pruefeInBuehne("unter.ts", inhaltMitMakel(deckel - ABSTAND));
    expect(
      darunter.aus,
      "derselbe Inhalt knapp unter dem Deckel MUSS wirklich geprueft werden",
    ).toContain("Formatter would have printed");
    expect(darunter.aus, "unter dem Deckel darf keine Groessenmeldung stehen").not.toContain(
      "exceeds configured maximum",
    );
    expect(darunter.code, "die Formatabweichung macht den Lauf erwartungsgemaess rot").not.toBe(0);
  });
});
