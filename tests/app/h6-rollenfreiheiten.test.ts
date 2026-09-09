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
  WORT_ORDNUNG,
  eintraegeFuer,
  freiheitenSchluessel,
  kiWahlFrei,
} from "../../apps/web/src/components/einstellungen/rollenFreiheiten";
import i18n from "../../apps/web/src/i18n";
// JOB 3337: die Themen der Verwaltung werden gelesen, nicht abgeschrieben (siehe Fall 2).
import { ADMIN_SECTIONS } from "../../apps/web/src/lib/adminSections";

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
    // Der Eintrag „/admin" IST die Fläche der Einstellungen — seine Freiheiten sind ihre Themen.
    //
    // JOB 3337 (Pedi 08.09.): aus vier Behältern sind die sieben Themen der Vorlage geworden. Die
    // Erwartung wird deshalb aus `ADMIN_SECTIONS` GELESEN statt abgeschrieben — sonst stünde hier
    // eine zweite Wahrheit über die Gliederung, die beim nächsten Thema still auseinanderliefe.
    // Die Zusage bleibt: die Freiheiten des Admins sind genau die Themen seiner Fläche, in ihrer
    // Reihenfolge, ohne Dublette.
    expect(worte("admin")).toEqual(ADMIN_SECTIONS.map((abschnitt) => i18n.t(abschnitt.labelKey)));
    expect(worte("admin")).toHaveLength(new Set(worte("admin")).size);
    expect(worte("admin")[0], "die Themen kommen nicht roh, sondern übersetzt").toBe(
      "Benutzer und Rollen",
    );
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

  // ==============================================================================================
  // JOB 3416 · DIE ANDERE RICHTUNG DER ABSICHERUNG.
  // ==============================================================================================
  //
  // Fall 1 bewacht die SCHLÜSSEL von `STICHWORT_JE_EINTRAG` (jeder Eintrag hat ein Stichwort). Die
  // WERTE bewachte bisher niemand — und genau dort entstand der Schaden: `freiheitenSchluessel`
  // endet mit `WORT_ORDNUNG.filter(…)`, also fällt ein Wert, den die Ordnung nicht führt, STILL
  // heraus. Kein Fehler, kein rotes Licht, nur eine Freiheit weniger auf der Karte. So wurde bei
  // der Umbenennung der Verwaltungsthemen (JOB 3337) der Wert `adm.sec.daten` zur Leiche: fünf
  // Einträge zeigten auf einen Reiter, den es nicht mehr gab.
  //
  // Der Fall misst am IMPORTIERTEN Objekt und an der importierten Ordnung — nicht an Zeichenketten
  // im Dateitext, die auch in einem Kommentar stehen könnten (Lehre aus JOB 3401).
  it("4 NICHT STILL VERALTEN · jedes Stichwort zeigt auf einen Reiter, den es wirklich gibt", () => {
    const ordnung = new Set(WORT_ORDNUNG);
    // Kalibrierung: die Ordnung ist gefüllt — sonst wäre jeder Wert „tot" und der Fall wertlos.
    expect(ordnung.size).toBeGreaterThan(6);
    // Die Ordnung endet auf den Themen der Verwaltung; sie werden gelesen, nicht abgeschrieben.
    for (const abschnitt of ADMIN_SECTIONS) {
      expect(ordnung.has(abschnitt.labelKey), abschnitt.id).toBe(true);
    }

    const tot: string[] = [];
    for (const [id, wort] of Object.entries(STICHWORT_JE_EINTRAG)) {
      // `null` = dieser Eintrag beschreibt keine Freiheit; `@einstellungen` löst sich in die Themen
      // auf. Alles andere MUSS ein Wort sein, das die Ordnung wirklich führt.
      if (wort === null || wort === "@einstellungen" || ordnung.has(wort)) {
        continue;
      }
      tot.push(`${id} → ${wort} ist kein Reiter mehr`);
    }
    expect(
      tot,
      "totes Stichwort in STICHWORT_JE_EINTRAG: dieser Wert steht nicht in WORT_ORDNUNG und fällt " +
        "in freiheitenSchluessel() still heraus — die ROLLEN-Karte verschweigt die Freiheit, ohne " +
        'dass etwas rot wird. Erlaubt sind null, "@einstellungen" und die Wörter der Ordnung ' +
        "(zuletzt die labelKeys aus ADMIN_SECTIONS in lib/adminSections.ts).",
    ).toEqual([]);
  });
});
