// ================================================================================================
// aufnahme:20260922:gesamt-negativwissen-erfassung — DIE FLÄCHE DES GEFÜHRTEN LERNEFFEKTS.
// ================================================================================================
//
//   O1 (R-1664/R-2179 / K1, K2) Formular ↔ Angaben: Warnsignale je Zeile, ohne Leer- und Doppelwerte;
//                               ein Entwurf kehrt unverändert ins Formular zurück.
//   O2 (R-2180 / K3)            Die Stufenregel der Fläche: Bezug hebt „intern"/fehlend auf
//                               „vertraulich" an, eine strengere Wahl bleibt, ohne Bezug nichts.
//   O3 (R-1664 / K1)            Der geführte Block zeigt alle Fragen, das Warnsignalfeld und die
//                               Bezüge — in DE, EN und NL, mit der Sprache der Quelle
//                               („Lerneffekt dokumentieren", nicht „Fehler melden").
//   O4 (R-1664/R-2179 / K1, K2) Die Anzeige am Wissensobjekt zeigt die Angaben und Warnsignale; ohne
//                               Angaben rendert sie nichts.
import { afterEach, describe, expect, it } from "vitest";
import { createElement } from "../../apps/web/node_modules/react";
import type { NegativwissenAngaben } from "../../apps/web/src/api/types";
import { NegativwissenFuehrung } from "../../apps/web/src/components/erfassen/NegativwissenFuehrung";
import { NegativwissenAnzeige } from "../../apps/web/src/components/ko/NegativwissenAnzeige";
import {
  LEERE_NEGATIVWISSEN_FORM,
  angabenZuForm,
  formZuAngaben,
  stufeNachBezug,
  stufeWaehlbar,
} from "../../apps/web/src/lib/negativwissen";
import { renderMarkup, setLanguage } from "../../apps/web/src/test/render";

afterEach(async () => {
  await setLanguage("de");
});

const ANGABEN: NegativwissenAngaben = {
  incidentTrigger: "Begleitheizung bei Wartung abgeschaltet",
  avoidanceRule: "Begleitheizung nie ohne Freigabe abschalten.",
  earlyWarningSigns: ["Druckabfall am Morgen", "Eis an der Leitung"],
  bezug: ["personen"],
};

describe("O1 — Formular und Angaben", () => {
  it("Warnsignale je Zeile, getrimmt, ohne Leer- und Doppelwerte; leeres Formular trägt nichts", () => {
    expect(formZuAngaben(LEERE_NEGATIVWISSEN_FORM)).toBeUndefined();
    const angaben = formZuAngaben({
      ...LEERE_NEGATIVWISSEN_FORM,
      avoidanceRule: "  Nie ohne Freigabe abschalten. ",
      warnsignale: "Druckabfall\n\n  Druckabfall \nEis an der Leitung",
      bezug: ["kunden", "personen"],
    });
    expect(angaben).toEqual({
      avoidanceRule: "Nie ohne Freigabe abschalten.",
      earlyWarningSigns: ["Druckabfall", "Eis an der Leitung"],
      bezug: ["personen", "kunden"],
    });
  });

  it("ein gespeicherter Entwurf kehrt unverändert zurück", () => {
    expect(formZuAngaben(angabenZuForm(ANGABEN))).toEqual(ANGABEN);
    expect(angabenZuForm(undefined)).toEqual(LEERE_NEGATIVWISSEN_FORM);
  });
});

describe("O2 — die Stufenregel der Fläche (R-2180)", () => {
  it("Bezug hebt an, strengere Wahl bleibt, ohne Bezug unverändert", () => {
    expect(stufeNachBezug(["personen"], "intern")).toBe("vertraulich");
    expect(stufeNachBezug(["personen"], undefined)).toBe("vertraulich");
    expect(stufeNachBezug(["kunden"], "streng_vertraulich")).toBe("streng_vertraulich");
    expect(stufeNachBezug([], "intern")).toBe("intern");
    expect(stufeNachBezug([], undefined)).toBeUndefined();
    expect(stufeWaehlbar(["personen"], "intern")).toBe(false);
    expect(stufeWaehlbar(["personen"], "vertraulich")).toBe(true);
    expect(stufeWaehlbar([], "intern")).toBe(true);
  });
});

const SPRACHEN = [
  {
    lng: "de",
    titel: "Lerneffekt dokumentieren",
    warnsignale: "Welche Warnsignale gab es?",
    vermeiden: "Was sollten wir künftig vermeiden?",
  },
  {
    lng: "en",
    titel: "Document a lesson learned",
    warnsignale: "What warning signs were there?",
    vermeiden: "What should we avoid in future?",
  },
  {
    lng: "nl",
    titel: "Leereffect vastleggen",
    warnsignale: "Welke waarschuwingssignalen waren er?",
    vermeiden: "Wat moeten we in de toekomst vermijden?",
  },
] as const;

const TEXTFELDER = [
  "incidentTrigger",
  "mistakePattern",
  "impact",
  "recoveryAction",
  "avoidanceRule",
] as const;

describe.each(SPRACHEN)("O3/O4 · $lng", ({ lng, titel, warnsignale, vermeiden }) => {
  it("O3 — der geführte Block zeigt Fragen, Warnsignale und Bezüge; Bezug nennt die Stufe", async () => {
    await setLanguage(lng);
    const ohne = renderMarkup(
      createElement(NegativwissenFuehrung, { form: LEERE_NEGATIVWISSEN_FORM, onChange: () => {} }),
    );
    expect(ohne).toContain(titel);
    expect(ohne).toContain(warnsignale);
    expect(ohne).toContain(vermeiden);
    for (const feld of TEXTFELDER) {
      expect(ohne).toContain(`data-testid="negativwissen-${feld}"`);
    }
    for (const b of ["personen", "kunden", "produktion", "qualitaet"]) {
      expect(ohne).toContain(`data-testid="negativwissen-bezug-${b}"`);
    }
    expect(ohne).not.toContain("negativwissen-bezug-stufe");
    // Kein Rohschlüssel auf der Fläche (fehlende Übersetzung fiele sonst als Schlüssel auf).
    expect(ohne).not.toMatch(/negativwissen\.[a-zA-Z]/);
    const mit = renderMarkup(
      createElement(NegativwissenFuehrung, {
        form: { ...LEERE_NEGATIVWISSEN_FORM, bezug: ["personen"] },
        onChange: () => {},
      }),
    );
    expect(mit).toContain('data-testid="negativwissen-bezug-stufe"');
    expect(mit).toContain('aria-pressed="true"');
  });

  it("O4 — die Anzeige zeigt Angaben und Warnsignale; ohne Angaben nichts", async () => {
    await setLanguage(lng);
    const html = renderMarkup(createElement(NegativwissenAnzeige, { angaben: ANGABEN }));
    expect(html).toContain("Begleitheizung nie ohne Freigabe abschalten.");
    expect(html).toContain("<li>Druckabfall am Morgen</li>");
    expect(html).toContain("<li>Eis an der Leitung</li>");
    expect(html).toContain(vermeiden);
    expect(html).not.toMatch(/negativwissen\.[a-zA-Z]/);
    expect(renderMarkup(createElement(NegativwissenAnzeige, { angaben: undefined }))).toBe("");
  });
});
