// @vitest-environment jsdom
// ================================================================================================
// JOB 3133 · UX-22 — DER WEG, DEN DER HINWEIS VERSPRICHT, FÜHRT ZUM ZIEL.
// ================================================================================================
//
// DER GEMESSENE AUSGANGSZUSTAND (Live 1.123, Codex N-0046/N-0047, am Stand 27d281e nachgelesen):
// im Abschnitt „Quellen und Belege" steht auf der Stufe `search_on_click` der Hinweis, dass eine
// Quelle ohne Adresse nur als BELEGSTELLE aus einem am Objekt hinterlegten Dokument angehängt
// werden darf (`ext.gate.unanchored`). Genau diesen Weg bietet das Formular nicht an: es kennt nur
// Bezeichnung, Adresse und Auszug (`MehrAbschnitte.tsx:598-614`). Und der Knopf darunter prüft die
// Sperre NICHT (`:622-628`) — ein Klick löst die unzulässige Aktion aus, der Server antwortet 403,
// und der Nutzer liest eine zweite Ablehnung.
//
// WAS HIER GEMESSEN WIRD: die echte Fläche über die echte HTTP-Grenze (s. `flaeche.tsx`). Ein
// „Aufruf" ist eine wirkliche `fetch`-Anfrage, sein Rumpf der wirklich gesendete. Ein Auswahlfeld,
// dessen Wahl nicht im Rumpf landet, besteht diesen Fall nicht.
//
// ZUR REIHENFOLGE (Abweichung von der wörtlichen Lesart des Auftrags §6.3): die Bezeichnung wird
// SCHON VOR (a) getippt. Ohne sie ist der Knopf über `isSourceFormValid` ohnehin `disabled` und
// löste auch HEUTE keinen Aufruf aus — (a) wäre dann keine rote Messung, sondern eine Tautologie,
// und (d) („per Tab erreichbar") gäbe es nicht zu messen. Der Auftrag verlangt für (a) ausdrücklich
// „Heute rot: genau ein Aufruf"; genau dieser Zustand ist hier hergestellt.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act } from "../../apps/web/node_modules/react";
import i18n from "../../apps/web/src/i18n";
import { SOURCE_ATTACH_HINT_KEYS } from "../../apps/web/src/lib/externalAttachGate";
import {
  type Anfrage,
  KO_ID,
  type Prüfstand,
  anhangAuswahl,
  ankerAnhang,
  ausloesen,
  feldMitPlatzhalter,
  knopfMitText,
  knowledgeObject,
  montieren,
  quellenAbschnitt,
  text,
  tippen,
  waehlen,
} from "./flaeche";

const ANHANG_NAME = "Vertrag.pdf";
const ANHANG_OBJEKT = "obj-1";
const BEZEICHNUNG = "Seite 4";

let stand: Prüfstand;

/** Nur die Anfragen, die WIRKLICH eine Quelle anhängen wollten. */
const anhaengeRufe = (anfragen: Anfrage[]): Anfrage[] =>
  anfragen.filter(
    (a) =>
      a.method === "PUT" &&
      a.pfad === `/api/kos/${KO_ID}` &&
      (a.rumpf as { action?: string } | undefined)?.action === "add-source",
  );

const sperrhinweis = (): HTMLElement | null =>
  quellenAbschnitt(stand.container).querySelector("output");

beforeEach(async () => {
  await i18n.changeLanguage("de");
  stand = await montieren(
    knowledgeObject([ankerAnhang("att-1", ANHANG_NAME, ANHANG_OBJEKT)]),
    "search_on_click",
  );
});

afterEach(() => {
  stand.abbauen();
});

describe("JOB 3133 · UX-22 — die erlaubte eigene Belegstelle lässt sich wirklich zuordnen", () => {
  it("V0 · KALIBRIERUNG: das echte Formular steht offen, die Stufe ist geladen, der Grund ist da", async () => {
    // Ohne diese Zeilen misst alles Weitere ein leeres Blatt.
    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel"))).toBeTruthy();
    expect(knopfMitText(stand.container, i18n.t("ko.sourceAdd"))).toBeTruthy();
    // Die Stufe kam über die ECHTE Grenze — der Abruf steht im Spion.
    expect(stand.anfragen.some((a) => a.pfad === "/api/external/policy")).toBe(true);
    const grund = sperrhinweis();
    expect(grund, "der Sperrgrund fehlt — dann gäbe es nichts einzulösen").not.toBeNull();
    expect(text(grund as HTMLElement)).toContain(i18n.t(SOURCE_ATTACH_HINT_KEYS.unanchored.body));
  });

  it("a · mit Bezeichnung, ohne Auswahl: der Grund steht, und der Knopf löst KEINEN Aufruf aus", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    expect(sperrhinweis(), "ohne Anker muss der Grund stehen bleiben").not.toBeNull();

    const knopf = knopfMitText(stand.container, i18n.t("ko.sourceAdd"));
    await ausloesen(knopf);
    expect(
      anhaengeRufe(stand.anfragen).length,
      "die gesperrte Aktion wurde trotzdem abgesetzt",
    ).toBe(0);
  });

  it("b · Anhang wählen → der Sperrhinweis ist weg, weil der Server jetzt annehmen wird", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    const auswahl = anhangAuswahl(stand.container);
    expect(auswahl, "es gibt kein Auswahlfeld über die Anhänge dieses Objekts").not.toBeNull();
    // Der Optionstext ist der Dateiname aus den Daten — kein übersetzter Text (Lieferung 5).
    const optionen = [...(auswahl as HTMLSelectElement).options].map((o) => o.textContent);
    expect(optionen).toEqual(["—", ANHANG_NAME]);
    expect([...(auswahl as HTMLSelectElement).options].map((o) => o.value)).toEqual([
      "",
      ANHANG_OBJEKT,
    ]);

    await waehlen(auswahl as HTMLSelectElement, ANHANG_OBJEKT);
    expect(sperrhinweis(), "der Grund steht noch da, obwohl der Anker steht").toBeNull();
  });

  it("c · absenden: GENAU EIN Aufruf, und sein Rumpf trägt den Anker", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);

    await ausloesen(knopfMitText(stand.container, i18n.t("ko.sourceAdd")));

    const rufe = anhaengeRufe(stand.anfragen);
    expect(rufe.length, `add-source-Aufrufe: ${rufe.length}`).toBe(1);
    const rumpf = rufe[0]?.rumpf as { source?: Record<string, unknown> };
    // Genau das Feld, das `ko-routes.ts:1926-1930` gegen die eigene Anhangsliste nachschlägt.
    expect(rumpf.source?.objectId).toBe(ANHANG_OBJEKT);
    expect(rumpf.source?.label).toBe(BEZEICHNUNG);
    // Lieferung 8: KEINE Herkunftsbehauptung. Die Herkunft leitet allein der Server ab.
    expect(rumpf.source).not.toHaveProperty("provider");
    // Und kein leeres Adressfeld — weglassen ist die ehrliche Form.
    expect(rumpf.source).not.toHaveProperty("url");
  });

  it("c2 · nach dem Erfolg ist die Auswahl mit dem übrigen Formular zurückgesetzt", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);
    await ausloesen(knopfMitText(stand.container, i18n.t("ko.sourceAdd")));

    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")).value).toBe("");
    expect((anhangAuswahl(stand.container) as HTMLSelectElement).value).toBe("");
    // …und der Grund steht wieder da, weil die Sperre wieder gilt.
    expect(sperrhinweis()).not.toBeNull();
  });

  it("c3 · eine getippte Bezeichnung wird von der Auswahl NICHT überschrieben, eine leere schon", async () => {
    // Leer → der Dateiname belegt vor (Lieferung 5).
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);
    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")).value).toBe(ANHANG_NAME);

    // Zurück auf „keine Auswahl", eigene Bezeichnung tippen, erneut wählen.
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, "");
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);
    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")).value).toBe(BEZEICHNUNG);
  });

  it("e · verschwindet der gewählte Anhang, fällt die Vorhersage auf GESPERRT zurück", async () => {
    // Der gewählte Anhang kann unter dem offenen Formular verschwinden — Abschnitt 12 desselben
    // Bauteils kann ihn löschen. Die Kennung bleibt dann im Formularzustand stehen, aber das
    // geladene Objekt trägt sie nicht mehr. Weil `sourceAnkerGueltig` gegen die LISTE prüft und
    // nicht gegen das Feld, kippt die Vorhersage auf „gesperrt" — genau das Urteil, das der Server
    // gleich darauf fällte (ko-routes.ts:1926-1930). Fail-closed bleibt fail-closed.
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);
    expect(sperrhinweis(), "Vorbedingung: mit gültigem Anker steht kein Grund").toBeNull();

    await stand.mitObjekt(knowledgeObject([]));

    expect(
      sperrhinweis(),
      "der Anker zeigt ins Leere — der Grund muss zurückkommen",
    ).not.toBeNull();
    const knopf = knopfMitText(stand.container, i18n.t("ko.sourceAdd"));
    expect(knopf.getAttribute("aria-disabled")).toBe("true");
    await ausloesen(knopf);
    expect(
      anhaengeRufe(stand.anfragen).length,
      "ein Anker ins Leere wurde trotzdem abgesetzt",
    ).toBe(0);
  });

  it("d · in Zustand (a) bleibt der Knopf in der Tab-Folge, behält den Fokus und nennt den Grund", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), BEZEICHNUNG);
    const knopf = knopfMitText(stand.container, i18n.t("ko.sourceAdd"));

    // JOB-3126-Lehre: `disabled` hätte ihn aus der Tabulator-Reihenfolge geworfen — und der Nutzer
    // verlöre mitten im Ausfüllen seinen Ort, ohne den Grund je zu erreichen.
    expect(knopf.disabled, "der Knopf ist hart abgeschaltet statt aria-disabled").toBe(false);
    expect(knopf.tabIndex).toBe(0);
    expect(knopf.getAttribute("aria-disabled")).toBe("true");
    act(() => knopf.focus());
    expect(document.activeElement, "der Knopf nimmt den Fokus nicht an").toBe(knopf);

    // Ein ausgegrauter Knopf ohne verbundenen Grund ist eine Sackgasse (externalAttachGate.ts:9-12).
    const beschrieben = knopf.getAttribute("aria-describedby");
    expect(beschrieben, "kein aria-describedby am gesperrten Knopf").toBeTruthy();
    const grund = stand.container.querySelector(`[id="${beschrieben}"]`);
    expect(grund, "aria-describedby zeigt ins Leere").not.toBeNull();
    expect(text(grund as HTMLElement)).toContain(i18n.t(SOURCE_ATTACH_HINT_KEYS.unanchored.body));

    // Und mit Anker verschwindet die Sperre am Knopf ebenso wie der Grund.
    await waehlen(anhangAuswahl(stand.container) as HTMLSelectElement, ANHANG_OBJEKT);
    const jetzt = knopfMitText(stand.container, i18n.t("ko.sourceAdd"));
    expect(jetzt.getAttribute("aria-disabled")).toBe("false");
    expect(jetzt.getAttribute("aria-describedby")).toBeNull();
  });
});
