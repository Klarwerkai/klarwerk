// ================================================================================================
// JOB 4154 · F9 — DAS ZUSTANDSMODELL DER FLÄCHE, JE AUSSAGE EIN FALL.
// ================================================================================================
//
// Auftrag Abschnitt 9. Sieben Lagen, und für jede gilt eine eigene Zusage darüber, was gesagt
// werden DARF und was nicht. Die teuersten Fehler dieses Projekts stehen genau hier (Lehre 03.09.,
// JOB 3027/3025/3037):
//
//   · Eine gescheiterte Auffrischung räumt die Fläche leer — der Mensch verliert den Stand, den er
//     gerade gelesen hat, und sieht statt seiner nichts.
//   · Neben einem Fehlersatz steht „unverändert" — eine Gleichheitsaussage über Daten, die
//     niemand geholt hat.
//   · „unbekannt" und „keine" fallen in einen Satz zusammen.
//
// Gerendert wird zu Markup (`react-dom/server`) und der STRING geprüft: das ist genau die Frage
// dieses Falls — welcher Satz erscheint und welcher nicht.
//
// GEGENPROBE: In `zustand.ts` den Zweig „Daten UND Fehler" entfernen (also bei `fehler != null`
// immer `{art:"fehler"}` zurückgeben). Dann wird „der Cache bleibt bei gescheiterter Auffrischung
// stehen" rot — die Fläche räumt leer.
import { describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import { renderToStaticMarkup } from "../../apps/web/node_modules/react-dom/server";
import type { AnweisungLesestand, AnweisungVergleich } from "../../apps/web/src/api/types";
import { EntscheidungsVorlage } from "../../apps/web/src/components/gesamtanweisung/EntscheidungsVorlage";
import { LesestandAnsicht } from "../../apps/web/src/components/gesamtanweisung/LesestandAnsicht";
import { VergleichAnsicht } from "../../apps/web/src/components/gesamtanweisung/VergleichAnsicht";
import {
  type Anzeigelage,
  anzeigelage,
  entscheidungSperre,
  gleichheitsaussageErlaubt,
  lesestandLeer,
  mengenSchluessel,
  schreibSperre,
  standSchluessel,
} from "../../apps/web/src/components/gesamtanweisung/zustand";
import "../../apps/web/src/i18n";

const LESESTAND: AnweisungLesestand = {
  id: "a-1",
  titel: "Anfahren",
  zweck: "Sicheres Anfahren",
  geltungsbereich: "Werk 1",
  voraussetzungen: "Anlage steht still",
  stand: "entwurf",
  version: 4,
  urheber: "anna",
  erstelltAm: "2026-09-15T09:00:00.000Z",
  geaendertAm: "2026-09-15T10:00:00.000Z",
  bausteine: [
    {
      id: "b-1",
      position: 0,
      koId: "ko-a",
      koVersion: 1,
      nachweisHash: "h1",
      voraussetzung: null,
      herkunft: { titel: "Schritt A", autor: "anna", fassungAm: null, status: "offen" },
      aktuelleKoVersion: 2,
      aktualisierungsvorschlag: { aufVersion: 2 },
      inhalt: { tabellenUeberschriften: null, abbildungen: [], geltung: "Werk 1" },
    },
  ],
  unvollstaendig: false,
  verborgeneBausteine: 0,
  pruefanbindung: "nicht_angebunden",
};

const VERGLEICH: AnweisungVergleich = {
  anweisungId: "a-1",
  vonVersion: 2,
  bisVersion: 4,
  gesamt: "unveraendert",
  befunde: [
    {
      feld: "kopf",
      bausteinId: null,
      auswirkung: "unveraendert",
      hinweis: "Titel und Zweck: unverändert.",
    },
  ],
  unbekannte: 0,
};

function lesestandMarkup(lage: Anzeigelage, stand?: AnweisungLesestand): string {
  return renderToStaticMarkup(
    createElement(LesestandAnsicht, { lage, stand, zeit: "2026-09-15T10:00:00.000Z" }),
  );
}

describe("F9 · das Zustandsmodell — je Aussage ein Fall", () => {
  it("laden → nur der Ladesatz, KEINE Aussage über Vollständigkeit, Menge oder Gleichheit", () => {
    const markup = lesestandMarkup({ art: "laden" });
    expect(markup).toContain("Lädt");
    expect(markup).not.toContain("unverändert");
    expect(markup).not.toContain("vollständig");
    expect(markup).not.toContain("Bausteine");
  });

  it("erfolgreich leer → der Satz des Auftrags, und kein „vollständig“/„unverändert“", () => {
    const leer: AnweisungLesestand = { ...LESESTAND, bausteine: [] };
    const lage = anzeigelage(
      { daten: leer, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    expect(lage.art).toBe("leer");
    const markup = lesestandMarkup(lage, leer);
    expect(markup).toContain("Diese Anweisung hat noch keine Bausteine.");
    expect(markup).not.toContain("vollständig");
    expect(markup).not.toContain("unverändert");
    expect(markup).not.toContain("geprüft");
  });

  it("auf der LEEREN Anweisung darf bearbeitet, aber nicht vorgelegt werden", () => {
    // Die beiden Sperren dürfen nicht dieselbe sein: wäre das Bearbeiten hier gesperrt, käme nie
    // ein erster Baustein hinein — eine Sackgasse. Wäre das Vorlegen offen, liesse sich eine leere
    // Anweisung zur Entscheidung stellen.
    const leer: AnweisungLesestand = { ...LESESTAND, bausteine: [] };
    const lage = anzeigelage(
      { daten: leer, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    expect(schreibSperre(lage)).toEqual({ gesperrt: false, grund: null });
    expect(entscheidungSperre(lage)).toEqual({ gesperrt: true, grund: "ga.leer" });
  });

  it("Fehler → Fehlersatz und GAR KEINE Gleichheits- oder Freigabeaussage", () => {
    const lage = anzeigelage(
      {
        daten: undefined,
        laedt: false,
        fehler: new Error("x"),
        aktualisiert: false,
        offline: false,
      },
      lesestandLeer,
    );
    expect(lage.art).toBe("fehler");
    const markup = lesestandMarkup(lage);
    expect(markup).toContain("konnte nicht geladen werden");
    expect(markup).not.toContain("unverändert");
    expect(markup).not.toContain("vollständig");
    expect(markup).not.toContain("freigegeben");
  });

  it("Cache mit LAUFENDER Auffrischung → der Stand steht da, gekennzeichnet als Stand", () => {
    const lage = anzeigelage(
      { daten: LESESTAND, laedt: false, fehler: null, aktualisiert: true, offline: false },
      lesestandLeer,
    );
    expect(standSchluessel(lage)).toBe("ga.auffrischungLaeuft");
    const markup = lesestandMarkup(lage, LESESTAND);
    expect(markup).toContain("wird aufgefrischt");
    // Nichts wurde leer geräumt.
    expect(markup).toContain("Anfahren");
    expect(markup).toContain("Gebundene Fassung 1");
  });

  it("Cache mit GESCHEITERTER Auffrischung → alter Stand bleibt UND der Fehler ist sichtbar", () => {
    const lage = anzeigelage(
      {
        daten: LESESTAND,
        laedt: false,
        fehler: new Error("x"),
        aktualisiert: false,
        offline: false,
      },
      lesestandLeer,
    );
    expect(lage).toMatchObject({ art: "stand", auffrischungGescheitert: true, frisch: false });
    const markup = lesestandMarkup(lage, LESESTAND);
    expect(markup).toContain("Auffrischung fehlgeschlagen");
    expect(markup).toContain("Anfahren");
    expect(markup).toContain("konnte nicht geladen werden");
    // Und er wird NICHT als frisch ausgegeben: die Standzeile ist die der gescheiterten
    // Auffrischung, nicht die des bestätigten Stands.
    expect(standSchluessel(lage)).toBe("ga.auffrischungGescheitert");
  });

  it("in genau diesem Zustand sind Vorlegen und Entscheiden gesperrt — mit sichtbarem Grund", () => {
    const lage = anzeigelage(
      {
        daten: LESESTAND,
        laedt: false,
        fehler: new Error("x"),
        aktualisiert: false,
        offline: false,
      },
      lesestandLeer,
    );
    const sperre = entscheidungSperre(lage);
    expect(sperre.gesperrt).toBe(true);
    expect(sperre.grund).toBe("ga.gesperrt");

    const markup = renderToStaticMarkup(
      createElement(EntscheidungsVorlage, {
        stand: "vorgelegt",
        sperre,
        darfEntscheiden: true,
        vorlegen: () => {},
        entscheiden: () => {},
        fehlerSatz: null,
      }),
    );
    expect(markup).toContain("disabled");
    expect(markup).toContain("nicht gesichert");
  });

  it("offline → wie Fehler, mit eigenem Satz; nichts gilt als gespeichert", () => {
    const lage = anzeigelage(
      { daten: undefined, laedt: true, fehler: null, aktualisiert: false, offline: true },
      lesestandLeer,
    );
    expect(lage).toEqual({ art: "fehler", offline: true });
    const markup = lesestandMarkup(lage);
    expect(markup).toContain("Keine Verbindung");
    expect(markup).toContain("gespeichert ist nichts");
    expect(markup).not.toContain("unverändert");
  });

  it("unvollständige Rechte → sichtbarer Satz, ohne Titel und ohne Kennung", () => {
    const beschnitten: AnweisungLesestand = {
      ...LESESTAND,
      unvollstaendig: true,
      verborgeneBausteine: 2,
    };
    const lage = anzeigelage(
      { daten: beschnitten, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    const markup = lesestandMarkup(lage, beschnitten);
    expect(markup).toContain("Teile dieser Anweisung sind für Sie nicht zugänglich.");
    expect(markup).toContain("Nicht zugängliche Bausteine: 2");
    expect(markup).not.toContain("vollständig");
  });

  it("der Lückenvermerk zur Prüfanbindung steht sichtbar auf der Fläche", () => {
    const lage = anzeigelage(
      { daten: LESESTAND, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    expect(lesestandMarkup(lage, LESESTAND)).toContain("Prüfanbindung: noch nicht angebunden");
  });

  it("der Aktualisierungsvorschlag steht DANEBEN — die gebundene Fassung bleibt sichtbar", () => {
    const lage = anzeigelage(
      { daten: LESESTAND, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    const markup = lesestandMarkup(lage, LESESTAND);
    expect(markup).toContain("Gebundene Fassung 1");
    expect(markup).toContain("Es gibt eine neuere Fassung (2)");
    expect(markup).toContain("Die gebundene Fassung bleibt bestehen.");
  });

  it("unbekannt und keine sind ZWEI verschiedene Sätze", () => {
    expect(mengenSchluessel(null)).toEqual({ schluessel: "ga.baustein.unbekannt", werte: null });
    expect(mengenSchluessel([])).toEqual({ schluessel: "ga.baustein.keine", werte: null });
    expect(mengenSchluessel(["Druck"])).toEqual({ schluessel: "", werte: "Druck" });

    const lage = anzeigelage(
      { daten: LESESTAND, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    const markup = lesestandMarkup(lage, LESESTAND);
    expect(markup).toContain("Tabellenüberschriften: nicht bestimmbar");
    expect(markup).toContain("Abbildungen: keine");
  });

  it("ein fehlendes Fassungsdatum wird benannt, nicht durch ein anderes ersetzt", () => {
    const lage = anzeigelage(
      { daten: LESESTAND, laedt: false, fehler: null, aktualisiert: false, offline: false },
      lesestandLeer,
    );
    expect(lesestandMarkup(lage, LESESTAND)).toContain("Fassungsdatum unbekannt");
  });

  it("der Vergleich sagt bei einem Fehler NICHTS über Gleichheit", () => {
    const lage = anzeigelage(
      {
        daten: VERGLEICH,
        laedt: false,
        fehler: new Error("x"),
        aktualisiert: false,
        offline: false,
      },
      () => false,
    );
    expect(gleichheitsaussageErlaubt(lage)).toBe(false);
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage,
        vergleich: VERGLEICH,
        staende: [2, 4],
        von: 2,
        bis: 4,
        waehleVon: () => {},
        waehleBis: () => {},
      }),
    );
    expect(markup).toContain("Kein Vergleich möglich");
    // Der Kern dieses Falls: kein „unverändert" neben einem Fehler.
    expect(markup).not.toContain("Unverändert. Das ist keine Aussage");
  });

  it("auf einem gesicherten Stand steht die Vokabel — und nur sie", () => {
    const lage = anzeigelage(
      { daten: VERGLEICH, laedt: false, fehler: null, aktualisiert: false, offline: false },
      () => false,
    );
    expect(gleichheitsaussageErlaubt(lage)).toBe(true);
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage,
        vergleich: VERGLEICH,
        staende: [2, 4],
        von: 2,
        bis: 4,
        waehleVon: () => {},
        waehleBis: () => {},
      }),
    );
    expect(markup).toContain("Unverändert. Das ist keine Aussage über Richtigkeit.");
    expect(markup).not.toContain("richtig.");
    expect(markup).not.toContain("geprüft");
    expect(markup).not.toContain("freigegeben");
  });

  it("unbestimmbare Befunde bleiben sichtbar, auch wenn etwas anderes geändert ist", () => {
    const gemischt: AnweisungVergleich = {
      ...VERGLEICH,
      gesamt: "geaendert",
      unbekannte: 2,
      befunde: [
        {
          feld: "reihenfolge",
          bausteinId: "b-1",
          auswirkung: "geaendert",
          hinweis: "Reihenfolge: geändert.",
        },
        {
          feld: "abbildungen",
          bausteinId: "b-1",
          auswirkung: "unbekannt",
          hinweis: "Abbildungen: Auswirkung nicht bestimmbar — fachlich zu klären.",
        },
      ],
    };
    const lage = anzeigelage(
      { daten: gemischt, laedt: false, fehler: null, aktualisiert: false, offline: false },
      () => false,
    );
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage,
        vergleich: gemischt,
        staende: [2, 4],
        von: 2,
        bis: 4,
        waehleVon: () => {},
        waehleBis: () => {},
      }),
    );
    expect(markup).toContain("Nicht bestimmbare Befunde: 2");
    expect(markup).toContain("nicht bestimmbar");
  });

  it("die Befundzeilen tragen Sätze, keine Maschinenschlüssel", () => {
    // Nutzerbefunde N-0053/N-0057: technische Begriffe erschweren das Lesen von Herkunft und
    // Änderungsangaben. Der Drahtschlüssel `tabellenueberschriften` gehört in die Antwort, nicht
    // auf die Fläche.
    const gemischt: AnweisungVergleich = {
      ...VERGLEICH,
      gesamt: "geaendert",
      befunde: [
        {
          feld: "tabellenueberschriften",
          bausteinId: "b-1",
          auswirkung: "geaendert",
          hinweis: "Tabellenüberschriften: geändert.",
        },
        {
          feld: "bausteinbestand",
          bausteinId: "b-2",
          auswirkung: "geaendert",
          hinweis: "Baustein neu aufgenommen.",
        },
      ],
    };
    const lage = anzeigelage(
      { daten: gemischt, laedt: false, fehler: null, aktualisiert: false, offline: false },
      () => false,
    );
    const markup = renderToStaticMarkup(
      createElement(VergleichAnsicht, {
        lage,
        vergleich: gemischt,
        staende: [2, 4],
        von: 2,
        bis: 4,
        waehleVon: () => {},
        waehleBis: () => {},
      }),
    );
    expect(markup).toContain("Tabellenüberschriften");
    expect(markup).toContain("Bausteinbestand");
    expect(markup).not.toContain("tabellenueberschriften");
    expect(markup).not.toContain("bausteinbestand");
  });
});
