// @vitest-environment jsdom
// ================================================================================================
// KLARA-VORSCHAU (produkt:20261007:klara-vorschau) — die reine Logik hinter Figur und Gespräch.
// ================================================================================================
//
// Geprüft wird, was ohne Browser-Layout entscheidbar ist: Klemmen und Andocken nach Fensteränderung
// (K2), Seite und Objekt aus Adresse und Seite (K4), Herkunft einer Markierung (K5), Vorschlag mit
// Original und Übernahme NUR auf Entscheidung (K6), Zwischenfrage im Tutorial (K7), Entwurf (K8),
// Status „Entscheidung nötig“ (K9). Die echte Bedienung im Browser prüft
// `tests-smoke/klara-vorschau-browser.spec.ts`.
//
// `.tsx`, obwohl hier nichts montiert wird: die Bauteile lesen `document`, und nur der Typecheck der
// `.tsx`-Tests (`tsconfig.tests-tsx.json`) kennt die DOM-Typen.
import { describe, expect, it } from "vitest";
import {
  antwortAufAuswahl,
  antwortAufFrage,
  entwurfsInhalt,
} from "../../apps/web/src/components/klara-vorschau/antworten";
import { DEMO_ARTIKEL, artikelPfad } from "../../apps/web/src/components/klara-vorschau/artikel";
import {
  echtesFragefeld,
  ermittleKontext,
  herkunftFuer,
  seiteAusPfad,
} from "../../apps/web/src/components/klara-vorschau/kontext";
import {
  ANFANG,
  type Auswahl,
  FIGUR_GROESSE,
  type KlaraZustand,
  type Nachricht,
  RAND_ABSTAND,
  angedocktePosition,
  entscheide,
  klemme,
  naechsterRand,
  startPosition,
  statusNachAntwort,
  wirksamePosition,
} from "../../apps/web/src/components/klara-vorschau/zustand";
import i18n from "../../apps/web/src/i18n";
import type { TutorialFernLage } from "../../apps/web/src/tutorial/fernsteuerung";

const t = i18n.getFixedT("de");

function vorhanden<T>(wert: T | undefined, was: string): T {
  if (wert === undefined) {
    throw new Error(`${was} fehlt`);
  }
  return wert;
}

const ROLLE = vorhanden(DEMO_ARTIKEL[0], "fiktiver Artikel");
const ABSATZ_2 = vorhanden(ROLLE.absaetze[1], "Absatz 2");

function artikelAuswahl(text = ABSATZ_2.text): Auswahl {
  return {
    id: "a-1",
    text,
    herkunft: {
      pfad: artikelPfad(ROLLE.id),
      seite: "artikel",
      seitenName: "Artikel",
      objekt: `„${ROLLE.titel}“`,
      artikelId: ROLLE.id,
      absatz: 2,
    },
  };
}

function klaraNachricht(id: string, a: Auswahl, erg: ReturnType<typeof antwortAufAuswahl>) {
  const n: Nachricht = {
    id,
    von: "klara",
    text: erg.text,
    herkunft: a.herkunft,
    demo: true,
    ...(erg.vorschlag ? { vorschlag: erg.vorschlag } : {}),
  };
  return n;
}

describe("K2 · Klara bleibt erreichbar — klemmen, andocken, Fensteränderung", () => {
  const gross = { breite: 1280, hoehe: 800 };
  const klein = { breite: 390, hoehe: 600 };

  it("der Startplatz liegt vollständig im Fenster", () => {
    for (const f of [gross, klein]) {
      const p = startPosition(f);
      expect(p.x).toBeGreaterThanOrEqual(RAND_ABSTAND);
      expect(p.y).toBeGreaterThanOrEqual(RAND_ABSTAND);
      expect(p.x + FIGUR_GROESSE).toBeLessThanOrEqual(f.breite);
      expect(p.y + FIGUR_GROESSE).toBeLessThanOrEqual(f.hoehe);
    }
  });

  it("eine Position ausserhalb wird nach Verkleinern des Fensters ins Bild geklemmt", () => {
    const z: KlaraZustand = { ...ANFANG, position: { x: 1100, y: 700 } };
    const p = wirksamePosition(z, klein);
    expect(p.x + FIGUR_GROESSE).toBeLessThanOrEqual(klein.breite - RAND_ABSTAND);
    expect(p.y + FIGUR_GROESSE).toBeLessThanOrEqual(klein.hoehe - RAND_ABSTAND);
    expect(klemme({ x: -500, y: -500 }, gross)).toEqual({ x: RAND_ABSTAND, y: RAND_ABSTAND });
  });

  it("angedockt am rechten Rand bleibt Klara nach einer Fensteränderung am rechten Rand", () => {
    const z: KlaraZustand = { ...ANFANG, position: { x: 1196, y: 300 }, angedockt: "rechts" };
    expect(wirksamePosition(z, gross).x).toBe(gross.breite - FIGUR_GROESSE - RAND_ABSTAND);
    expect(wirksamePosition(z, klein).x).toBe(klein.breite - FIGUR_GROESSE - RAND_ABSTAND);
    expect(angedocktePosition("links", 300, klein).x).toBe(RAND_ABSTAND);
  });

  it("nah am Rand liegt in der Andockzone, mitten im Bild nicht", () => {
    expect(naechsterRand({ x: 1180, y: 100 }, gross)).toEqual({ rand: "rechts", inZone: true });
    expect(naechsterRand({ x: 20, y: 100 }, gross)).toEqual({ rand: "links", inZone: true });
    expect(naechsterRand({ x: 600, y: 100 }, gross).inZone).toBe(false);
  });
});

describe("K4 · Seite und konkretes Objekt", () => {
  it("die Adresse bestimmt die Seite", () => {
    expect(seiteAusPfad("/klara-vorschau")).toEqual({ seite: "uebersicht" });
    expect(seiteAusPfad(artikelPfad("foerderbandrolle"))).toEqual({
      seite: "artikel",
      artikelId: "foerderbandrolle",
    });
    expect(seiteAusPfad("/erfassen").seite).toBe("erfassung");
    expect(seiteAusPfad("/fragen").seite).toBe("fragen");
    expect(seiteAusPfad("/bibliothek").seite).toBe("andere");
  });

  it("Artikel: der Titel des fiktiven Artikels ist das Objekt", () => {
    const k = ermittleKontext(artikelPfad(ROLLE.id), t, null);
    expect(k.seitenName).toBe("Artikel");
    expect(k.objekt).toContain(ROLLE.titel);
    expect(k.artikelId).toBe(ROLLE.id);
  });

  it("Fragen: die Frage im ECHTEN Fragefeld ist das Objekt, nicht die der Tutorial-Demo", () => {
    document.body.innerHTML = `
      <div data-tutorial-demo="fragen"><input data-tutorial-ziel="fragen.fragefeld" value="Demo"></div>
      <input data-tutorial-ziel="fragen.fragefeld" value="Wie lange dauert der Testlauf?">`;
    expect(echtesFragefeld(document)?.value).toBe("Wie lange dauert der Testlauf?");
    const k = ermittleKontext("/fragen", t, document);
    expect(k.seitenName).toBe("Fragen");
    expect(k.objekt).toBe("Frage „Wie lange dauert der Testlauf?“");
    document.body.innerHTML = "";
    expect(ermittleKontext("/fragen", t, document).objekt).toBe("Noch keine Frage eingegeben");
  });

  it("Erfassung: der Titel im Blatt ist das Objekt, sonst „neuer Entwurf“", () => {
    document.body.innerHTML = '<input data-testid="blatt-titel" value="Ölwechsel Presse 4">';
    expect(ermittleKontext("/erfassen", t, document).objekt).toBe("Entwurf „Ölwechsel Presse 4“");
    document.body.innerHTML = "";
    expect(ermittleKontext("/erfassen", t, document).objekt).toBe(
      "Neuer, noch unbenannter Entwurf",
    );
  });

  it("andere Seiten nennen ihren Namen aus der bestehenden Hilfe-Registry", () => {
    expect(ermittleKontext("/bibliothek", t, null).seitenName).toBe(t("nav.library"));
  });
});

describe("K5 · Herkunft einer Markierung und die vorgefertigten Antworten", () => {
  it("ein Knoten im Artikelabsatz trägt Artikel und Absatz", () => {
    document.body.innerHTML = `<article data-klara-artikel="${ROLLE.id}"><p data-klara-absatz="3"><span id="ziel">Pfeil</span></p></article>`;
    const kontext = ermittleKontext(artikelPfad(ROLLE.id), t, document);
    const h = herkunftFuer(document.getElementById("ziel"), kontext);
    expect(h).toMatchObject({ seite: "artikel", artikelId: ROLLE.id, absatz: 3 });
    document.body.innerHTML = "";
  });

  it("Erklären und Zusammenfassen liefern die vorgefertigten Texte des Absatzes", () => {
    const a = artikelAuswahl();
    expect(antwortAufAuswahl("erklaeren", a, t, {}).text).toBe(ABSATZ_2.erklaerung);
    expect(antwortAufAuswahl("zusammenfassen", a, t, {}).text).toBe(ABSATZ_2.zusammenfassung);
  });

  it("ein fremder Ausschnitt bekommt eine ehrliche Schablone statt einer erfundenen Erklärung", () => {
    const fremd: Auswahl = {
      id: "f",
      text: "Ein beliebiger Satz. Noch einer.",
      herkunft: { pfad: "/fragen", seite: "fragen", seitenName: "Fragen", objekt: "x" },
    };
    expect(antwortAufAuswahl("erklaeren", fremd, t, {}).text).toContain("nur den Ablauf");
    expect(antwortAufAuswahl("zusammenfassen", fremd, t, {}).text).toBe(
      "Kurz gesagt: Ein beliebiger Satz.",
    );
  });
});

describe("K6 · Umformulierung ist ein Vorschlag — der Artikel ändert sich erst bei Übernahme", () => {
  function mitVorschlag(): KlaraZustand {
    const a = artikelAuswahl();
    const erg = antwortAufAuswahl("umformulieren", a, t, {});
    expect(erg.vorschlag).toMatchObject({
      original: ABSATZ_2.text,
      neu: ABSATZ_2.umformulierung,
      artikelId: ROLLE.id,
      absatz: 2,
      status: "offen",
    });
    const verlauf = [klaraNachricht("n-1", a, erg)];
    return { ...ANFANG, verlauf, status: statusNachAntwort(verlauf) };
  }

  it("ein offener Vorschlag verlangt eine Entscheidung, der Artikel ist unverändert", () => {
    const z = mitVorschlag();
    expect(z.status).toBe("entscheidung");
    expect(z.artikelText).toEqual({});
  });

  it("Verwerfen lässt den Artikel unverändert", () => {
    const z = entscheide(mitVorschlag(), "n-1", "verworfen");
    expect(z.artikelText).toEqual({});
    expect(z.verlauf[0]?.vorschlag?.status).toBe("verworfen");
    expect(z.status).toBe("antwort");
  });

  it("erst Übernehmen ändert genau diesen Absatz — und eine zweite Entscheidung ändert nichts", () => {
    const z = entscheide(mitVorschlag(), "n-1", "uebernommen");
    expect(z.artikelText).toEqual({ [`${ROLLE.id}#2`]: ABSATZ_2.umformulierung });
    expect(entscheide(z, "n-1", "verworfen").artikelText).toEqual(z.artikelText);
  });

  it("nach der Übernahme vergleicht ein neuer Vorschlag mit dem NEUEN Text", () => {
    const geaendert = { [`${ROLLE.id}#2`]: ABSATZ_2.umformulierung };
    const erg = antwortAufAuswahl("umformulieren", artikelAuswahl(), t, geaendert);
    expect(erg.vorschlag?.original).toBe(ABSATZ_2.umformulierung);
  });

  it("ein Ausschnitt ausserhalb eines Artikels lässt sich nicht in einen Artikel übernehmen", () => {
    const fremd: Auswahl = {
      id: "f",
      text: "Freier Text (mit Klammer). Zweiter Satz.",
      herkunft: { pfad: "/fragen", seite: "fragen", seitenName: "Fragen", objekt: "x" },
    };
    const erg = antwortAufAuswahl("umformulieren", fremd, t, {});
    expect(erg.vorschlag?.artikelId).toBeUndefined();
    expect(erg.vorschlag?.original).toBe(fremd.text);
    const z = entscheide(
      { ...ANFANG, verlauf: [klaraNachricht("n-2", fremd, erg)] },
      "n-2",
      "uebernommen",
    );
    expect(z.artikelText).toEqual({});
  });
});

describe("K7 · Zwischenfrage während des Tutorials", () => {
  it("die Antwort nennt den Schritt, an dem das Tutorial wartet", () => {
    const lage: TutorialFernLage = {
      definitionId: "fragen",
      schrittIndex: 1,
      schrittAnzahl: 7,
      schrittId: "formulieren",
      schrittTitel: "Frage formulieren",
      schrittText: "Schreib die Frage so, wie du sie einer Kollegin stellen würdest. Mehr Text.",
      teilText: null,
      zielName: null,
      zielFehlt: null,
      spielt: false,
      interaktiv: false,
      pause: () => {},
      fortsetzen: () => {},
      zurueck: () => {},
      weiter: () => {},
    };
    const kontext = ermittleKontext("/fragen", t, null);
    const text = antwortAufFrage("Was heisst Kontext?", kontext, t, lage);
    expect(text).toContain("Schritt 2");
    expect(text).toContain("Frage formulieren");
    expect(text).toContain("Fortsetzen");
  });
});

describe("K8 · Notizentwurf", () => {
  it("der Inhalt kommt aus dem markierten Absatz", () => {
    expect(entwurfsInhalt(artikelAuswahl())).toBe(ABSATZ_2.zusammenfassung);
  });
});
