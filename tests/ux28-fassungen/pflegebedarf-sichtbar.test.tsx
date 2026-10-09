// @vitest-environment jsdom
// ================================================================================================
// R-1749 (aufnahme:20260922:gesamt-wissen-versionen) — „Versionen/Revisionen/Pflegebedarf sichtbar".
// ================================================================================================
//
// BESTANDSABGLEICH, KEIN NEUBAU: der Pflegebedarf eines Eintrags ist im Produkt die Ableitung
// `validityProtectionView` (`lib/extConcept.ts`, SCRUM-95/96) — meldet der Lebenszyklus das Objekt
// als fällig (`GET /lifecycle/pending`), heißt die Zeile „Aktualität" im Abschnitt „Belege"
// „Revalidierung fällig". Die ABLEITUNG ist in `tests/library/ext-concept.test.ts` gemessen; was
// fehlte, ist der Beleg an der gemounteten Fläche. Versionen und Revisionen mit vN messen die
// übrigen Dateien dieses Ordners an den Fassungskarten.
//
// DER GEGENFALL STEHT DANEBEN: ohne Meldung des Lebenszyklus steht dort NICHT „Revalidierung fällig".
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/endpoints", async () => (await import("./netz")).endpointsDoppel());
vi.mock("../../apps/web/src/api/auth", async () => (await import("./netz")).authDoppel());

import { act } from "../../apps/web/node_modules/react";
import { abbauen, abschnitt, flaecheMitFassungen, flush, i18n, text } from "./flaeche";
import { netz, zweiFassungen } from "./netz";

/** Einen weiteren Abschnitt derselben Fläche von Hand aufklappen — wie `abschnittOeffnen`. */
async function oeffne(schluessel: string): Promise<HTMLDetailsElement> {
  expect(abschnitt(), "die Fläche steht nicht").not.toBeNull();
  const selektor = `[data-bib-abschnitt="${schluessel}"]`;
  const d = document.body.querySelector<HTMLDetailsElement>(selektor);
  if (!d) {
    throw new Error(`Abschnitt „${schluessel}" fehlt auf der Fläche`);
  }
  await act(async () => {
    d.open = true;
    d.dispatchEvent(new Event("toggle"));
    await flush();
  });
  await act(flush);
  return d;
}

/** Der Wert der Zeile „Aktualität" im Abschnitt „Belege". */
function aktualitaet(belege: HTMLElement): string {
  const titel = i18n.t("ext.validity.freshness");
  const zeile = [...belege.querySelectorAll("dl > div")].find(
    (z) => text(z.querySelector("dt")) === titel,
  );
  if (!zeile) {
    throw new Error(`die Zeile „${titel}" fehlt; Abschnitt: ${text(belege)}`);
  }
  return text(zeile.querySelector("dd"));
}

afterEach(() => {
  abbauen();
  netz.pflege = [];
});

describe("R-1749 · Pflegebedarf an der Lesefläche", () => {
  it("meldet der Lebenszyklus den Eintrag, steht „Revalidierung fällig“ da", async () => {
    netz.fassungen = zweiFassungen();
    netz.pflege = ["ko-1"];
    await flaecheMitFassungen();
    const belege = await oeffne("belege");
    expect(aktualitaet(belege)).toBe(i18n.t("ext.freshness.revalidierung-faellig"));
  });

  it("Gegenfall: ohne Meldung steht dort kein Pflegebedarf", async () => {
    netz.fassungen = zweiFassungen();
    await flaecheMitFassungen();
    const belege = await oeffne("belege");
    expect(aktualitaet(belege)).not.toBe(i18n.t("ext.freshness.revalidierung-faellig"));
  });
});
