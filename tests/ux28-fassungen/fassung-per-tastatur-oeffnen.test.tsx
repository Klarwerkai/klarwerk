// @vitest-environment jsdom
// ================================================================================================
// JOB 3475 · UX-28 — JEDE FASSUNG IST ERREICHBAR UND ÖFFNET IHREN VOLLSTÄNDIGEN INHALT.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (`MehrAbschnitte.tsx:1474` am Basisstand 9c3f0ce): die Karte einer
// Fassung war
//     `<li key={v.key} className="rounded-input border border-hairline bg-surface p-2.5">`
// — KEIN `button`, kein `a`, kein `onClick`, kein `tabIndex`. Damit sind Pedis zwei Befunde am Code
// belegt und nicht nur beobachtet: „Klick öffnet nichts" und „Tab überspringt die Karten"
// (PRIORITAETEN.md UX-28, N-0055/N-0057).
//
// WAS HIER GEMESSEN WIRD (und was ausdrücklich NICHT — s. Kopf von `flaeche.tsx`): dass je Fassung
// ein natives `<button type="button">` in der Tabulator-Reihenfolge des Abschnitts steht, dass es
// den Fokus annimmt, dass die AUSLÖSUNG (das Ereignis, das ein Browser an einem `<button>` aus
// Eingabe- und Leertaste erzeugt) `aria-expanded` umlegt und den gespeicherten Bericht DIESER
// Fassung in den Baum stellt. Die Umsetzung der Taste in dieses Ereignis leistet der Browser;
// jsdom leistet sie nicht, und dieser Test behauptet sie nicht.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import {
  abbauen,
  abschnitt,
  ausloesen,
  fassungsInhalt,
  fassungsKnoepfe,
  fassungsKnopf,
  flaecheMitFassungen,
  tabFolge,
  text,
} from "./flaeche";
import { BERICHT_V1_TEXT, BERICHT_V2_TEXT, netz, zweiFassungen } from "./netz";

beforeEach(async () => {
  netz.fassungen = zweiFassungen();
  await flaecheMitFassungen();
});

afterEach(() => {
  abbauen();
});

describe("JOB 3475 · A — der Tabulator erreicht jede Fassung", () => {
  it("je Fassung EIN nativer Knopf, in der Tabulator-Reihenfolge des Abschnitts", () => {
    const knoepfe = fassungsKnoepfe();
    expect(knoepfe.length, "nicht jede Fassung hat einen eigenen Knopf").toBe(2);

    const folge = tabFolge();
    for (const version of [1, 2]) {
      const knopf = fassungsKnopf(version);
      expect(knopf.tagName, `v${version} ist kein nativer Knopf`).toBe("BUTTON");
      expect(knopf.type, `v${version} ist ein Absendeknopf statt eines Schalters`).toBe("button");
      expect(knopf.disabled, `v${version} fällt über "disabled" aus der Tab-Folge`).toBe(false);
      expect(knopf.tabIndex, `v${version} liegt nicht in der Tabulator-Reihenfolge`).toBe(0);
      expect(
        folge.includes(knopf),
        `der Tabulator überspringt die Karte v${version} (Folge: ${folge.map((e) => e.tagName).join(",")})`,
      ).toBe(true);
    }
  });

  it("der Knopf nimmt den Fokus an — gemessen, nicht behauptet", () => {
    const knopf = fassungsKnopf(1);
    knopf.focus();
    expect(document.activeElement, "der Fokus landet nicht auf der Fassungskarte").toBe(knopf);
  });

  it("der zugängliche Name nennt die Fassung — zwei Karten heißen nicht gleich", () => {
    const eins = fassungsKnopf(1).getAttribute("aria-label") ?? text(fassungsKnopf(1));
    const zwei = fassungsKnopf(2).getAttribute("aria-label") ?? text(fassungsKnopf(2));
    expect(eins, "der Name nennt die Versionskennung nicht").toContain("v1");
    expect(zwei).toContain("v2");
    expect(eins, "beide Karten tragen denselben Namen").not.toBe(zwei);
  });
});

describe("JOB 3475 · B — die Auslösung öffnet den vollständigen Inhalt DIESER Fassung", () => {
  it("zugeklappt als Vorgabe: kein alter Bericht im Baum", () => {
    expect(fassungsKnopf(1).getAttribute("aria-expanded")).toBe("false");
    expect(fassungsInhalt(1), "die Fassung ist von vornherein aufgeklappt").toBeNull();
    expect(
      text(abschnitt()),
      "der alte Bericht steht schon vor dem Öffnen da — der Aufklapper trägt nichts",
    ).not.toContain(BERICHT_V1_TEXT);
  });

  it("nach der Auslösung: `aria-expanded` wechselt, der ALTE Bericht steht da", async () => {
    const knopf = fassungsKnopf(1);
    knopf.focus();
    await ausloesen(knopf);

    expect(fassungsKnopf(1).getAttribute("aria-expanded"), "`aria-expanded` wechselt nicht").toBe(
      "true",
    );
    const inhalt = fassungsInhalt(1);
    expect(inhalt, "die geöffnete Fassung hat keinen eigenen Inhaltsbereich").not.toBeNull();
    expect(text(inhalt), "der gespeicherte Bericht dieser Fassung steht nicht im Baum").toContain(
      BERICHT_V1_TEXT,
    );
    // Der Bericht kommt aus DIESEM Schnappschuss — nicht aus dem aktuellen Stand.
    expect(text(inhalt), "der Inhalt der jüngeren Fassung ist mitgekommen").not.toContain(
      BERICHT_V2_TEXT,
    );
  });

  it("die Versionskennung bleibt im geöffneten Zustand sichtbar", async () => {
    await ausloesen(fassungsKnopf(1));
    expect(text(fassungsInhalt(1)), "die geöffnete Fassung sagt nicht, WELCHE sie ist").toContain(
      "v1",
    );
  });

  it("eine Auffrischung des Abschnitts lässt den geöffneten Aufklapper OFFEN", async () => {
    await ausloesen(fassungsKnopf(1));
    const nachladen = abschnitt()?.querySelector<HTMLElement>(
      '[data-bib-nachladen="schnappschuesse"]',
    );
    expect(nachladen, "der Nachladeweg aus JOB 3430 fehlt").not.toBeNull();
    await ausloesen(nachladen as HTMLElement);

    // Abschnitt 9 des Auftrags: „Ein geöffneter Aufklapper darf durch die Auffrischung nicht
    // zufallen." Der Zustand hängt am Schlüssel `koId:version`, nicht am Kartenobjekt.
    expect(fassungsKnopf(1).getAttribute("aria-expanded"), "die Fassung ist zugefallen").toBe(
      "true",
    );
    expect(text(fassungsInhalt(1))).toContain(BERICHT_V1_TEXT);
  });

  it("die zweite Fassung bleibt davon unberührt, und ein zweites Auslösen klappt wieder zu", async () => {
    await ausloesen(fassungsKnopf(1));
    expect(fassungsInhalt(2), "die andere Fassung ist mitaufgegangen").toBeNull();
    expect(fassungsKnopf(2).getAttribute("aria-expanded")).toBe("false");

    await ausloesen(fassungsKnopf(1));
    expect(fassungsKnopf(1).getAttribute("aria-expanded")).toBe("false");
    expect(fassungsInhalt(1), "die Fassung bleibt offen").toBeNull();
    expect(text(abschnitt()), "der alte Bericht bleibt im Baum stehen").not.toContain(
      BERICHT_V1_TEXT,
    );
  });
});
