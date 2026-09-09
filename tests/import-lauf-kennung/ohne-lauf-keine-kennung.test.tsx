// @vitest-environment jsdom
// ================================================================================================
// JOB 3357 · FALL 3 — KAM KEINE KENNUNG, STEHT DAS DA. KEIN STRICH, KEINE ERFINDUNG.
// ================================================================================================
//
// Der Server sendet `importId` GENAU DANN, wenn er zu dieser Übernahme wirklich einen Lauf geführt
// hat; sein eigener Kommentar an der Apply-Route sagt es wörtlich: „Fehlt sie, gibt es keinen Lauf
// — kein Platzhalter, keine erfundene Id."
//
// Der bequeme Fehler wäre, das Feld dann still wegzulassen oder ein „—" hinzuschreiben. Beides
// liest sich wie „alles in Ordnung, hier ist eben nichts", und beides ist eine Aussage, die
// niemand geprüft hat. Der ehrliche Satz benennt stattdessen genau die Tatsache: für DIESEN Aufruf
// hat der Server keinen Lauf geführt.
//
// WICHTIG UND HIER MITGEMESSEN (Auftrag §9, letzter Punkt): dieser Satz ist eine NEGATIVE Aussage
// und hängt deshalb an einer erfolgreichen Antwort. Er steht nur da, weil eine Übernahme-Antwort
// wirklich ankam und in ihr das Feld fehlte — nie nach einem Transportfehler, wo niemand weiß, was
// der Server getan hat.
//
// ARIA-HIDDEN: nicht mitgelesen, aus dem im Kopf von `buehne.tsx` genannten Grund.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", () => ({
  endpoints: { admin: { import: { group: vi.fn(), apply: vi.fn() } } },
}));
vi.mock("../../apps/web/src/api/hooks", () => ({ useImportRun: vi.fn() }));

import { ApiError } from "../../apps/web/src/api/client";
import { useImportRun } from "../../apps/web/src/api/hooks";
import i18n from "../../apps/web/src/i18n";
import { IMPORT_GROUPS_TEXT } from "../../apps/web/src/lib/importGroups";
import {
  abbauen,
  bisZurBilanz,
  flaeche,
  kennungsKnoten,
  laufAntwortStellen,
  sichtbarerText,
  sichtbarerTextVon,
  uebernahmeAntwort,
  uebernahmeDoppel,
} from "./buehne";

beforeEach(async () => {
  await i18n.changeLanguage("de");
  // Kein Lauf → der Haken darf gar nicht erst feuern; die Antwort hier ist die eines Hakens, der
  // nie eine Kennung bekommen hat.
  laufAntwortStellen({ data: undefined, isError: false, isFetching: false, isPaused: false });
});

afterEach(async () => {
  await abbauen();
  vi.clearAllMocks();
});

describe("JOB 3357 · L4 — die fehlende Kennung wird benannt, nicht kaschiert", () => {
  it("C1 · ohne importId steht der ehrliche Satz da", async () => {
    uebernahmeDoppel().mockResolvedValue(uebernahmeAntwort(undefined));
    await bisZurBilanz(1);
    expect(sichtbarerText()).toContain(i18n.t("imp.groups.runIdNone"));
  });

  it("C2 · und NICHTS, was wie eine Kennung aussieht — kein Knoten, kein Strich, kein Etikett", async () => {
    uebernahmeDoppel().mockResolvedValue(uebernahmeAntwort(undefined));
    await bisZurBilanz(1);
    const satz = i18n.t("imp.groups.runIdNone");
    // Der ehrliche Satz selbst darf keinen Strich enthalten, sonst prüfte die Zeile darunter sich
    // selbst kaputt — das ist hier ausdrücklich mitgemessen und nicht angenommen.
    expect(satz).not.toContain("—");
    // GENAU DER LAUF-BLOCK, nicht die ganze Bilanz: anderswo stehen Striche zu Recht (etwa im
    // Abzeichen „Ohne KI gruppiert — kein KI-Modell aktiv"). Ein Fall, der die ganze Fläche
    // absuchte, wäre ein Fall über fremde Texte.
    const block = flaeche().querySelector("[data-testid=imp-groups-run]");
    expect(
      block,
      "der Lauf-Block fehlt ganz — dann steht auch der ehrliche Satz nicht da",
    ).toBeTruthy();
    const ohneSatz = sichtbarerTextVon(block as Element)
      .split(satz)
      .join(" ");
    expect({
      keinKennungsKnoten: kennungsKnoten().length,
      // Kein Gedankenstrich und kein Bindestrich-Platzhalter an der Stelle der Kennung.
      keinStrich: /(^|\s)[—–-]($|\s)/.test(ohneSatz),
      // Kein Etikett „Lauf-Kennung", das auf einen leeren Platz zeigt.
      keinEtikett: ohneSatz.includes(i18n.t("imp.groups.runIdLabel")),
      // Und kein Ausgangs-Abruf: der Haken darf ohne Kennung nicht feuern (Auftrag §8.6c).
      hakenGefeuert: (useImportRun as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .length,
    }).toEqual({ keinKennungsKnoten: 0, keinStrich: false, keinEtikett: false, hakenGefeuert: 0 });
  });

  it("C3 · nach einem TRANSPORTFEHLER steht der Satz NICHT da — niemand weiß dann etwas", async () => {
    // Auftrag §9: „kein Lauf geführt" steht nur da, wenn eine ERFOLGREICHE Antwort ohne `importId`
    // vorlag. Bricht die Übertragung ab, ist der Zustand beim Server unbekannt; ein Satz, der ihn
    // behauptete, wäre eine Erfindung — und zwar die gefährlichste Sorte, weil sie beruhigt.
    uebernahmeDoppel().mockRejectedValue(
      new ApiError(502, "APPLY_FAILED", "Übertragung gescheitert"),
    );
    await bisZurBilanz(1);
    const text = sichtbarerText();
    expect({
      // Die Bilanz steht (der Lauf ist beendet), …
      bilanzDa: text.includes(i18n.t("imp.groups.bilanzTitle")),
      // … und der Fehlschlag ist ehrlich als solcher gezählt (Bestandsverhalten, unberührt).
      fehlgeschlagen: text.includes(i18n.t(IMPORT_GROUPS_TEXT.bilanzFailed, { n: 1 })),
      // Aber es wird KEINE Aussage über einen Lauf gemacht — weder positiv noch negativ.
      keineNegativaussage: text.includes(i18n.t("imp.groups.runIdNone")),
      keinKennungsKnoten: kennungsKnoten().length,
    }).toEqual({
      bilanzDa: true,
      fehlgeschlagen: true,
      keineNegativaussage: false,
      keinKennungsKnoten: 0,
    });
    // Die Fehlermeldung des Servers steht weiterhin sichtbar da — der Bestandsweg bleibt.
    expect(flaeche().textContent).toContain("Übertragung gescheitert");
  });
});
