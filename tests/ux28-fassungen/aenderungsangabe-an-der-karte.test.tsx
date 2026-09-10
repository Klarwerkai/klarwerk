// @vitest-environment jsdom
// ================================================================================================
// JOB 3475 · UX-28 · RUNDE 2 — DIE ÄNDERUNGSANGABE, GEMESSEN AN DER KARTE STATT AN DER ABLEITUNG.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT (BEN, Runde 1, Korrekturpflicht 1): der Modultest über `versionDiffs`
// belegt die ABLEITUNG. Was ein Mensch LIEST, steht aber auf der Karte — und BEN hat genau dort
// gemessen, dass sie „Keine Änderung in den Hauptfeldern." zeigte, obwohl sich der sichtbare
// Berichtstext geändert hatte. Diese Datei schließt die Kette an der Fläche: dieselben zwei
// Fassungen, gemountet, und die Zeile, die der Leser wirklich vor sich hat.
//
// DIE ZWEI FASSUNGEN sind BENs Gegenfall: „nicht freigeben" gegen „nichtfreigeben" — sichtbarer
// Leerraum zwischen zwei Inline-Elementen, sonst nichts. Kein Zeichen der Kernaussage ändert sich.
//
// DER GEGENFALL STEHT GLEICHRANGIG DANEBEN (B): zwei wirklich gleiche Fassungen müssen weiterhin
// „Keine Änderung" sagen. Ohne ihn machte ein „immer geändert" diese Datei grün.
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import { abbauen, fassungsKnopf, flaecheMitFassungen, i18n, text } from "./flaeche";
import { fassung, netz } from "./netz";

/** Der Bericht mit sichtbarem Leerraum zwischen zwei Inline-Elementen: „nicht freigeben". */
const MIT_RAUM = "<p>Freigabe: <strong>nicht</strong> <em>freigeben</em></p>";
/** Derselbe Bericht ohne diesen Leerraum: „nichtfreigeben". */
const OHNE_RAUM = "<p>Freigabe: <strong>nicht</strong><em>freigeben</em></p>";

/** Die Karte einer Fassung — das `<li>`, in dem ihr Knopf steht. */
function karte(version: number): HTMLElement {
  const li = fassungsKnopf(version).closest("li");
  if (!li) {
    throw new Error(`Die Fassung v${version} steht in keiner Karte`);
  }
  return li;
}

afterEach(() => {
  abbauen();
});

describe("JOB 3475 · A — eine sichtbare Berichtsänderung heißt nicht „keine Änderung“", () => {
  it("die Karte nennt den ausführlichen Inhalt als geändertes Feld", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    const gelesen = text(karte(2));
    expect(
      gelesen,
      "die Karte behauptet weiterhin „Keine Änderung in den Hauptfeldern“ — genau BENs Befund",
    ).not.toContain(i18n.t("ko.snapshotNoChanges"));
    expect(gelesen, "die Karte nennt das geänderte Feld nicht").toContain(
      i18n.t("ko.snapshotField.bodyHtml"),
    );
  });

  it("die Ausgangsfassung sagt weiterhin, dass sie keinen Vorgänger hat", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: OHNE_RAUM })];
    await flaecheMitFassungen();

    expect(text(karte(1))).toContain(i18n.t("ko.snapshotInitial"));
    expect(text(karte(1)), "die Ausgangsfassung erfindet einen Vorgänger-Diff").not.toContain(
      i18n.t("ko.snapshotField.bodyHtml"),
    );
  });
});

describe("JOB 3475 · B — der Gegenfall: gleich bleibt gleich, auch auf der Karte", () => {
  it("zwei wirklich gleiche Fassungen zeigen „Keine Änderung in den Hauptfeldern“", async () => {
    netz.fassungen = [fassung(1, { bodyHtml: MIT_RAUM }), fassung(2, { bodyHtml: MIT_RAUM })];
    await flaecheMitFassungen();

    const gelesen = text(karte(2));
    expect(gelesen, "jede Fassung gilt als geändert — dann sagt die Angabe nichts mehr").toContain(
      i18n.t("ko.snapshotNoChanges"),
    );
    expect(gelesen).not.toContain(i18n.t("ko.snapshotField.bodyHtml"));
  });

  it("eine reine Einrückung im Bericht ist ebenfalls keine Änderung", async () => {
    netz.fassungen = [
      fassung(1, { bodyHtml: "<p>Erster Absatz.</p><p>Zweiter Absatz.</p>" }),
      fassung(2, { bodyHtml: "<p>Erster Absatz.</p>\n  <p>Zweiter Absatz.</p>" }),
    ];
    await flaecheMitFassungen();

    expect(text(karte(2)), "aus einer Einrückung wurde eine Inhaltsänderung").toContain(
      i18n.t("ko.snapshotNoChanges"),
    );
  });
});
