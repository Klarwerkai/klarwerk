// ================================================================================================
// produkt:20261010:poc-ki-ausfall-weiterarbeiten · DIE REINE ABLEITUNG (`apps/web/src/lib/kiAusfall.ts`).
// ================================================================================================
//
//   A1  PV-03-01: jede belegte Ursache hat ihren eigenen Satz; ein Netzfehler des Abrufs wird NICHT
//       zum KI-Ausfall erklärt (ganze Anwendung offline ist kein zugesagter Umfang, PV-03-02).
//   A2  PV-03-05: „Erneut versuchen" nur, wo derselbe Versuch etwas ändern kann.
//   A3  PV-03-01: Sperrsatz aus dem Status — Störung und Nicht-Einrichtung getrennt.
//   A4  PV-03-03: „im Browser gespeichert" nur nach NACHLESEN über den echten Schreibweg; gesperrter
//       Speicher, fehlendes Konto oder ein anderer Text heißen „nur auf der Seite".
import { describe, expect, it } from "vitest";
import { aiSperrHinweisKey } from "../../apps/web/src/lib/aiAvailability";
import { arbeitsstandSchreiben } from "../../apps/web/src/lib/fragenArbeitsstand";
import {
  entwurfSpeicherort,
  erneutVersuchenSinnvoll,
  ersatzGrundKey,
  kiFehlerUrsache,
  kiStoerungHinweisKey,
  statusErneutPruefbar,
} from "../../apps/web/src/lib/kiAusfall";
import kiausfall from "../../apps/web/src/texte/kiausfall";

class Speicher {
  readonly daten = new Map<string, string>();
  gesperrt = false;
  getItem(k: string): string | null {
    return this.daten.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.gesperrt) {
      throw new Error("QuotaExceededError");
    }
    this.daten.set(k, v);
  }
  removeItem(k: string): void {
    this.daten.delete(k);
  }
}

const FRAGE = "Wie oft wird das fiktive Ventil V4 geprüft?";

describe("A1 · Ursache einer gescheiterten Frage", () => {
  it.each([
    ["KI_ABGESCHALTET", "abgeschaltet"],
    ["KI_ANFRAGEN_GEBREMST", "gebremst"],
    ["MODEL_BUSY", "kapazitaet"],
    ["KLARA_AUSWEICHWEG_GESPERRT", "verweigert"],
  ])("Code %s → %s", (code, erwartet) => {
    expect(kiFehlerUrsache({ status: 503, code, message: "x" })).toBe(erwartet);
  });

  it("Netzfehler des Abrufs, unbekannter Code und Fremdfehler bleiben unbelegt (allgemeiner Satz)", () => {
    expect(kiFehlerUrsache(new TypeError("Failed to fetch"))).toBeNull();
    expect(kiFehlerUrsache(new Error("network"))).toBeNull();
    expect(kiFehlerUrsache({ status: 500, code: "INTERNAL" })).toBeNull();
    expect(kiFehlerUrsache(undefined)).toBeNull();
  });

  it("jede Ursache und jeder Ersatzgrund hat einen Satz in DE, EN und NL", () => {
    for (const ursache of ["kapazitaet", "verweigert"]) {
      for (const teil of ["titel", "text"]) {
        const key = `kiausfall.fehler.${ursache}.${teil}`;
        expect(kiausfall.de).toHaveProperty([key]);
        expect(kiausfall.en).toHaveProperty([key]);
        expect(kiausfall.nl).toHaveProperty([key]);
      }
    }
    for (const grund of [
      "zeitueberschreitung",
      "nicht_erreichbar",
      "verweigert",
      "kontingent",
      "fehler",
    ] as const) {
      for (const beantwortet of [true, false]) {
        const key = ersatzGrundKey(grund, beantwortet) ?? "";
        expect(kiausfall.de).toHaveProperty([key]);
        expect(kiausfall.en).toHaveProperty([key]);
        expect(kiausfall.nl).toHaveProperty([key]);
      }
    }
    expect(ersatzGrundKey(undefined, true)).toBeNull();
    expect(ersatzGrundKey(undefined, false)).toBeNull();
  });

  it("Ben nacharbeit-2: ohne Antwort behauptet kein Satz eine Antwort", () => {
    for (const [sprache, block] of Object.entries({
      de: kiausfall.de,
      en: kiausfall.en,
      nl: kiausfall.nl,
    })) {
      const ohne = Object.entries(block).filter(([k]) => k.startsWith("kiausfall.ohneAntwort."));
      expect(ohne.length, sprache).toBe(5);
      for (const [, satz] of ohne) {
        expect(satz).not.toMatch(/beantwortet:|answered without|zonder AI beantwoord/i);
        expect(satz).not.toMatch(/zusammengestellt|compiled|samengesteld/i);
      }
    }
    expect(ersatzGrundKey("zeitueberschreitung", false)).toBe(
      "kiausfall.ohneAntwort.zeitueberschreitung",
    );
    expect(ersatzGrundKey("zeitueberschreitung", true)).toBe(
      "kiausfall.ersatz.zeitueberschreitung",
    );
  });

  it("kein Satz nennt einen Anbieter, Schlüssel oder Statuscode", () => {
    const alle = [kiausfall.de, kiausfall.en, kiausfall.nl].flatMap((b) => Object.values(b));
    for (const satz of alle) {
      expect(satz).not.toMatch(/openai|anthropic|api[_ -]?key|sk-|\b[45]\d\d\b/i);
    }
  });
});

describe("A2 · Erneut versuchen", () => {
  it("nicht nach Abschaltung oder verweigerter Verarbeitung — sonst ja", () => {
    expect(erneutVersuchenSinnvoll("abgeschaltet")).toBe(false);
    expect(erneutVersuchenSinnvoll("verweigert")).toBe(false);
    expect(erneutVersuchenSinnvoll("kapazitaet")).toBe(true);
    expect(erneutVersuchenSinnvoll("gebremst")).toBe(true);
    expect(erneutVersuchenSinnvoll(null)).toBe(true);
  });
});

describe("A3 · Sperrsatz aus dem Status", () => {
  it("unbekannt, nicht erreichbar und nicht eingerichtet sind drei Sätze", () => {
    expect(kiStoerungHinweisKey(undefined, true)).toBe("ai.statusUnknown.hint");
    expect(kiStoerungHinweisKey({ reachable: "unreachable" }, false)).toBe(
      "kiausfall.status.nichtErreichbar",
    );
    expect(kiStoerungHinweisKey({ reachable: "none" }, false)).toBe("ai.unavailable.hint");
    expect(kiStoerungHinweisKey({ reachable: "active" }, false)).toBe("ai.unavailable.hint");
  });

  it("Klara-Panel und Bibliotheksantwort lesen dieselbe Regel; die Abschaltung hat Vorrang", () => {
    expect(aiSperrHinweisKey({ reachable: "unreachable" }, "answer", false)).toBe(
      "kiausfall.status.nichtErreichbar",
    );
    const beides = { reachable: "unreachable", kiAbgeschaltet: true } as const;
    expect(aiSperrHinweisKey(beides, "answer", false)).toBe("d5kiaus.hinweis");
    expect(aiSperrHinweisKey({ reachable: "unreachable" }, "answer", true)).toBe(
      "ai.statusUnknown.hint",
    );
    expect(aiSperrHinweisKey({ reachable: "none" }, "answer", false)).toBe("ai.unavailable.hint");
  });

  it("nur eine Störung bietet „erneut prüfen“ an", () => {
    expect(statusErneutPruefbar("ai.statusUnknown.hint")).toBe(true);
    expect(statusErneutPruefbar("kiausfall.status.nichtErreichbar")).toBe(true);
    expect(statusErneutPruefbar("ai.unavailable.hint")).toBe(false);
  });
});

describe("A4 · wo die Frage gesichert ist", () => {
  it("im Browser — nach dem echten Schreibweg nachgelesen", () => {
    const speicher = new Speicher();
    arbeitsstandSchreiben(speicher, "konto-fiktiv-1", {
      entwurf: FRAGE,
      antwort: null,
      startadressen: [],
    });
    expect(entwurfSpeicherort(speicher, "konto-fiktiv-1", FRAGE)).toBe("browser");
  });

  it("gesperrter Speicher: das sichtbare Feld allein ist KEINE Speicherung", () => {
    const speicher = new Speicher();
    speicher.gesperrt = true;
    arbeitsstandSchreiben(speicher, "konto-fiktiv-1", {
      entwurf: FRAGE,
      antwort: null,
      startadressen: [],
    });
    expect(entwurfSpeicherort(speicher, "konto-fiktiv-1", FRAGE)).toBe("nurSeite");
  });

  it("ohne Konto, ohne Speicher, mit anderem Text oder leerem Feld: nur auf der Seite", () => {
    const speicher = new Speicher();
    arbeitsstandSchreiben(speicher, "konto-fiktiv-1", {
      entwurf: FRAGE,
      antwort: null,
      startadressen: [],
    });
    expect(entwurfSpeicherort(speicher, null, FRAGE)).toBe("nurSeite");
    expect(entwurfSpeicherort(undefined, "konto-fiktiv-1", FRAGE)).toBe("nurSeite");
    expect(entwurfSpeicherort(speicher, "konto-fiktiv-1", `${FRAGE} (geändert)`)).toBe("nurSeite");
    expect(entwurfSpeicherort(speicher, "konto-fiktiv-2", FRAGE)).toBe("nurSeite");
    expect(entwurfSpeicherort(speicher, "konto-fiktiv-1", "   ")).toBe("nurSeite");
  });
});
