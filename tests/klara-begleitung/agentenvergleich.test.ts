// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — K10: Agentenvergleich derselben synthetischen Recherche.
// ================================================================================================
//
// Originalkriterium K10: „Im Agentenvergleich für dieselbe synthetische Recherche werden
// Unterbrechungen, ersparte Eingaben, Fehlhinweise und Korrekturaufwand gemessen; negative
// Entlastung bleibt sichtbar."
//
// WAS DAS IST — UND WAS NICHT. Ein geskripteter Agent erfasst dieselben Datenblattangaben zweimal:
// einmal ohne Begleitung, einmal mit dem ECHTEN Kern (`kern.ts`: Start, Lesen, Dosierung,
// Verwerfen). Gezählt werden Handlungen, nicht Sekunden. Das ist eine Agentenprobe, keine
// Menschenstudie; sie behauptet keine Erfolgsquote und keine Zeitersparnis für Menschen (O07).
//
// DIE ANNAHMEN DES SKRIPTS, offen statt versteckt:
//   · Ohne Begleitung fällt eine fehlende Einheit erst bei der späteren Prüfung auf; die Korrektur
//     kostet dann RUECKFRAGE + WIEDER_OEFFNEN + AENDERN = 3 Handlungen.
//   · Mit Begleitung kostet das Einrichten 2 Handlungen (Satz + Start), jeder gezeigte Hinweis
//     1 Unterbrechung, eine Korrektur direkt im Feld 1 Handlung, ein Fehlhinweis 1 Verwerfen.
// Ändert jemand diese Annahmen, ändern sich die Zahlen — darum stehen sie hier und im Bericht.
import { describe, expect, it } from "vitest";
import {
  type Begleitung,
  type Feld,
  beschaeftigt,
  leseAuftrag,
  naechsterHinweis,
  nimmKontext,
  starte,
  verwirf,
} from "../../apps/web/src/components/klara-begleitung/kern";

const T0 = Date.parse("2026-10-11T10:00:00+02:00");
const SPAETE_KORREKTUR = 3;
const EINRICHTEN = 2;

/** Ein Eintrag der Recherche: was der Agent tippt, und ob dort WIRKLICH eine Einheit fehlt. */
interface Schritt {
  readonly feld: Feld;
  readonly einheitFehltWirklich: boolean;
  /** Was nach einer Korrektur im Feld steht. */
  readonly korrigiert?: string;
}

interface Bericht {
  readonly variante: "ohne" | "mit";
  readonly eingaben: number;
  readonly unterbrechungen: number;
  readonly fehlhinweise: number;
  readonly korrekturaufwand: number;
  readonly unentdeckt: number;
}

interface Vergleich {
  readonly ohne: Bericht;
  readonly mit: Bericht;
  readonly ersparteEingaben: number;
  /** Aufwand ohne minus Aufwand mit. Negativ heißt: die Begleitung hat mehr gekostet. */
  readonly entlastung: number;
}

function feld(name: string, wert: string, einheitErwartet: boolean): Feld {
  return { name, bezeichnung: name, wert, ...(einheitErwartet ? { einheitErwartet } : {}) };
}

function ohneBegleitung(schritte: readonly Schritt[]): Bericht {
  const fehler = schritte.filter((s) => s.einheitFehltWirklich).length;
  return {
    variante: "ohne",
    eingaben: schritte.length,
    unterbrechungen: 0,
    fehlhinweise: 0,
    korrekturaufwand: fehler * SPAETE_KORREKTUR,
    unentdeckt: 0,
  };
}

function mitBegleitung(schritte: readonly Schritt[]): Bericht {
  const r = starte(
    leseAuftrag("Begleite mich 60 Minuten bei der Datenblattrecherche"),
    { art: "vorgang", kennung: "datenblatt", bezeichnung: "Datenblatt" },
    { konto: "agent", jetzt: T0, id: "vergleich" },
    { ruheMs: 0 },
  );
  if (!r.ok) {
    throw new Error(r.fehler);
  }
  let b: Begleitung = r.begleitung;
  let zeit = T0;
  const stand = new Map<string, Feld>();
  let unterbrechungen = 0;
  let fehlhinweise = 0;
  let korrekturaufwand = 0;
  const lesen = (): void => {
    const ereignis = {
      quelle: { art: "vorgang" as const, kennung: "datenblatt" },
      konto: "agent",
      felder: [...stand.values()],
    };
    b = nimmKontext(b, ereignis, { konto: "agent", darfBegleiten: true, jetzt: zeit }).begleitung;
  };
  for (const s of schritte) {
    zeit += 10_000;
    stand.set(s.feld.name, s.feld);
    b = beschaeftigt(b, zeit + 1500);
    lesen();
    // Während der Tipppause nie ein Hinweis; danach höchstens einer je Situation.
    expect(naechsterHinweis(b, zeit + 1000).hinweis).toBeNull();
    zeit += 2000;
    lesen();
    b = naechsterHinweis(b, zeit);
    while (b.hinweis) {
      unterbrechungen += 1;
      const betroffen = schritte.find((x) => x.feld.name === b.hinweis?.feld);
      if (betroffen?.einheitFehltWirklich && betroffen.korrigiert) {
        korrekturaufwand += 1;
        stand.set(betroffen.feld.name, { ...betroffen.feld, wert: betroffen.korrigiert });
        b = verwirf(b);
      } else {
        fehlhinweise += 1;
        b = verwirf(b);
      }
      lesen();
      b = naechsterHinweis(b, zeit);
    }
  }
  // Dieselbe Seite bleibt noch eine Weile offen — wiederholt die Begleitung etwas?
  for (let i = 0; i < 30; i += 1) {
    zeit += 60_000;
    lesen();
    b = naechsterHinweis(b, zeit);
    if (b.hinweis) {
      unterbrechungen += 1;
      fehlhinweise += 1;
      b = verwirf(b);
    }
  }
  const unentdeckt = schritte.filter(
    (s) => s.einheitFehltWirklich && stand.get(s.feld.name)?.wert === s.feld.wert,
  ).length;
  return {
    variante: "mit",
    eingaben: EINRICHTEN + schritte.length,
    unterbrechungen,
    fehlhinweise,
    korrekturaufwand: korrekturaufwand + unentdeckt * SPAETE_KORREKTUR,
    unentdeckt,
  };
}

function vergleiche(schritte: readonly Schritt[]): Vergleich {
  const ohne = ohneBegleitung(schritte);
  const mit = mitBegleitung(schritte);
  const aufwand = (x: Bericht): number =>
    x.eingaben + x.korrekturaufwand + x.unterbrechungen + x.fehlhinweise;
  return {
    ohne,
    mit,
    ersparteEingaben: ohne.eingaben + ohne.korrekturaufwand - (mit.eingaben + mit.korrekturaufwand),
    entlastung: aufwand(ohne) - aufwand(mit),
  };
}

// Dieselbe synthetische Recherche: Datenblatt eines Netzteils. Keine echten Daten.
const LEISTUNG_OHNE_EINHEIT: Schritt = {
  feld: feld("Leistung", "250", true),
  einheitFehltWirklich: true,
  korrigiert: "250 W",
};
const STROM_OHNE_EINHEIT: Schritt = {
  feld: feld("Ausgangsstrom", "12", true),
  einheitFehltWirklich: true,
  korrigiert: "12 A",
};
const SPANNUNG_MIT_EINHEIT: Schritt = {
  feld: feld("Spannung", "230 V", true),
  einheitFehltWirklich: false,
};
const HERSTELLER: Schritt = {
  feld: feld("Hersteller", "Muster GmbH", false),
  einheitFehltWirklich: false,
};
// Falsch eingerichtet: „Anschlüsse" ist als Einheitenfeld markiert, braucht aber keine Einheit.
const ANSCHLUESSE_FALSCH_MARKIERT: Schritt = {
  feld: feld("Anschlüsse", "4", true),
  einheitFehltWirklich: false,
};

describe("K10 · Agentenvergleich: Unterbrechungen, ersparte Eingaben, Fehlhinweise, Korrektur", () => {
  it("zwei fehlende Einheiten: Gleichstand — Einrichten und Unterbrechungen zehren die Ersparnis auf", () => {
    expect(
      vergleiche([LEISTUNG_OHNE_EINHEIT, SPANNUNG_MIT_EINHEIT, STROM_OHNE_EINHEIT, HERSTELLER]),
    ).toEqual({
      ohne: {
        variante: "ohne",
        eingaben: 4,
        unterbrechungen: 0,
        fehlhinweise: 0,
        korrekturaufwand: 6,
        unentdeckt: 0,
      },
      mit: {
        variante: "mit",
        eingaben: 6,
        unterbrechungen: 2,
        fehlhinweise: 0,
        korrekturaufwand: 2,
        unentdeckt: 0,
      },
      ersparteEingaben: 2,
      entlastung: 0,
    });
  });

  it("Recherche ohne fehlende Einheit: die Begleitung kostet nur — negative Entlastung bleibt stehen", () => {
    const v = vergleiche([SPANNUNG_MIT_EINHEIT, HERSTELLER]);
    expect(v.mit.unterbrechungen).toBe(0);
    expect(v.ersparteEingaben).toBe(-EINRICHTEN);
    expect(v.entlastung).toBe(-EINRICHTEN);
  });

  it("falsch eingerichtetes Feld: der Fehlhinweis wird gezählt und verschlechtert die Bilanz", () => {
    const v = vergleiche([LEISTUNG_OHNE_EINHEIT, ANSCHLUESSE_FALSCH_MARKIERT, HERSTELLER]);
    expect(v.mit.fehlhinweise).toBe(1);
    expect(v.mit.unterbrechungen).toBe(2);
    expect(v.entlastung).toBe(
      v.ohne.eingaben +
        v.ohne.korrekturaufwand -
        (v.mit.eingaben + v.mit.korrekturaufwand + v.mit.unterbrechungen + v.mit.fehlhinweise),
    );
    expect(v.entlastung).toBeLessThan(0);
  });

  it("drei fehlende Einheiten: erst ab hier überwiegt die Entlastung", () => {
    const dritter: Schritt = {
      feld: feld("Wirkungsgrad", "92", true),
      einheitFehltWirklich: true,
      korrigiert: "92 %",
    };
    const v = vergleiche([LEISTUNG_OHNE_EINHEIT, STROM_OHNE_EINHEIT, dritter, HERSTELLER]);
    expect(v.mit.fehlhinweise).toBe(0);
    expect(v.mit.unentdeckt).toBe(0);
    expect(v.entlastung).toBeGreaterThan(0);
  });
});
