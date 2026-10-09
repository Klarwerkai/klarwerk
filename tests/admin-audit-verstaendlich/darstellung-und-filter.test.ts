// ================================================================================================
// produkt:20261009:admin-audit-verstaendlich (ADMIN-03) — DIE DARSTELLUNGSREGELN, OHNE DOM.
// ================================================================================================
//
// Was `lib/auditEventDetail.ts`, `lib/auditFilter.ts` und `lib/adminForms.ts` über einen Eintrag
// sagen, bevor irgendetwas gerendert wird. Alle Namen und Kennungen sind erfunden.
//
//   K1 · bekannt (Name), System, Dienstzugang, entfernt, nicht auflösbar — je als solche erkennbar;
//        gleiche Namen bleiben über die Kennung unterscheidbar.
//   K2 · Kontovorgänge haben einen Namen; die Liste der Auth-Ansicht deckt jeden Schreibweg.
//   K3 · ein HEUTE aufgelöster Name ist als solcher gekennzeichnet, nie als gespeicherter.
//   K4 · Filterwerte → kombinierte Seitenanfrage; Kalendertage → Zeitraum; Zeit mit Zeitzone.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { KONTO_AUDIT_AKTIONEN } from "../../apps/web/src/lib/adminForms";
import { auditActionLabel } from "../../apps/web/src/lib/auditAction";
import {
  type AuditEreignis,
  type VerzeichnisLage,
  auditEventDetail,
  mehrdeutigeNamen,
  protokollNamen,
} from "../../apps/web/src/lib/auditEventDetail";
import {
  LEERE_AUDIT_FILTER,
  auditAnfrage,
  tagesbeginnIso,
  zeitpunktMitZone,
  zeitraumVerkehrt,
} from "../../apps/web/src/lib/auditFilter";
import { auditInhaltsfelder } from "../../services/app/src/audit-sicht";
import { repoPfad } from "../support/repoPfad";

const FRISCH = (namen: Record<string, string>): VerzeichnisLage => ({
  art: "geladen",
  namen: new Map(Object.entries(namen)),
  stand: "frisch",
});

const VERZEICHNIS = FRISCH({ "u-anna-1": "Anna Meier", "u-anna-2": "Anna Meier", "u-ben": "Ben" });

const ereignis = (teil: Partial<AuditEreignis>): AuditEreignis => ({
  action: "auth.login",
  actor: "u-ben",
  target: "u-ben",
  payload: {},
  ...teil,
});

const akteur = (
  e: AuditEreignis,
  lage: VerzeichnisLage = VERZEICHNIS,
  protokoll: ReadonlyMap<string, string> = new Map(),
) => auditEventDetail(e, lage, protokoll)[0];

describe("K1/K3 · wer gehandelt hat — und woher der Name stammt", () => {
  it("bekannter Akteur ohne gespeicherten Namen: Name aus dem Verzeichnis, als HEUTIGER gekennzeichnet", () => {
    expect(akteur(ereignis({}))).toMatchObject({
      kind: "text",
      value: "Ben",
      id: "u-ben",
      herkunft: "verzeichnis",
    });
  });

  it("gespeicherter Name schlägt das Verzeichnis und ist als gespeichert gekennzeichnet", () => {
    const e = ereignis({ payload: { actorName: "Ben (Name von damals)" } });
    expect(akteur(e)).toMatchObject({ value: "Ben (Name von damals)", herkunft: "gespeichert" });
  });

  it("System und Dienstzugang sind keine Konten — und nie „Konto nicht mehr vorhanden“", () => {
    expect(akteur(ereignis({ actor: "system" }))).toEqual({
      labelKey: "audit.detail.actor",
      kind: "text",
      valueKey: "audit.detail.systemActor",
    });
    const dienst = akteur(ereignis({ actor: "dienst:wiki-sync" }));
    expect(dienst).toMatchObject({
      kind: "text",
      valueKey: "auditprotokoll.akteur.dienst",
      id: "dienst:wiki-sync",
    });
    expect(dienst?.hinweisKey).toBeUndefined();
    for (const sprache of ["de", "en", "nl"] as const) {
      expect(i18n.getResource(sprache, "translation", "auditprotokoll.akteur.dienst")).toBeTruthy();
    }
  });

  it("entferntes Konto: mit dem Namen, den die Kette gespeichert hat, als solcher gekennzeichnet", () => {
    const loeschung = ereignis({
      action: "user.delete",
      actor: "u-admin",
      target: "u-gerd",
      payload: { targetName: "Gerd (fiktiv)", actorName: "Ada (fiktiv)" },
    });
    const protokoll = protokollNamen([loeschung]);
    const spaeter = akteur(ereignis({ actor: "u-gerd", target: "u-gerd" }), VERZEICHNIS, protokoll);
    expect(spaeter).toMatchObject({
      kind: "text",
      value: "Gerd (fiktiv)",
      herkunft: "protokoll",
      hinweisKey: "audit.detail.accountGone",
    });
  });

  it("unbekannter Akteur ohne jeden Namen: Kennung mit Grund — nie ein fremder heutiger Name", () => {
    const frisch = akteur(ereignis({ actor: "u-unbekannt", target: "u-unbekannt" }));
    expect(frisch).toMatchObject({ kind: "id", id: "u-unbekannt" });
    expect(frisch?.value).toBeUndefined();
    // Ohne belastbares Verzeichnis: nur die schwache Aussage über den Abruf.
    const ohne = akteur(ereignis({ actor: "u-unbekannt" }), { art: "nichtAbrufbar" });
    expect(ohne).toMatchObject({ kind: "id", hinweisKey: "audit.detail.nameUnavailable" });
  });

  it("mehrdeutige Namen werden erkannt — über Verzeichnis und Kette hinweg, nur über die Kennung", () => {
    const geladen = VERZEICHNIS.art === "geladen" ? VERZEICHNIS.namen : new Map<string, string>();
    expect([...mehrdeutigeNamen(geladen)]).toEqual(["Anna Meier"]);
    // Ein gespeicherter Name, der einen heutigen Namen einer ANDEREN Kennung trägt, ist mehrdeutig.
    const kette = new Map([["u-alt", "Ben"]]);
    expect([...mehrdeutigeNamen(geladen, kette)].sort()).toEqual(["Anna Meier", "Ben"]);
    // Dieselbe Kennung mit demselben Namen in beiden Quellen ist NICHT mehrdeutig.
    const ben = new Map([["u-ben", "Ben"]]);
    expect([...mehrdeutigeNamen(ben, ben)]).toEqual([]);
  });
});

describe("K2 · Vorgänge in verständlicher Sprache", () => {
  it("Beitragsänderung, Rollenänderung und Anmeldung haben in DE/EN/NL einen Namen", async () => {
    for (const sprache of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      for (const code of ["ko.revised", "user.role-change", "auth.login"]) {
        const name = auditActionLabel(code, i18n.t);
        expect(name, `${sprache} ${code}`).not.toBe(code);
        expect(name, `${sprache} ${code}`).not.toBe(code.replace(/[._-]/g, " "));
      }
    }
    await i18n.changeLanguage("de");
  });

  it("jeder Kontovorgang der Auth-Ansicht hat einen Namen, und die Liste deckt den Schreibweg", async () => {
    // Abschließend aus dem Schreibweg gelesen: jede „auth.*“/„user.*“-Aktion, die der Kontodienst
    // schreibt, steht in der Liste — sonst fehlte sie still in der Auth-Ansicht.
    const quelle = readFileSync(repoPfad("services/auth/src/service.ts"), "utf8");
    const geschrieben = new Set(
      [...quelle.matchAll(/"((?:auth|user)\.[a-z-]+)"/g)].map((m) => m[1] ?? ""),
    );
    expect(geschrieben.size, "der Griff greift ins Leere").toBeGreaterThan(10);
    expect([...geschrieben].filter((a) => !KONTO_AUDIT_AKTIONEN.includes(a))).toEqual([]);
    for (const sprache of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(sprache);
      const ohneNamen = KONTO_AUDIT_AKTIONEN.filter(
        (code) => auditActionLabel(code, i18n.t) === code.replace(/[._-]/g, " ").trim(),
      );
      expect(ohneNamen, `${sprache}: Kontovorgänge ohne Namen`).toEqual([]);
    }
    await i18n.changeLanguage("de");
  });
});

describe("K4 · Filterwerte, Zeitraum und Zeitzone", () => {
  it("leere Filter ergeben eine Anfrage ohne Filter; gesetzte werden kombiniert", () => {
    expect(auditAnfrage(LEERE_AUDIT_FILTER, undefined)).toEqual({});
    const anfrage = auditAnfrage(
      { person: "u-ben", aktion: "ko.revised", ziel: "ko-7", von: "2026-10-01", bis: "2026-10-09" },
      42,
    );
    expect(anfrage).toEqual({
      actor: "u-ben",
      action: "ko.revised",
      target: "ko-7",
      from: new Date(2026, 9, 1).toISOString(),
      // „bis“ ist einschließlich: die Anfrage endet am Beginn des Folgetags.
      to: new Date(2026, 9, 10).toISOString(),
      before: 42,
    });
  });

  it("Kalendertage: unlesbar heißt kein Zeitraum; verkehrt wird erkannt", () => {
    expect(tagesbeginnIso("09.10.2026")).toBeUndefined();
    expect(tagesbeginnIso("")).toBeUndefined();
    expect(zeitraumVerkehrt({ von: "2026-10-09", bis: "2026-10-01" })).toBe(true);
    expect(zeitraumVerkehrt({ von: "2026-10-01", bis: "2026-10-01" })).toBe(false);
    expect(zeitraumVerkehrt({ von: "", bis: "2026-10-01" })).toBe(false);
  });

  it("der Zeitpunkt trägt seine Zeitzone — 08:00 UTC ist am 9. Oktober 10:00 MESZ", () => {
    const de = zeitpunktMitZone("2026-10-09T08:00:00.000Z", "de", "Europe/Berlin");
    expect(de).toContain("10:00:00");
    expect(de).toContain("MESZ");
    const en = zeitpunktMitZone("2026-10-09T08:00:00.000Z", "en", "UTC");
    expect(en).toContain("UTC");
    // Ein unlesbarer Wert wird nicht erfunden, sondern bleibt, wie er gespeichert ist.
    expect(zeitpunktMitZone("kein-zeitpunkt", "de")).toBe("kein-zeitpunkt");
  });
});

describe("K5 · welche Nutzlastfelder Inhalt eines Objekts sind", () => {
  it("Titelkopien und Metadatenwechsel zählen als Inhalt, Kennungen und Zähler nicht", () => {
    expect(
      auditInhaltsfelder({
        action: "answer.not_helpful",
        payload: { koTitle: "x", koAuthor: "u" },
      }),
    ).toEqual(["koTitle"]);
    expect(
      auditInhaltsfelder({ action: "ko.category-changed", payload: { vorher: "a", nachher: "b" } }),
    ).toEqual(["vorher", "nachher"]);
    expect(auditInhaltsfelder({ action: "ko.revised", payload: { version: 3 } })).toEqual([]);
    // Ein künftiger Eintrag mit Titelfeld fällt nicht still durch.
    expect(auditInhaltsfelder({ action: "ko.neu", payload: { title: "y" } })).toEqual(["title"]);
  });
});
