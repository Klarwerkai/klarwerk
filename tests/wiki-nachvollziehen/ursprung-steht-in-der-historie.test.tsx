// @vitest-environment jsdom
// ================================================================================================
// JOB 4213 · WOHER DIESER STAND KAM — LESBAR, UND IN ALLEN DREI SPRACHEN.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Basisstand f5fe18b): die Historie zeigte je Fassung
// `koHistoryNote(h.note, t) || nameOf(h.author)` und sonst nichts, und die Fassungskarte
// `koHistoryNote(v.note, t)`. Eine Fassung konnte gar nicht sagen, aus welcher früheren sie stammt
// — es gab weder das Feld noch eine Anzeige dafür. Jeder Fall dieser Datei ist vor dieser Runde rot.
//
// RUNDE 2 · WARUM DIE HERKUNFT EIN EIGENER SATZ IST UND KEIN DIENST-VERMERK. Ein sechster fester
// Vermerk („aus früherer Fassung übernommen") bräuchte einen Eintrag in
// `apps/web/src/lib/koHistoryNote.ts`, damit er übersetzt wird — diese Datei ist NICHT Zielpfad
// dieses Auftrags, und Runde 1 ist genau daran rot geworden. Ausserdem trägt die Herkunft eine
// VERSIONSZAHL, und der Vermerkkatalog vergleicht zeichengenau: „übernommen aus v2" käme dort für
// keine Version je an. Der Vermerk bleibt deshalb „überarbeitet" (Katalog, unverändert), und die
// Herkunft steht daneben als eigener Katalogtext `ko.snapshotRestoredFrom`.
//
// WAS DIESE DATEI DESHALB MISST: dass die Herkunft ÜBERHAUPT dasteht, an BEIDEN Anzeigen, und dass
// sie übersetzt ist — der Nachweis ist die englische Lesung. Ein von Hand zusammengesetzter
// deutscher Satz stünde dort auch auf Englisch deutsch da.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import type { HistoryEntry, KoVersionSnapshot } from "../../apps/web/src/api/types";
import {
  HISTORIE,
  abbauen,
  ausloesen,
  fassungsKnopf,
  fassungsVermerk,
  flaecheMit,
  historienVermerk,
  i18n,
  text,
} from "./flaeche";
import { BERICHT_V1, dreiFassungen, ko, netz, zuruecksetzen } from "./netz";

/**
 * Die Historie eines Objekts, dessen Fassung 3 aus der Übernahme von v1 entstanden ist.
 *
 * DER VERMERK IST DERSELBE WIE AN JEDER REVISION. Unterschieden wird sie allein durch
 * `restoredFrom` — so, wie der Dienst es schreibt (`KoService.naechsteFassung`). `restoredFrom` ist
 * im Client-Typ nicht geführt (`apps/web/src/api/types.ts` ist nicht Zielpfad); der eine Leser
 * dafür ist `uebernahmeHerkunft` in `koVersionSnapshots.ts`, und dieser Fall stellt den Draht
 * deshalb so her, wie er wirklich ankommt.
 */
const HISTORIE_MIT_UEBERNAHME = [
  { version: 1, at: "2026-08-01T10:00:00.000Z", author: "u1", note: "erstellt" },
  { version: 2, at: "2026-08-02T10:00:00.000Z", author: "u1", note: "überarbeitet" },
  {
    version: 3,
    at: "2026-08-03T10:00:00.000Z",
    author: "u1",
    note: "überarbeitet",
    restoredFrom: 1,
  },
] as unknown as HistoryEntry[];

/**
 * Die abgelegte Fassung 3 — entstanden aus der Übernahme von v1. Sie trägt den Inhalt von v1 und
 * führt, wie jeder Schnappschuss, die Historie ihres eigenen Augenblicks mit; genau dort liest die
 * Fassungskarte die Herkunft (`koVersionSnapshots.ts`).
 */
const V3_UEBERNOMMEN: KoVersionSnapshot = {
  koId: "ko-1",
  version: 3,
  at: "2026-08-03T10:00:00.000Z",
  author: "u1",
  note: "überarbeitet",
  snapshot: ko({
    version: 3,
    status: "offen",
    trust: 0,
    statement: "Nur trocken abkehren.",
    measures: ["Trockenreinigung"],
    bodyHtml: BERICHT_V1,
    history: HISTORIE_MIT_UEBERNAHME,
  }),
};

beforeEach(() => {
  zuruecksetzen();
  netz.fassungen = [...dreiFassungen().slice(0, 2), V3_UEBERNOMMEN];
});

afterEach(() => {
  abbauen();
  zuruecksetzen();
});

describe("JOB 4213 · A — die Historie nennt die Fassung, aus der der Stand stammt", () => {
  it("der Vermerk steht übersetzt da, und daneben die Herkunft", async () => {
    await flaecheMit(HISTORIE, { history: HISTORIE_MIT_UEBERNAHME });
    const zeile = historienVermerk(3);
    expect(zeile, "der Historieneintrag der Fassung 3 fehlt").not.toBeNull();
    // Der Vermerk selbst bleibt unangetastet — er geht weiter durch den EINEN Katalogort.
    expect(text(zeile), "der Vermerk geht nicht durch den Katalog").toContain(
      i18n.t("ko.historyNote.revised"),
    );
    expect(text(zeile), "die Fassung, aus der der Stand stammt, steht nicht da").toContain(
      i18n.t("ko.snapshotRestoredFrom", { version: 1 }),
    );
  });

  it("eine gewöhnliche Überarbeitung behauptet KEINE Herkunft", async () => {
    await flaecheMit(HISTORIE, { history: HISTORIE_MIT_UEBERNAHME });
    const zeile = historienVermerk(2);
    expect(text(zeile)).toContain(i18n.t("ko.historyNote.revised"));
    expect(text(zeile), "eine Herkunft ohne Übernahme").not.toContain(
      i18n.t("ko.snapshotRestoredFrom", { version: 1 }),
    );
  });

  it("auf Englisch steht dort Englisch — die Herkunft läuft nicht am Katalog vorbei", async () => {
    try {
      await flaecheMit(HISTORIE, { history: HISTORIE_MIT_UEBERNAHME }, "en");
      const zeile = text(historienVermerk(3));
      expect(zeile, "das deutsche Wort steht im englischen Text").not.toContain(
        "aus Fassung v1 übernommen",
      );
      expect(zeile).toContain("restored from version v1");
      expect(zeile, "auch der Vermerk selbst muss englisch sein").toContain("revised");
    } finally {
      await i18n.changeLanguage("de");
    }
  });
});

describe("JOB 4213 · B — und dieselbe Auskunft steht an der Fassungskarte", () => {
  it("die Karte der übernommenen Fassung nennt Vermerk und Herkunft", async () => {
    await flaecheMit();
    // Der Aufklapper wird ausgelöst, damit der Fall wirklich an der gezeichneten Karte misst und
    // nicht an einem Zustand, den nur der Test kennt.
    await ausloesen(fassungsKnopf(3));
    const zeile = fassungsVermerk(3);
    expect(zeile, "die Fassungskarte trägt keinen Vermerk").not.toBeNull();
    expect(text(zeile)).toContain(i18n.t("ko.historyNote.revised"));
    expect(text(zeile), "die Herkunft fehlt an der Karte").toContain(
      i18n.t("ko.snapshotRestoredFrom", { version: 1 }),
    );
  });

  it("und an einer Fassung ohne Übernahme steht sie NICHT", async () => {
    await flaecheMit();
    await ausloesen(fassungsKnopf(2));
    expect(text(fassungsVermerk(2)), "eine Herkunft ohne Übernahme").not.toContain(
      i18n.t("ko.snapshotRestoredFrom", { version: 1 }),
    );
  });
});
