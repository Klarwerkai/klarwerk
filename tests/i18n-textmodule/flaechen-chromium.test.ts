// ================================================================================================
// JOB 4367 · K1 IM BROWSER — die GEBAUTE App zeigt dieselben Texte wie vor dem Umbau.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BEN, Runde 2, Korrekturpflicht 3). Der Bestandsabgleich in
// `bestand-unveraendert.test.ts` misst das Wörterbuch, wie i18next es hält. Das ist die richtige
// Fläche für „kein Text hat sich geändert" — aber es ist NICHT die Fläche, die ein Mensch sieht.
// Zwischen dem Wörterbuch und dem Bildschirm liegen der Bündler, der Sammler und die Bauteile.
// Diese Datei schliesst die Lücke: sie öffnet die GEBAUTE App (`apps/web/dist`) in Chromium und
// liest an benannten Elementen ab, was wirklich dasteht.
//
// DIE DREI FLÄCHEN sind die, die der Auftrag in K1 nennt: Start, Bibliothek, Einstellungen.
//
// WAS GEMESSEN WIRD, und warum das keine Selbstbestätigung ist: Verglichen wird der GELESENE Text
// eines Elements mit dem Wert, den sein Schlüssel AM BASISSTAND hatte (`werte-vorher.json`). Nicht
// „steht dieser String irgendwo" — dann fände der Test immer, wonach er sucht. Sondern: dieses
// Element hier trägt genau den Text von damals. Verschöbe der Umbau einen Wert, stünde am selben
// Element etwas anderes, und der Fall wird rot mit Soll und Ist.
//
// WELCHE ELEMENTE, und woher ihr Schlüssel bekannt ist: die Punkte des Kopfbands. Ihr Anzeigename
// hat seit JOB 3105 genau eine Quelle (`apps/web/src/app/navigation.ts`, `anzeigeNameKey`) — für
// drei Punkte weicht er vom Seitentitel ab, und diese Abweichung steht dort in `ANZEIGE_NAME_KEY`.
// Die Zuordnung unten ist von dort abgelesen, nicht geraten. Das Kopfband steht auf allen drei
// Flächen; dieselben sechs Punkte werden deshalb dreimal gemessen, je Fläche einmal.
//
// SICHTBAR HEISST SICHTBAR (Lehre 9 des Bahnprompts). Geprüft wird nicht die Anwesenheit im DOM:
// gelesen wird `innerText` des Elements, und zusätzlich müssen `display`, `visibility`, `opacity`
// und ein Kasten mit Fläche stimmen. Kalibriert wird jede Zusage, indem GENAU DIESES Element
// ausgeblendet wird — derselbe unveränderte Prüfschritt muss daran scheitern und den Punkt
// benennen; nach der Rücknahme ist er wieder grün.
//
// WAS DIESE DATEI NICHT LEISTET, ausdrücklich: den Nachweis, dass ein NEU HINZUGELEGTES Modul in
// der gebauten App sichtbar wird. Dafür müsste ein Probemodul mitgebaut werden, und ein Probemodul
// im Produkt wäre ausgelieferter Blindtext. Dieser Nachweis ist mit einem echten `./tools/build`
// als Gegenprobe der Runde gemessen und steht in der RUECKGABE.
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { type Stand, beende, fn, starte, wechsle } from "../design/h6-chromium";
import { repoPfad } from "../support/repoPfad";
import { schliesseChromium } from "../tor-bereitschaft/chromium-abbau";

const werte = JSON.parse(
  readFileSync(repoPfad("tests/i18n-textmodule/werte-vorher.json"), "utf8"),
) as Record<string, Record<string, string>>;

/**
 * Kopfbandpunkt → Textschlüssel, abgelesen aus `apps/web/src/app/navigation.ts` — nicht geraten:
 * die sechs Punkte stehen dort in `KOPFBAND_IDS` (JOB 3060, seit JOB 3503 sechs), ihr `labelKey`
 * am jeweiligen Gruppenpunkt, und für „Erfassen" und „Prüfen" überschreibt `ANZEIGE_NAME_KEY` ihn.
 *
 * `/admin` steht hier ABSICHTLICH nicht: „Einstellungen" ist kein Kopfbandpunkt, sondern eine
 * Zeile im Zahnrad-Menü (`navigation.ts:424-426`). Die FLÄCHE Einstellungen wird trotzdem
 * gemessen — die sechs Punkte werden auch dort abgelesen, denn das Kopfband steht auf jeder Seite.
 */
const PUNKTE: ReadonlyArray<{ id: string; schluessel: string }> = [
  { id: "start", schluessel: "nav.start" },
  { id: "fragen", schluessel: "nav.ask" },
  { id: "bibliothek", schluessel: "nav.library" },
  { id: "erfassen", schluessel: "kopfband.erfassen" },
  { id: "entwuerfe", schluessel: "mob.drafts" },
  { id: "validierung", schluessel: "kopfband.pruefen" },
];

/** Die drei Flächen aus K1, je mit dem Anker, der beweist, dass die Seite wirklich steht. */
const FLAECHEN: ReadonlyArray<{ name: string; pfad: string; anker: string }> = [
  { name: "Start", pfad: "/start", anker: "main" },
  { name: "Bibliothek", pfad: "/bibliothek", anker: "main" },
  { name: "Einstellungen", pfad: "/admin", anker: '[data-einst="seite"]' },
];

interface Ablesung {
  readonly id: string;
  readonly gefunden: number;
  readonly text: string | null;
  readonly sichtbar: boolean;
}

/**
 * Liest je Kopfbandpunkt den SICHTBAREN Text seiner Beschriftung.
 *
 * GELESEN WIRD DAS BESCHRIFTUNGS-`<span>`, nicht der ganze Link: der Link trägt daneben den Zähler
 * (`KopfbandPunkte.tsx:148-155`), und der gehört keinem Textschlüssel dieses Vergleichs. Wer den
 * Link als Ganzes läse, vergliche bei gefülltem Prüfboard „Prüfen 3" mit „Prüfen" und wäre rot,
 * ohne dass ein Text falsch wäre.
 *
 * `innerText` statt `textContent`: es gibt wieder, was gerendert ist. Die Stilabfrage daneben
 * fängt die Fälle, in denen `innerText` trotzdem etwas liefert (ein Element mit `opacity: 0` oder
 * ohne Fläche steht im Layout, ist aber nicht zu sehen).
 */
const ABLESEN = `(ids) => ids.map((id) => {
  const treffer = Array.from(document.querySelectorAll('header [data-kopfband-punkt="' + id + '"] span'));
  const el = treffer[0];
  if (!el) { return { id, gefunden: treffer.length, text: null, sichtbar: false }; }
  const s = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const sichtbar = s.display !== 'none' && s.visibility !== 'hidden' && Number(s.opacity) > 0
    && r.width > 0 && r.height > 0;
  return { id, gefunden: treffer.length, text: (el.innerText || '').trim(), sichtbar };
})`;

/** Blendet GENAU die Beschriftung EINES Punktes aus — die Kalibrierung, sonst nichts an der Fläche. */
const VERDECKEN = `(id) => {
  const el = document.querySelector('header [data-kopfband-punkt="' + id + '"] span');
  if (!el) { return false; }
  el.setAttribute('data-kw4367-verdeckt', '1');
  el.style.display = 'none';
  return true;
}`;

const AUFDECKEN = `() => {
  const el = document.querySelector('[data-kw4367-verdeckt]');
  if (!el) { return false; }
  el.style.display = '';
  el.removeAttribute('data-kw4367-verdeckt');
  return true;
}`;

function soll(schluessel: string): string {
  const wert = werte.de?.[schluessel];
  if (typeof wert !== "string") {
    throw new Error(`werte-vorher.json kennt "${schluessel}" nicht — Zuordnung veraltet?`);
  }
  return wert;
}

/** Die eine Zusage, an einer Ablesung gemessen. Getrennt, damit die Kalibrierung SIE ruft. */
function pruefe(flaeche: string, ablesungen: readonly Ablesung[]): void {
  for (const punkt of PUNKTE) {
    const ablesung = ablesungen.find((a) => a.id === punkt.id);
    const erwartet = soll(punkt.schluessel);
    expect(ablesung, `${flaeche}: kein Kopfbandpunkt "${punkt.id}" abgelesen`).toBeDefined();
    expect(
      ablesung?.sichtbar,
      `${flaeche}: der Kopfbandpunkt "${punkt.id}" ("${erwartet}", Schlüssel ${punkt.schluessel}) ist nicht SICHTBAR (gefunden: ${ablesung?.gefunden ?? 0})`,
    ).toBe(true);
    expect(
      ablesung?.text,
      `${flaeche}: der Kopfbandpunkt "${punkt.id}" trägt einen anderen Text als am Basisstand — Schlüssel ${punkt.schluessel}`,
    ).toBe(erwartet);
  }
}

describe("JOB 4367 · die gebaute App zeigt die Texte des Basisstands", () => {
  let stand: Stand | null = null;

  afterAll(async () => {
    if (stand) {
      await beende(stand);
      await schliesseChromium("tests/i18n-textmodule/flaechen-chromium.test.ts", stand.browser);
    }
  });

  it("B1 · Start, Bibliothek und Einstellungen tragen dieselben Kopfbandtexte wie vor dem Umbau", async () => {
    stand = await starte(FLAECHEN[0]?.pfad ?? "/start", FLAECHEN[0]?.anker ?? "main", 1440, 900);
    const seite = stand.seite;
    // Ohne gebautes `apps/web/dist` gibt es hier nichts zu messen — die Bühne sagt das selbst.
    // Im Tor läuft `./tools/build` davor, ein Einzelaufruf ohne Build kann diesen Fall nicht fahren.
    expect(
      seite,
      `die Bühne hat keine Seite geliefert — ${stand.fehler ?? "ohne Grund"}`,
    ).not.toBeNull();
    if (!seite) {
      return;
    }
    const ids = PUNKTE.map((p) => p.id);
    for (const flaeche of FLAECHEN) {
      await wechsle(stand, flaeche.pfad, flaeche.anker);
      const ablesungen = await seite.evaluate<Ablesung[]>(fn(ABLESEN), ids);
      process.stdout.write(
        `JOB 4367 · ${flaeche.name} (${flaeche.pfad}) · ${JSON.stringify(ablesungen)}\n`,
      );
      pruefe(flaeche.name, ablesungen);
    }
    expect(stand.seitenfehler, "die Seite hat einen Fehler geworfen").toEqual([]);
  }, 120_000);

  it("B2 · KALIBRIERUNG: wird genau ein Punkt ausgeblendet, scheitert B1 an ihm — und nur an ihm", async () => {
    expect(stand, "B1 muss vorher gelaufen sein").not.toBeNull();
    const seite = stand?.seite;
    if (!stand || !seite) {
      return;
    }
    await wechsle(stand, "/start", "main");
    const ids = PUNKTE.map((p) => p.id);

    const verdeckt = await seite.evaluate<boolean>(fn(VERDECKEN), "bibliothek");
    expect(verdeckt, 'die Beschriftung des Punktes "bibliothek" war nicht zum Ausblenden da').toBe(
      true,
    );
    const nachher = await seite.evaluate<Ablesung[]>(fn(ABLESEN), ids);
    process.stdout.write(`JOB 4367 · KALIBRIERUNG verdeckt · ${JSON.stringify(nachher)}\n`);
    // Derselbe unveränderte Prüfschritt muss jetzt scheitern — und der Text der Meldung muss den
    // Punkt benennen, sonst wüsste eine Bahn nicht, welches Feld fehlt.
    expect(() => pruefe("Start", nachher)).toThrow(/bibliothek/);

    const aufgedeckt = await seite.evaluate<boolean>(fn(AUFDECKEN), null);
    expect(aufgedeckt, "die Verdeckung liess sich nicht zurücknehmen").toBe(true);
    const zurueck = await seite.evaluate<Ablesung[]>(fn(ABLESEN), ids);
    pruefe("Start", zurueck);
  }, 120_000);
});
