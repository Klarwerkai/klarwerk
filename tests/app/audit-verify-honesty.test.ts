import { describe, expect, it } from "vitest";
import type { AuditVerifyReport } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { auditVerifyView } from "../../apps/web/src/lib/auditVerifyState";

// AUFTRAG-mega14 Block A-2 (bens SB-1) — die Anzeige darf keine Ursache behaupten, die der Code
// nicht kennt. Und zwar in BEIDE Richtungen: weder „Manipulation erkannt" noch „Manipulation
// ausgeschlossen". Die Kette hat keinen extern verankerten Kettenkopf; beide Aussagen wären unbelegt.

const LANGS = ["de", "en", "nl"] as const;
type Lang = (typeof LANGS)[number];

const CLEAN: AuditVerifyReport = {
  ok: true,
  count: 871,
  linkageBreaks: 0,
  payloadDeviations: 0,
  serialisationDeviations: 0,
  unresolvedDeviations: 0,
  uncheckedDeviations: 0,
};

// Der reale Befund des frischen READ-ONLY-Exports vom 25.07.2026 16:29: 871 Einträge,
// 0 Kettenbrüche, 182 Nutzdaten-Abweichungen, alle 182 durch Schlüsselumordnung aufgelöst,
// 0 unerklärt. Genau dieser Befund erzeugte bisher „Manipulation erkannt".
const LIVE_BEFUND: AuditVerifyReport = {
  ok: false,
  count: 871,
  linkageBreaks: 0,
  payloadDeviations: 182,
  serialisationDeviations: 182,
  unresolvedDeviations: 0,
  uncheckedDeviations: 0,
  firstDeviation: {
    seq: 24,
    at: "2026-07-05T18:41:57.988Z",
    action: "ask.query",
    kind: "serialisation",
  },
};

const LINKAGE_BROKEN: AuditVerifyReport = {
  ok: false,
  count: 871,
  linkageBreaks: 1,
  payloadDeviations: 0,
  serialisationDeviations: 0,
  unresolvedDeviations: 0,
  uncheckedDeviations: 0,
  firstDeviation: {
    seq: 500,
    at: "2026-07-20T08:00:00.000Z",
    action: "ko.purged",
    kind: "linkage",
  },
};

const UNRESOLVED: AuditVerifyReport = {
  ...LIVE_BEFUND,
  payloadDeviations: 183,
  serialisationDeviations: 182,
  unresolvedDeviations: 1,
  firstDeviation: {
    seq: 24,
    at: "2026-07-05T18:41:57.988Z",
    action: "ask.query",
    kind: "unresolved",
  },
};

const UNCHECKED: AuditVerifyReport = {
  ...LIVE_BEFUND,
  payloadDeviations: 183,
  serialisationDeviations: 182,
  uncheckedDeviations: 1,
  firstDeviation: {
    seq: 24,
    at: "2026-07-05T18:41:57.988Z",
    action: "ask.query",
    kind: "unchecked",
  },
};

// Genau der Weg, den Admin.tsx nimmt: Einordnung aus auditVerifyState, Text aus i18n, {{kind}}
// wird aus dem kindKey aufgelöst (kein englischer Rohbezeichner im Nutzertext).
function render(report: AuditVerifyReport, lang: Lang): string {
  const view = auditVerifyView(report);
  const kind = view.kindKey
    ? String(i18n.getResource(lang, "translation", view.kindKey))
    : undefined;
  let text = String(i18n.getResource(lang, "translation", view.key));
  const params: Record<string, string | number> = {
    ...view.params,
    ...(kind !== undefined ? { kind } : {}),
  };
  for (const [name, value] of Object.entries(params)) {
    text = text.replaceAll(`{{${name}}}`, String(value));
  }
  return text;
}

function verifyEntries(lang: Lang): [string, string][] {
  const bundle = i18n.getResourceBundle(lang, "translation") as Record<string, string>;
  return Object.entries(bundle).filter(([k]) => k.startsWith("adm.sich.verify."));
}

describe("Block A-2: die drei Anzeigezustände", () => {
  it("GRÜN — heile Kette bleibt unverändert bei adm.sich.verify.ok", () => {
    const view = auditVerifyView(CLEAN);
    expect(view.tone).toBe("ok");
    expect(view.key).toBe("adm.sich.verify.ok");
    expect(view.params).toEqual({ count: 871 });
    expect(render(CLEAN, "de")).toContain("871");
  });

  it("GELB — Verkettung lückenlos, jede Abweichung als Feldreihenfolge aufgelöst", () => {
    const view = auditVerifyView(LIVE_BEFUND);
    expect(view.tone).toBe("warn");
    expect(view.key).toBe("adm.sich.verify.serialisation");
    expect(view.params).toEqual({ count: 871, n: 182 });
    const text = render(LIVE_BEFUND, "de");
    expect(text).toContain("871");
    expect(text).toContain("182");
    // Der belegte Satz — Aussage über den BEFUND, nicht über die Vergangenheit.
    expect(text).toContain("Die vorliegenden Werte passen zum gespeicherten Hash");
    expect(text).toContain("keine Abweichung bleibt unaufgelöst");
  });

  it("ROT bei echtem Kettenbruch — nennt seq, Datum, Aktion und Art", () => {
    const view = auditVerifyView(LINKAGE_BROKEN);
    expect(view.tone).toBe("crit");
    expect(view.key).toBe("adm.sich.verify.unconfirmed");
    expect(view.kindKey).toBe("adm.sich.verify.kind.linkage");
    const text = render(LINKAGE_BROKEN, "de");
    expect(text).toContain("500");
    expect(text).toContain("2026-07-20T08:00:00.000Z");
    expect(text).toContain("ko.purged");
    expect(text).toContain("Verkettung gebrochen");
    expect(text).toContain("Die Ursache muss geprüft werden");
  });

  it("ROT bei nicht aufgelöster Abweichung — behauptet KEINE Manipulation", () => {
    const view = auditVerifyView(UNRESOLVED);
    expect(view.tone).toBe("crit");
    expect(view.kindKey).toBe("adm.sich.verify.kind.unresolved");
    const text = render(UNRESOLVED, "de");
    expect(text).toContain("nicht auflösbar");
    expect(text.toLowerCase()).not.toContain("manipulation");
  });

  it('ROT bei NICHT GEPRÜFTER Abweichung — unterscheidbar von "nicht aufgelöst"', () => {
    const view = auditVerifyView(UNCHECKED);
    expect(view.tone).toBe("crit");
    expect(view.kindKey).toBe("adm.sich.verify.kind.unchecked");
    // Die beiden Aussagen dürfen sich NICHT gleich lesen — sonst sagt die Oberfläche
    // „nicht aufgelöst", wo „nicht geprüft" richtig wäre.
    expect(render(UNCHECKED, "de")).not.toBe(render(UNRESOLVED, "de"));
    expect(render(UNCHECKED, "de")).toContain("nicht geprüft");
  });

  it("eine EINZIGE ungeklärte Abweichung kippt Gelb nach Rot", () => {
    expect(auditVerifyView(LIVE_BEFUND).tone).toBe("warn");
    expect(auditVerifyView(UNRESOLVED).tone).toBe("crit");
    expect(auditVerifyView(UNCHECKED).tone).toBe("crit");
    // Ebenso ein einziger Verkettungsbruch, selbst wenn alle Nutzdaten erklärt sind.
    expect(auditVerifyView({ ...LIVE_BEFUND, linkageBreaks: 1 }).tone).toBe("crit");
  });
});

describe('Block A-2: das Wort "Manipulation" ist getilgt — in allen drei Sprachen', () => {
  // Wörter, die dem Nutzer eine bewiesene Manipulation BEHAUPTEN würden.
  const BEHAUPTET = ["manipulation", "manipulatie", "tampering", "tamper", "gemanipuleerd"];
  // Wörter, die Manipulation AUSSCHLIESSEN würden — derselbe Fehler mit umgekehrtem Vorzeichen.
  const SCHLIESST_AUS = [
    "ausgeschlossen",
    "unverändert",
    "unversehrt",
    "beweisbar",
    "garantiert",
    "excluded",
    "unchanged",
    "provably",
    "guaranteed",
    "uitgesloten",
    "ongewijzigd",
    "gegarandeerd",
  ];

  it("es gibt die Schlüssel überhaupt (der Test läuft nicht ins Leere)", () => {
    for (const lang of LANGS) {
      expect(verifyEntries(lang).length).toBeGreaterThanOrEqual(8);
    }
  });

  it("kein adm.sich.verify.*-Text behauptet Manipulation", () => {
    for (const lang of LANGS) {
      for (const [key, text] of verifyEntries(lang)) {
        for (const wort of BEHAUPTET) {
          expect(
            text.toLowerCase(),
            `${lang} ${key}: „${wort}" gefunden — „${text}"`,
          ).not.toContain(wort);
        }
      }
    }
  });

  it("kein adm.sich.verify.*-Text schließt Manipulation aus", () => {
    for (const lang of LANGS) {
      for (const [key, text] of verifyEntries(lang)) {
        for (const wort of SCHLIESST_AUS) {
          expect(
            text.toLowerCase(),
            `${lang} ${key}: „${wort}" gefunden — „${text}"`,
          ).not.toContain(wort);
        }
      }
    }
  });

  it("der alte Schlüssel adm.sich.verify.fail existiert nicht mehr", () => {
    for (const lang of LANGS) {
      expect(verifyEntries(lang).map(([k]) => k)).not.toContain("adm.sich.verify.fail");
    }
  });

  it("alle Zustände sind in allen drei Sprachen übersetzt, ohne offene Platzhalter", () => {
    for (const lang of LANGS) {
      for (const report of [CLEAN, LIVE_BEFUND, LINKAGE_BROKEN, UNRESOLVED, UNCHECKED]) {
        const view = auditVerifyView(report);
        expect(i18n.getResource(lang, "translation", view.key)).toBeTruthy();
        if (view.kindKey) {
          expect(i18n.getResource(lang, "translation", view.kindKey)).toBeTruthy();
        }
        expect(render(report, lang)).not.toMatch(/\{\{\w+\}\}/);
      }
    }
  });
});
