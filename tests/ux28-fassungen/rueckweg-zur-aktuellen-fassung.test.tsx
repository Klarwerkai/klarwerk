// @vitest-environment jsdom
// ================================================================================================
// JOB 3475 · UX-28 — WER EINE ALTE FASSUNG LIEST, WEISS ES UND KOMMT ZURÜCK.
// ================================================================================================
//
// EIN AUFKLAPPER OHNE RÜCKWEG UND OHNE KENNZEICHNUNG wäre die zweite Halbheit dieses Auftrags
// (§8.4): der Leser hat einen alten Bericht vor sich, der aussieht wie der aktuelle Stand, und
// findet nicht zurück. Deshalb prüft diese Datei drei Dinge zusammen:
//   A  der Rückweg ist da, benannt, in der Tab-Folge — und er klappt die Fassung wirklich zu.
//   B  im geöffneten Zustand steht, dass dies eine ALTE Fassung ist und nur lesbar.
//   C  nichts darin ist bearbeitbar: kein Eingabefeld, kein `contenteditable`, kein Absendeknopf.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import {
  abbauen,
  abschnitt,
  ausloesen,
  fassungsInhalt,
  fassungsKnopf,
  flaecheMitFassungen,
  i18n,
  rueckweg,
  tabFolge,
  text,
} from "./flaeche";
import { BERICHT_V1_TEXT, netz, zweiFassungen } from "./netz";

beforeEach(async () => {
  netz.fassungen = zweiFassungen();
  await flaecheMitFassungen();
  await ausloesen(fassungsKnopf(1));
});

afterEach(() => {
  abbauen();
});

describe("JOB 3475 · A — der Rückweg zur aktuellen Fassung", () => {
  it("steht im Baum, ist benannt und liegt in der Tabulator-Reihenfolge", () => {
    const weg = rueckweg(1);
    expect(weg, "die geöffnete Fassung bietet keinen Rückweg an").not.toBeNull();
    expect(weg?.tagName).toBe("BUTTON");
    expect(weg?.tabIndex, "der Rückweg ist mit der Tastatur nicht erreichbar").toBe(0);
    const name = weg?.getAttribute("aria-label") ?? text(weg ?? null);
    expect(name, "der Rückweg sagt nicht, wohin er führt").toContain(
      i18n.t("ko.snapshotBackToCurrent"),
    );
    expect(tabFolge().includes(weg as HTMLElement), "der Tabulator überspringt den Rückweg").toBe(
      true,
    );
  });

  it("gibt den Fokus an die Fassungskarte zurück, statt ihn zu verlieren", async () => {
    // RUNDE 2 (BEN, Prüflücke 6): der Rückweg-Knopf verschwindet mit dem Inhalt, den er zuklappt.
    // Ohne Fokusrückgabe landet der Fokus danach auf `document.body` — gemessen von BEN. Wer mit
    // der Tastatur liest, verlöre damit seinen Ort in der Liste und müsste sich neu durchtabben.
    const weg = rueckweg(1);
    (weg as HTMLElement).focus();
    expect(document.activeElement, "der Rückweg nimmt den Fokus nicht an").toBe(weg);

    await ausloesen(weg as HTMLElement);

    expect(
      document.activeElement,
      `der Fokus liegt nach dem Rückweg auf <${(document.activeElement?.tagName ?? "?").toLowerCase()}> statt auf der Fassungskarte`,
    ).toBe(fassungsKnopf(1));
  });

  it("klappt die Fassung wirklich zu — der alte Bericht ist danach weg", async () => {
    const weg = rueckweg(1);
    await ausloesen(weg as HTMLElement);

    expect(fassungsInhalt(1), "die Fassung bleibt offen").toBeNull();
    expect(fassungsKnopf(1).getAttribute("aria-expanded")).toBe("false");
    expect(text(abschnitt()), "der alte Bericht steht weiter da").not.toContain(BERICHT_V1_TEXT);
    expect(rueckweg(1), "der Rückweg bleibt stehen, obwohl nichts mehr offen ist").toBeNull();
  });
});

describe("JOB 3475 · B — es ist klar, dass hier eine ALTE Fassung steht", () => {
  it("der geöffnete Inhalt nennt Fassung und Lesbarkeit", () => {
    expect(
      text(fassungsInhalt(1)),
      "nichts sagt, dass dies eine alte, nur lesbare Fassung ist",
    ).toContain(i18n.t("ko.snapshotReadOnly", { version: 1 }));
  });

  it("die aktuelle Fassung trägt diesen Vermerk nicht als Behauptung über sich selbst", async () => {
    await ausloesen(fassungsKnopf(2));
    expect(text(fassungsInhalt(2))).toContain(i18n.t("ko.snapshotReadOnly", { version: 2 }));
    expect(
      text(fassungsInhalt(2)),
      "der Vermerk der einen Fassung steht an der anderen",
    ).not.toContain(i18n.t("ko.snapshotReadOnly", { version: 1 }));
  });
});

describe("JOB 3475 · C — nur lesbar, nicht bearbeitbar", () => {
  it("im geöffneten Inhalt gibt es kein Eingabefeld und keinen Absendeknopf", () => {
    const inhalt = fassungsInhalt(1);
    expect(inhalt).not.toBeNull();
    const bearbeitbar = [
      ...(inhalt?.querySelectorAll(
        'input, textarea, select, [contenteditable="true"], button[type="submit"]',
      ) ?? []),
    ];
    expect(
      bearbeitbar.map((e) => e.tagName),
      "der historische Inhalt sieht bearbeitbar aus",
    ).toEqual([]);
  });
});
