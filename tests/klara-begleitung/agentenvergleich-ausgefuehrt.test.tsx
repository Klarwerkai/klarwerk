// @vitest-environment jsdom
// ================================================================================================
// BPA-05 · K10 — BEIDE RECHERCHEWEGE WIRKLICH AUSGEFÜHRT, JEDE HANDLUNG PROTOKOLLIERT.
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): `agentenvergleich.test.ts` RECHNET den bisherigen Weg aus Fehlerzahl
// und angenommenen Handlungskosten. Das bleibt als offener Modellvergleich stehen. Dieser Fall
// FÜHRT stattdessen beide Wege aus — am ausgelieferten Prüfformular (`/begleitung/pruefformular`)
// in der echten Hülle, mit derselben synthetischen Recherche:
//
//   ohne Begleitung: Felder ausfüllen → „Angaben prüfen" → gemeldete Felder korrigieren → prüfen
//   mit Begleitung : Auftrag tippen + starten → Felder ausfüllen, auf einen Hinweis sofort
//                    korrigieren → „Angaben prüfen" → Rest korrigieren → prüfen
//
// Gezählt wird, was der Agent TUT (jede Eingabe, jeder Klick ein Protokolleintrag) und was die
// Oberfläche ZEIGT (jeder neu erschienene Hinweis eine Unterbrechung; ein Hinweis auf ein Feld,
// das laut Recherche keine Einheit braucht, ein Fehlhinweis). Nichts davon ist vorgegeben.
//
// Das Ergebnis ist nicht geschönt: Die Hinweisruhe (2 Minuten) lässt in einer schnellen Recherche
// nur EINEN Hinweis zu; der zweite Fehler fällt wie bisher erst der Prüfung auf. Mit Einrichtung
// und Unterbrechung ist die Entlastung hier NEGATIV — und steht so im Bericht.
//
// GRENZE: ein geskripteter Agent in jsdom, keine Menschenstudie und keine Zeitmessung (O07).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  bis,
  klick,
  medienStub,
  mutationen,
  netz,
  netzStub,
  q,
  tippe,
  warte,
} from "../fe003-tutorial-fragen/huelle";
import { type Produkt, knopfMitText, montiereProdukt, pfFeld } from "./produkt";

/** Die synthetische Recherche: was der Agent einträgt, und ob dort WIRKLICH eine Einheit fehlt. */
const RECHERCHE: readonly { feld: string; wert: string; richtig: string }[] = [
  { feld: "hersteller", wert: "Muster GmbH", richtig: "Muster GmbH" },
  { feld: "leistung", wert: "250", richtig: "250 W" },
  { feld: "spannung", wert: "230 V", richtig: "230 V" },
  { feld: "strom", wert: "12", richtig: "12 A" },
  { feld: "wirkungsgrad", wert: "92 %", richtig: "92 %" },
  { feld: "anschluesse", wert: "4", richtig: "4" },
];
/** Lesezeit des Agenten nach jedem Feld — länger als die Tipppause der Begleitung (1,5 s). */
const LESEZEIT_MS = 1700;

type Art = "einrichtung" | "eingabe" | "pruefung" | "korrektur" | "verwerfen";

interface Eintrag {
  readonly art: Art;
  readonly ziel: string;
}

interface Bericht {
  readonly variante: "ohne" | "mit";
  readonly protokoll: readonly Eintrag[];
  readonly einrichtung: number;
  readonly eingaben: number;
  readonly pruefungen: number;
  readonly unterbrechungen: number;
  readonly fehlhinweise: number;
  readonly korrekturaufwand: number;
  readonly handlungen: number;
  readonly vollstaendig: boolean;
}

let p: Produkt | null = null;

function zaehle(protokoll: readonly Eintrag[], art: Art): number {
  return protokoll.filter((e) => e.art === art).length;
}

function bericht(
  variante: "ohne" | "mit",
  protokoll: readonly Eintrag[],
  unterbrechungen: number,
  fehlhinweise: number,
): Bericht {
  return {
    variante,
    protokoll,
    einrichtung: zaehle(protokoll, "einrichtung"),
    eingaben: zaehle(protokoll, "eingabe"),
    pruefungen: zaehle(protokoll, "pruefung"),
    unterbrechungen,
    fehlhinweise,
    korrekturaufwand: zaehle(protokoll, "korrektur") + zaehle(protokoll, "verwerfen"),
    handlungen: protokoll.length,
    vollstaendig: q(document, "pruefformular-vollstaendig") !== null,
  };
}

/** Nach „Angaben prüfen": jedes gemeldete Feld korrigieren und erneut prüfen, bis alles passt. */
async function spaetePruefung(protokoll: Eintrag[]): Promise<void> {
  protokoll.push({ art: "pruefung", ziel: "pruefen" });
  await klick(q(document, "pruefformular-pruefen"));
  for (let runde = 0; runde < 3 && q(document, "pruefformular-befunde"); runde += 1) {
    for (const r of RECHERCHE) {
      if (q(document, `pruefformular-befund-${r.feld}`)) {
        protokoll.push({ art: "korrektur", ziel: r.feld });
        await tippe(pfFeld(r.feld), r.richtig);
      }
    }
    protokoll.push({ art: "korrektur", ziel: "pruefen" });
    await klick(q(document, "pruefformular-pruefen"));
  }
}

async function ohneBegleitung(): Promise<Bericht> {
  const protokoll: Eintrag[] = [];
  for (const r of RECHERCHE) {
    protokoll.push({ art: "eingabe", ziel: r.feld });
    await tippe(pfFeld(r.feld), r.wert);
    await warte(LESEZEIT_MS);
  }
  expect(q(document, "begleitung-hinweis")).toBeNull();
  await spaetePruefung(protokoll);
  return bericht("ohne", protokoll, 0, 0);
}

async function mitBegleitung(): Promise<Bericht> {
  const protokoll: Eintrag[] = [];
  let unterbrechungen = 0;
  let fehlhinweise = 0;
  let gesehen: string | null = null;

  protokoll.push({ art: "einrichtung", ziel: "auftrag" });
  const auftrag = q<HTMLInputElement>(document, "begleitung-auftrag") as HTMLInputElement;
  await tippe(auftrag, "Datenblattrecherche, 30 Minuten");
  protokoll.push({ art: "einrichtung", ziel: "starten" });
  await klick(knopfMitText("Begleitung starten"));
  expect(q(document, "begleitung-zustand")?.textContent).toMatch(/^Begleiten · /);

  /** Was die Leiste gerade zeigt — und wie der Agent darauf reagiert. */
  const aufHinweisReagieren = async (): Promise<void> => {
    const hinweis = q(document, "begleitung-hinweis")?.textContent ?? null;
    if (hinweis === null || hinweis === gesehen) {
      return;
    }
    gesehen = hinweis;
    unterbrechungen += 1;
    const betroffen = RECHERCHE.find((r) => hinweis.includes(`„${feldName(r.feld)}“`));
    if (betroffen && betroffen.wert !== betroffen.richtig) {
      protokoll.push({ art: "korrektur", ziel: betroffen.feld });
      await tippe(pfFeld(betroffen.feld), betroffen.richtig);
      await warte(LESEZEIT_MS);
    } else {
      fehlhinweise += 1;
      protokoll.push({ art: "verwerfen", ziel: betroffen?.feld ?? "unbekannt" });
      await klick(knopfMitText("Hinweis verwerfen"));
    }
  };

  for (const r of RECHERCHE) {
    protokoll.push({ art: "eingabe", ziel: r.feld });
    await tippe(pfFeld(r.feld), r.wert);
    await warte(LESEZEIT_MS);
    await aufHinweisReagieren();
  }
  await spaetePruefung(protokoll);
  return bericht("mit", protokoll, unterbrechungen, fehlhinweise);
}

function feldName(feld: string): string {
  return document.querySelector(`label[for="pf-${feld}"]`)?.textContent ?? feld;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  sessionStorage.clear();
  netz.anfragen = [];
  netz.lage = { kiAktiv: false, rolle: "experte" };
  vi.stubGlobal("fetch", vi.fn(netzStub));
  medienStub();
});

afterEach(() => {
  p?.abbauen();
  p = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("K10 · dieselbe synthetische Recherche, beide Wege ausgeführt und gemessen", () => {
  it("ohne und mit Begleitung: Protokoll, Unterbrechungen, Fehlhinweise, Korrekturaufwand — negative Entlastung bleibt sichtbar", async () => {
    p = await montiereProdukt("/begleitung/pruefformular");
    await bis(() => q(document, "begleitung-angebot") !== null, 120);
    const ohne = await ohneBegleitung();
    p.abbauen();
    document.body.innerHTML = "";
    sessionStorage.clear();

    p = await montiereProdukt("/begleitung/pruefformular");
    await bis(() => q(document, "begleitung-angebot") !== null, 120);
    const vorher = netz.anfragen.length;
    const mit = await mitBegleitung();
    expect(mutationen(vorher)).toEqual([]);

    const eingabenOhne = ohne.eingaben + ohne.korrekturaufwand;
    const eingabenMit = mit.einrichtung + mit.eingaben + mit.korrekturaufwand;
    const ersparteEingaben = eingabenOhne - eingabenMit;
    const entlastung = ohne.handlungen - (mit.handlungen + mit.unterbrechungen);
    // Der Bericht steht im Testprotokoll — Zahlen aus der Ausführung, nicht aus einer Formel.
    console.info(
      "BPA-05 K10 Agentenvergleich",
      JSON.stringify({ ohne, mit, ersparteEingaben, entlastung }),
    );

    // Beide Wege sind zu Ende gegangen: am Schluss trägt jede technische Angabe eine Einheit.
    expect(ohne.vollstaendig).toBe(true);
    expect(mit.vollstaendig).toBe(true);
    // Was gemessen wurde (Sollwerte dieser synthetischen Recherche, nicht geschätzt):
    expect(ohne).toMatchObject({
      einrichtung: 0,
      eingaben: 6,
      pruefungen: 1,
      unterbrechungen: 0,
      fehlhinweise: 0,
      korrekturaufwand: 3,
      handlungen: 10,
    });
    expect(mit).toMatchObject({
      einrichtung: 2,
      eingaben: 6,
      pruefungen: 1,
      unterbrechungen: 1,
      fehlhinweise: 0,
      korrekturaufwand: 3,
      handlungen: 12,
    });
    expect(mit.protokoll).toContainEqual({ art: "korrektur", ziel: "leistung" });
    expect(ersparteEingaben).toBe(-2);
    expect(entlastung).toBe(-3);
  });
});
