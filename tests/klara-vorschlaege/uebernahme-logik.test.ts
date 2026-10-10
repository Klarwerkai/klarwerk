// @vitest-environment jsdom
// ================================================================================================
// KLARA 04 (produkt:20261008:klara-vorschlaege) — DIE ÜBERNAHMEREGEL OHNE OBERFLÄCHE.
// ================================================================================================
//
// `lib/klaraUebernahme.ts` entscheidet, was ein bewusst übernommener Vorschlag in der
// Bearbeitungsfassung ändert: genau eine Stelle oder nichts.
//
//   L1 · K1/K2 — eindeutige Stelle in der Kernaussage: nur sie wird ersetzt, der Rest bleibt.
//   L2 · K2    — Fundstelle im Fliesstext: ersetzt als TEXT im Textknoten, Auszeichnung bleibt.
//   L3 · K4    — mehrdeutig: nichts ersetzt, alle Stellen mit Feld und Umgebung zurück; mit der
//                gewählten Stelle (am Textstand der Rückfrage) genau diese.
//   L4 · K4    — nicht gefunden / über eine Formatierung hinweg: nichts ersetzt, Grund benannt.
//   L5 · K4    — der Übergabekanal: eine Rückmeldung räumt ab, Zurückziehen nur die eigene.
//   L6 · Rechte — ein Vorschlag gehört dem Konto, unter dem er entstand.
//   L7 · K4    — Mischfall formatierte + unformatierte Fundstelle: keine Änderung (Ben, Nacharbeit 2).
//   L8 · K4    — veraltete Wahl (Stelle weg / umgeordnet): neue Rückfrage (Ben, Nacharbeit 2).
import { describe, expect, it } from "vitest";
import { ANFANG, anKontoBinden } from "../../apps/web/src/components/klara-vorschau/zustand";
import {
  findeStellen,
  meldeUebergabe,
  offeneUebergabe,
  pruefeUebergabe,
  textstand,
  uebergebe,
  zieheUebergabeZurueck,
} from "../../apps/web/src/lib/klaraUebernahme";

const ORIGINAL = "Die Pumpe wird vor dem Start entlüftet.";
const NEU = "Vor dem Start entlüftest du die Pumpe.";

describe("L1 · eindeutige Stelle in der Kernaussage", () => {
  it("ersetzt genau diese Stelle; Fliesstext bleibt", () => {
    const f = {
      statement: `Hinweis: ${ORIGINAL} Danach prüfen.`,
      bodyHtml: "<p>Anderer Text.</p>",
    };
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: NEU });
    expect(lage.art).toBe("eindeutig");
    if (lage.art !== "eindeutig") {
      return;
    }
    expect(lage.feld).toBe("aussage");
    expect(lage.felder.statement).toBe(`Hinweis: ${NEU} Danach prüfen.`);
    expect(lage.felder.bodyHtml).toBe("<p>Anderer Text.</p>");
  });

  it("Leerraum der Markierung zählt nicht (Zeilenumbruch im Lesebild)", () => {
    const f = { statement: "Die Pumpe wird\nvor dem Start entlüftet.", bodyHtml: "" };
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: NEU });
    expect(lage.art).toBe("eindeutig");
  });
});

describe("L2 · Fundstelle im Fliesstext", () => {
  it("ersetzt als Text — Auszeichnung des Absatzes bleibt, Markup im Vorschlag wird Text", () => {
    const f = {
      statement: "Kurz: Pumpe entlüften.",
      bodyHtml: `<p><strong>Achtung</strong> ${ORIGINAL}</p><p>Weiter.</p>`,
    };
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: "<b>neu</b> & gut" });
    expect(lage.art).toBe("eindeutig");
    if (lage.art !== "eindeutig") {
      return;
    }
    expect(lage.feld).toBe("inhalt");
    expect(lage.felder.statement).toBe("Kurz: Pumpe entlüften.");
    expect(lage.felder.bodyHtml).toBe(
      "<p><strong>Achtung</strong> &lt;b&gt;neu&lt;/b&gt; &amp; gut</p><p>Weiter.</p>",
    );
  });
});

describe("L3 · mehrdeutiges Ziel", () => {
  const f = {
    statement: ORIGINAL,
    bodyHtml: `<p>${ORIGINAL}</p><p>Zweitens: ${ORIGINAL}</p>`,
  };

  it("ändert nichts und nennt alle Stellen mit Feld und Umgebung", () => {
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: NEU });
    expect(lage.art).toBe("mehrdeutig");
    if (lage.art !== "mehrdeutig") {
      return;
    }
    expect(lage.stellen.map((s) => [s.nr, s.feld])).toEqual([
      [0, "aussage"],
      [1, "inhalt"],
      [2, "inhalt"],
    ]);
    expect(lage.stellen[2]?.davor).toBe("Zweitens:");
  });

  it("mit gewählter Stelle am selben Textstand genau diese — die übrigen bleiben", () => {
    const wahl = { nr: 2, stand: textstand(f) };
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: NEU, wahl });
    expect(lage.art).toBe("eindeutig");
    if (lage.art !== "eindeutig") {
      return;
    }
    expect(lage.felder.statement).toBe(ORIGINAL);
    expect(lage.felder.bodyHtml).toBe(`<p>${ORIGINAL}</p><p>Zweitens: ${NEU}</p>`);
  });

  it("die Rückfrage nennt den Textstand, an dem sie gezählt hat", () => {
    const lage = pruefeUebergabe(f, { original: ORIGINAL, neu: NEU });
    expect(lage.art === "mehrdeutig" ? lage.stand : null).toBe(textstand(f));
  });
});

// Bens Befund (Nacharbeit 2), Teil 2: die Wahl gilt nur am Textstand der Rückfrage.
describe("L8 · K4 — veraltete Wahl: neue Rückfrage statt einer anderen Stelle", () => {
  const damals = {
    statement: ORIGINAL,
    bodyHtml: `<p>Erstens: ${ORIGINAL}</p><p>Zweitens: ${ORIGINAL}</p>`,
  };
  const wahl = { nr: 2, stand: textstand(damals) };

  it("die gewählte Stelle ist weg, eine andere bleibt allein: keine Ersetzung, neu fragen", () => {
    const jetzt = {
      statement: ORIGINAL,
      bodyHtml: "<p>Erstens: anders.</p><p>Zweitens: weg.</p>",
    };
    const lage = pruefeUebergabe(jetzt, { original: ORIGINAL, neu: NEU, wahl });
    expect(lage.art).toBe("veraltet");
    if (lage.art !== "veraltet") {
      return;
    }
    expect(lage.stellen.map((s) => s.feld)).toEqual(["aussage"]);
    expect(lage.stand).toBe(textstand(jetzt));
  });

  it("gleiche Anzahl, aber umgeordnet: keine Ersetzung, neu fragen", () => {
    const jetzt = {
      statement: ORIGINAL,
      bodyHtml: `<p>Zweitens: ${ORIGINAL}</p><p>Erstens: ${ORIGINAL}</p>`,
    };
    expect(findeStellen(jetzt, ORIGINAL).stellen).toHaveLength(3);
    const lage = pruefeUebergabe(jetzt, { original: ORIGINAL, neu: NEU, wahl });
    expect(lage.art).toBe("veraltet");
  });

  it("dieselbe Wahl am neuen Textstand ersetzt dann genau die neu gewählte Stelle", () => {
    const jetzt = {
      statement: ORIGINAL,
      bodyHtml: `<p>Zweitens: ${ORIGINAL}</p><p>Erstens: ${ORIGINAL}</p>`,
    };
    const neuGewaehlt = { nr: 1, stand: textstand(jetzt) };
    const lage = pruefeUebergabe(jetzt, { original: ORIGINAL, neu: NEU, wahl: neuGewaehlt });
    expect(lage.art).toBe("eindeutig");
    if (lage.art !== "eindeutig") {
      return;
    }
    expect(lage.felder.bodyHtml).toBe(`<p>Zweitens: ${NEU}</p><p>Erstens: ${ORIGINAL}</p>`);
  });
});

// Bens Befund (Nacharbeit 2), Teil 1: formatierte Fundstellen zählen bei der Zielentscheidung mit.
describe("L7 · K4 — Mischfall formatierte und unformatierte Fundstelle", () => {
  const FORMATIERT = "<p>Die Pumpe <em>wird</em> vor dem Start entlüftet.</p>";

  it("Kernaussage plus formatierter Inhalt: keine Übernahme in die Kernaussage, Grund benannt", () => {
    const f = { statement: ORIGINAL, bodyHtml: FORMATIERT };
    expect(findeStellen(f, ORIGINAL)).toMatchObject({ formatiert: 1, ueberFormatierung: true });
    expect(pruefeUebergabe(f, { original: ORIGINAL, neu: NEU }).art).toBe("formatiert_mehrdeutig");
  });

  it("unformatierte Stelle im Inhalt plus formatierte: ebenfalls ohne Änderung", () => {
    const f = { statement: "Kurz.", bodyHtml: `<p>${ORIGINAL}</p>${FORMATIERT}` };
    expect(findeStellen(f, ORIGINAL)).toMatchObject({ formatiert: 1 });
    expect(pruefeUebergabe(f, { original: ORIGINAL, neu: NEU }).art).toBe("formatiert_mehrdeutig");
  });

  it("auch eine Wahl aus einer Rückfrage ersetzt nicht, solange eine formatierte Stelle besteht", () => {
    const f = { statement: ORIGINAL, bodyHtml: `<p>${ORIGINAL}</p>${FORMATIERT}` };
    const wahl = { nr: 0, stand: textstand(f) };
    expect(pruefeUebergabe(f, { original: ORIGINAL, neu: NEU, wahl }).art).toBe(
      "formatiert_mehrdeutig",
    );
  });
});

describe("L4 · nichts zu ersetzen", () => {
  it("Wortlaut nicht mehr da", () => {
    const lage = pruefeUebergabe(
      { statement: "Etwas anderes.", bodyHtml: "<p>Noch etwas.</p>" },
      { original: ORIGINAL, neu: NEU },
    );
    expect(lage.art).toBe("nicht_gefunden");
  });

  it("Markierung über eine Formatierung hinweg wird nicht geraten", () => {
    const f = {
      statement: "",
      bodyHtml: "<p>Die Pumpe <em>wird</em> vor dem Start entlüftet.</p>",
    };
    expect(findeStellen(f, ORIGINAL)).toEqual({
      stellen: [],
      formatiert: 1,
      ueberFormatierung: true,
    });
    expect(pruefeUebergabe(f, { original: ORIGINAL, neu: NEU }).art).toBe("ueber_formatierung");
  });
});

describe("L6 · Vorschläge gehören der Person", () => {
  it("ein anderes Konto (oder Abmelden) findet den Vorschlag nicht vor", () => {
    const herkunft = {
      pfad: "/wissen/ko-a",
      seite: "wissen" as const,
      seitenName: "Wissen",
      objekt: "„A“",
    };
    const mit = anKontoBinden(
      {
        ...ANFANG,
        textvorschlag: {
          id: "v1",
          original: ORIGINAL,
          neu: NEU,
          herkunft,
          ki: "ki",
          stand: "offen",
        },
      },
      "konto-a",
    );
    expect(mit.textvorschlag?.id).toBe("v1");
    expect(anKontoBinden(mit, "konto-b").textvorschlag).toBeNull();
    expect(anKontoBinden(mit, null).textvorschlag).toBeNull();
  });
});

describe("L5 · Übergabekanal", () => {
  it("eine Rückmeldung räumt die Übergabe ab; Zurückziehen nur die eigene", () => {
    uebergebe({ id: "u1", koId: "ko-a", original: ORIGINAL, neu: NEU });
    expect(offeneUebergabe()?.koId).toBe("ko-a");
    zieheUebergabeZurueck("u-fremd");
    expect(offeneUebergabe()?.id).toBe("u1");
    meldeUebergabe("u1", { art: "kein_recht" });
    expect(offeneUebergabe()).toBeNull();
  });
});
