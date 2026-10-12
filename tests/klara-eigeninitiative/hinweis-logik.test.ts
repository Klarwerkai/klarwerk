// @vitest-environment jsdom
// ================================================================================================
// KLARA 12 (produkt:20261008:klara-eigeninitiative) · WELCHER HINWEIS, UND WANN ER ERSCHEINEN DARF.
// ================================================================================================
//
// Die reine Ableitung aus `apps/web/src/lib/klaraEigeninitiative.ts` — ohne Oberfläche, ohne Netz.
//
//   L1 · K2  Ein Hinweis kommt aus dem tatsächlichen Kontext (Anleitung, ungeprüftes Objekt, Seite)
//            und bietet nur die vorhandene Hilfe an („zeige“/„erklaere“); ohne Anlass keiner.
//   L2 · K2  Nur im Modus „Passende Hinweise anbieten“ und nur, solange niemand mit Klara arbeitet.
//            „Nur auf Nachfrage“ und „Ausdrücklich übertragene Aufgaben“ zeigen nie einen Hinweis;
//            ohne gelesenen Stand gilt still.
//   L3 · K3  Ein ruhender Hinweis (geschlossen/zurückgestellt, Frist offen) erscheint nicht; nach
//            Ablauf der Frist wieder. Je Sitzung höchstens einmal.
//   L4       Der Schlüssel passt zur Prüfung am Server (`art:ort`, nur zulässige Zeichen).
import { describe, expect, it } from "vitest";
import type { EigeninitiativeAntwort } from "../../apps/web/src/api/assistenzEigeninitiative";
import {
  type EigeninitiativeLage,
  type HinweisKontext,
  hinweisErlaubt,
  hinweisFuer,
  hinweisRuht,
  ortSchluessel,
  wirksamerModus,
} from "../../apps/web/src/lib/klaraEigeninitiative";
import { istHinweisSchluessel } from "../../services/app/src/assistenz-eigeninitiative";

const BASIS: HinweisKontext = {
  pfad: "/fragen",
  tutorialVorhanden: false,
  tutorialOffen: false,
  erklaerbar: false,
};

function lage(
  modus: EigeninitiativeAntwort["modus"],
  hinweise: EigeninitiativeAntwort["hinweise"] = [],
): EigeninitiativeLage {
  return {
    kontoId: "konto-1",
    status: "bereit",
    antwort: { modus, gewaehlt: true, geaendertAm: "2026-10-12T08:00:00.000Z", hinweise },
    speichert: false,
    fehler: false,
  };
}

const JETZT = Date.parse("2026-10-12T10:00:00.000Z");

describe("L1 · K2 — der Hinweis kommt aus dem tatsächlichen Kontext", () => {
  it("Anleitung vorhanden und zu → nächsten Schritt anbieten", () => {
    expect(hinweisFuer({ ...BASIS, tutorialVorhanden: true, erklaerbar: true })).toEqual({
      schluessel: "tutorial:fragen",
      art: "tutorial",
      angebot: "zeige",
    });
  });

  it("Anleitung schon offen → kein Anleitungshinweis", () => {
    const h = hinweisFuer({ ...BASIS, tutorialVorhanden: true, tutorialOffen: true });
    expect(h).toBeNull();
  });

  it("ungeprüftes Wissensobjekt beim Lesen → erklären; beim Bearbeiten nicht", () => {
    const lesen = { ...BASIS, pfad: "/wissen/ko-7", koId: "ko-7", pruefstatus: "ungeprueft" };
    expect(hinweisFuer({ ...lesen, modus: "lesen" } as HinweisKontext)).toEqual({
      schluessel: "ungeprueft:ko-7",
      art: "ungeprueft",
      angebot: "erklaere",
    });
    expect(hinweisFuer({ ...lesen, modus: "bearbeiten" } as HinweisKontext)).toBeNull();
    expect(
      hinweisFuer({ ...lesen, pruefstatus: "geprueft", modus: "lesen" } as HinweisKontext),
    ).toBeNull();
  });

  it("erklärbare Seite → Seite erklären; ohne Anlass kein Hinweis", () => {
    expect(hinweisFuer({ ...BASIS, pfad: "/bibliothek/x", erklaerbar: true })).toEqual({
      schluessel: "seite:bibliothek",
      art: "seite",
      angebot: "erklaere",
    });
    expect(hinweisFuer(BASIS)).toBeNull();
  });
});

describe("L2 · K2 — nur im Hinweismodus und nur in Ruhe", () => {
  const h = hinweisFuer({ ...BASIS, erklaerbar: true });

  it("„Nur auf Nachfrage“ und Aufgabenmodus zeigen nie einen Hinweis", () => {
    for (const modus of ["nachfrage", "auftraege"] as const) {
      expect(hinweisErlaubt(h, lage(modus), { beschaeftigt: false, jetzt: JETZT })).toBe(false);
    }
    expect(hinweisErlaubt(h, lage("hinweise"), { beschaeftigt: false, jetzt: JETZT })).toBe(true);
  });

  it("während die Person mit Klara arbeitet, erscheint keiner", () => {
    expect(hinweisErlaubt(h, lage("hinweise"), { beschaeftigt: true, jetzt: JETZT })).toBe(false);
  });

  it("ohne gelesenen Stand gilt die stille Vorgabe", () => {
    const laedt: EigeninitiativeLage = { ...lage("hinweise"), status: "laedt" };
    expect(wirksamerModus(laedt)).toBe("nachfrage");
    expect(hinweisErlaubt(h, laedt, { beschaeftigt: false, jetzt: JETZT })).toBe(false);
    const fehler: EigeninitiativeLage = { ...lage("hinweise"), status: "fehler", antwort: null };
    expect(hinweisErlaubt(h, fehler, { beschaeftigt: false, jetzt: JETZT })).toBe(false);
  });
});

describe("L3 · K3 — ruhende Hinweise werden nicht erneut aufgedrängt", () => {
  const h = hinweisFuer({ ...BASIS, erklaerbar: true });
  const schluessel = h?.schluessel ?? "";

  it("geschlossen oder zurückgestellt mit offener Frist → nein; nach Ablauf → ja", () => {
    for (const stand of ["geschlossen", "zurueckgestellt"] as const) {
      const ruhend = lage("hinweise", [
        { schluessel, stand, bis: new Date(JETZT + 60_000).toISOString() },
      ]);
      expect(hinweisRuht(schluessel, ruhend.antwort, JETZT)).toBe(true);
      expect(hinweisErlaubt(h, ruhend, { beschaeftigt: false, jetzt: JETZT })).toBe(false);
      const abgelaufen = lage("hinweise", [
        { schluessel, stand, bis: new Date(JETZT - 1).toISOString() },
      ]);
      expect(hinweisErlaubt(h, abgelaufen, { beschaeftigt: false, jetzt: JETZT })).toBe(true);
    }
  });

  it("ein anderer ruhender Hinweis hält diesen nicht zurück", () => {
    const andere = lage("hinweise", [
      { schluessel: "seite:anders", stand: "geschlossen", bis: "2099-01-01T00:00:00.000Z" },
    ]);
    expect(hinweisErlaubt(h, andere, { beschaeftigt: false, jetzt: JETZT })).toBe(true);
  });
});

describe("L4 — der Schlüssel passt zur Prüfung am Server", () => {
  it("auch bei ungewöhnlichen Pfaden und Kennungen", () => {
    const faelle: HinweisKontext[] = [
      { ...BASIS, pfad: "/", erklaerbar: true },
      { ...BASIS, pfad: "/wiki/ä ö?x=1", erklaerbar: true },
      { ...BASIS, pfad: "/erfassen?draft=1", tutorialVorhanden: true },
      {
        ...BASIS,
        pfad: "/wissen/x",
        koId: "ko/<b>ä",
        pruefstatus: "ungeprueft",
        modus: "lesen",
      },
    ];
    for (const k of faelle) {
      const s = hinweisFuer(k)?.schluessel ?? "";
      expect([s, istHinweisSchluessel(s)]).toEqual([s, true]);
    }
    expect(ortSchluessel("/")).toBe("start");
    expect(ortSchluessel("/erfassen?draft=1")).toBe("erfassen");
  });
});
