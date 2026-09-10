// @vitest-environment jsdom
// ================================================================================================
// JOB 3475 · UX-28 — FEHLT DER HISTORISCHE INHALT, WIRD ER BENANNT UND NICHT ERSETZT.
// ================================================================================================
//
// WARUM DIESER FALL DER WICHTIGSTE DIESES AUFTRAGS IST: der naheliegende Weg, eine „vollständige"
// alte Fassung zu zeigen, wäre, bei fehlendem Bericht den Bericht der jüngsten Fassung einzusetzen
// — er sieht vollständig aus und ist eine Erfindung. „Wissenslücke statt Erfindung" (REGELN §7) und
// Abschnitt 9 des Auftrags verlangen das Gegenteil: der Satz sagt, dass FÜR DIESE FASSUNG nichts
// gespeichert ist — nicht, dass der Bericht leer WAR, und schon gar nicht den Inhalt einer anderen.
//
// Gemessen wird an zwei Fassungen: v1 OHNE gespeicherten Bericht (`bodyHtml: null`, wie der Draht es
// liefert — `api/types.ts:337`) und v2 MIT Bericht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import {
  abbauen,
  ausloesen,
  fassungsInhalt,
  fassungsKnopf,
  flaecheMitFassungen,
  i18n,
  text,
} from "./flaeche";
import { BERICHT_V2, BERICHT_V2_TEXT, fassung, netz } from "./netz";

beforeEach(async () => {
  netz.fassungen = [fassung(1, { bodyHtml: null }), fassung(2, { bodyHtml: BERICHT_V2 })];
  await flaecheMitFassungen();
});

afterEach(() => {
  abbauen();
});

describe("JOB 3475 · A — die Fassung ohne gespeicherten Bericht", () => {
  it("ist erreichbar wie jede andere — kein stummes Element, keine Sackgasse", () => {
    const knopf = fassungsKnopf(1);
    expect(knopf.tabIndex, "die Fassung ohne Bericht fällt aus der Tab-Folge").toBe(0);
    expect(knopf.disabled).toBe(false);
    expect(knopf.getAttribute("aria-disabled"), "der Weg ist gesperrt statt ehrlich").not.toBe(
      "true",
    );
  });

  it("sagt geöffnet, dass FÜR DIESE FASSUNG nichts gespeichert ist", async () => {
    await ausloesen(fassungsKnopf(1));
    const inhalt = fassungsInhalt(1);
    expect(inhalt, "die Fassung öffnet nicht").not.toBeNull();
    expect(text(inhalt), "der ehrliche Satz fehlt").toContain(i18n.t("ko.snapshotBodyMissing"));
  });

  it("setzt NICHTS aus einer anderen Fassung ein (Gegenprobe gegen Rekonstruktion)", async () => {
    await ausloesen(fassungsKnopf(1));
    const inhalt = fassungsInhalt(1);
    expect(
      text(inhalt),
      "der Bericht der jüngeren Fassung steht in der Fassung ohne Bericht",
    ).not.toContain(BERICHT_V2_TEXT);
    expect(
      inhalt?.querySelector("p, div, span") !== null,
      "die geöffnete Fassung ist ganz leer — sie sagt gar nichts",
    ).toBe(true);
  });

  it("behauptet zugeklappt keine Berichtsgröße, die es nicht gibt", () => {
    const karte = fassungsKnopf(1).closest("li");
    expect(
      text(karte),
      "die Fassung ohne Bericht trägt die gemessene Größe der anderen Fassung",
    ).not.toContain(i18n.t("ko.snapshotBodyChars", { anzahl: String(BERICHT_V2_TEXT.length) }));
  });
});

describe("JOB 3475 · B — die Fassung MIT Bericht sagt den Satz nicht", () => {
  it("zeigt den Bericht, nicht den Leersatz", async () => {
    await ausloesen(fassungsKnopf(2));
    const inhalt = fassungsInhalt(2);
    expect(text(inhalt)).toContain(BERICHT_V2_TEXT);
    expect(
      text(inhalt),
      "der Leersatz steht an einer Fassung, die einen Bericht hat",
    ).not.toContain(i18n.t("ko.snapshotBodyMissing"));
  });

  it("die gemessene Größe steht an der Fassung, die den Bericht wirklich hat", () => {
    const karte = fassungsKnopf(2).closest("li");
    expect(text(karte), "die gemessene Berichtsgröße fehlt").toContain(
      i18n.t("ko.snapshotBodyChars", { anzahl: String(BERICHT_V2_TEXT.length) }),
    );
  });
});
