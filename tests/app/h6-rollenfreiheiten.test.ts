// ================================================================================================
// JOB 3065 H6 · DIE ROLLEN-KARTE SAGT, WAS DIE NAVIGATION HERGIBT — NICHT, WAS JEMAND MEINT.
// ================================================================================================
//
// Der Auftrag ist ausdrücklich: die Freiheiten je Rolle sind „abgeleitet aus `navigation.ts`
// (`minRole`), nicht als freier Text erfunden". Dieser Test hält genau das fest:
//
//   1 VOLLZÄHLIG — jeder bewachte Eintrag hat ein Stichwort oder ein ausdrückliches `null`. Kommt in
//     `navigation.ts` ein Eintrag hinzu, fehlt sein Stichwort und dieser Test wird rot; die Karte
//     kann also nicht still veralten (das war die Klasse „gebaut, richtig, und wirkungslos").
//   2 ABGELEITET — die Wortmenge einer Rolle entsteht aus den Einträgen mit `minRole === Rolle`.
//     Verschiebt jemand „Konflikte" auf `minRole: "experte"`, wandert das Wort mit.
//   3 KEIN VERSPRECHEN — „KI-Wahl frei" erscheint NUR bei einer Rolle, die das heutige Rollenmodell
//     dafür hergibt (der Eintrag `/admin` trägt `minRole: "admin"`). Für andere Rollen steht dort
//     nichts, kein „–", kein Versprechen (Pedi 04.09. 07:38: serverseitig ist das ein eigener Auftrag).
import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "../../apps/web/src/app/navigation";
import {
  BEWACHTE_EINTRAEGE,
  STICHWORT_JE_EINTRAG,
  eintraegeFuer,
  freiheitenSchluessel,
  kiWahlFrei,
} from "../../apps/web/src/components/einstellungen/rollenFreiheiten";
import i18n from "../../apps/web/src/i18n";

describe("JOB 3065 H6 · Rollen-Freiheiten", () => {
  it("1 VOLLZÄHLIG · jeder bewachte Navigationseintrag hat ein Stichwort oder ein ausdrückliches null", () => {
    // Kalibrierung: die Grundmenge ist überhaupt da (sonst prüfte der Fall eine leere Menge).
    expect(BEWACHTE_EINTRAEGE.length).toBeGreaterThan(15);
    const ohne = BEWACHTE_EINTRAEGE.filter((i) => !(i.id in STICHWORT_JE_EINTRAG)).map((i) => i.id);
    expect(
      ohne,
      "neuer Navigationseintrag ohne Stichwort — sonst behauptet die ROLLEN-Karte eine Freiheit, " +
        "die sie gar nicht kennt",
    ).toEqual([]);
    // Und keine Leiche: jedes Stichwort gehört zu einem Eintrag, den es wirklich gibt.
    const ids = new Set(BEWACHTE_EINTRAEGE.map((i) => i.id));
    expect(Object.keys(STICHWORT_JE_EINTRAG).filter((id) => !ids.has(id))).toEqual([]);
  });

  it("2 ABGELEITET · die Einträge je Rolle sind genau die mit minRole === Rolle", () => {
    for (const rolle of ROLES) {
      for (const id of eintraegeFuer(rolle)) {
        expect(BEWACHTE_EINTRAEGE.find((i) => i.id === id)?.minRole, id).toBe(rolle);
      }
    }
    // Jeder Eintrag gehört zu genau einer Rolle — zusammen ergeben sie die ganze Menge.
    const summe = ROLES.reduce((n, r) => n + eintraegeFuer(r).length, 0);
    expect(summe).toBe(BEWACHTE_EINTRAEGE.length);
  });

  it("2 ABGELEITET · die Wortmenge je Rolle ist die erwartete (DE, ohne Dubletten, feste Ordnung)", async () => {
    await i18n.changeLanguage("de");
    const worte = (r: Role): string[] => freiheitenSchluessel(r).map((k) => i18n.t(k));
    expect(worte("viewer")).toEqual(["fragen", "lesen"]);
    expect(worte("experte")).toEqual(["erfassen"]);
    expect(worte("controller")).toEqual(["prüfen", "Konflikte", "Duplikate"]);
    // Der Eintrag „/admin" IST die Fläche der Einstellungen — seine Freiheiten sind ihre Reiter.
    expect(worte("admin")).toEqual(["Konten", "KI", "Daten", "Sicherheit"]);
  });

  it("3 KEIN VERSPRECHEN · KI-Wahl frei gilt heute nur für den Admin", () => {
    expect(kiWahlFrei("admin")).toBe(true);
    for (const rolle of ["viewer", "experte", "controller"] as const) {
      expect(kiWahlFrei(rolle), rolle).toBe(false);
    }
  });

  it("3 KEIN VERSPRECHEN · jedes Stichwort löst sich in allen drei Sprachen auf", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      for (const rolle of ROLES) {
        for (const key of freiheitenSchluessel(rolle)) {
          const text = i18n.t(key);
          expect(text, `${lng}: ${key}`).not.toBe(key);
          expect(text.length).toBeGreaterThan(0);
        }
      }
      expect(i18n.t("einst.rollen.kiWahl")).not.toBe("einst.rollen.kiWahl");
    }
    await i18n.changeLanguage("de");
  });
});
