// @vitest-environment jsdom
// ================================================================================================
// BPA-05 · AKTIVE BEGLEITUNG — der erreichbare, freigegebene Vorgang im ECHTEN Produkt.
// ================================================================================================
//
// Bens Befund (Nacharbeit 2): „Im Produktcode existiert kein entsprechend markierter Vorgang; nur
// Tests erzeugen das Formular." Dieser Fall nimmt KEIN künstlich eingefügtes Formular. Gemountet
// werden der echte Router in der echten Hülle (`./produkt.tsx`). Der Weg beginnt am dokumentierten
// Einstieg der Assistenz (`/klara-vorschau`), folgt dem Link zum Prüfformular
// (`/begleitung/pruefformular`, `pages/BegleitungPruefformular.tsx`) und startet dort die
// Begleitung: Angebot, aktiver Umfang mit Endpunkt, Einheitenhinweis — und nichts geht ans Netz.
//
// GRENZE: jsdom, kein echter Chrome. Die reale Hostprobe auf diesem Mac bleibt ein eigener,
// getrennter Beleg.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  bis,
  klick,
  medienStub,
  mutationen,
  netz,
  netzStub,
  q,
  ruhe,
  tippe,
} from "../fe003-tutorial-fragen/huelle";
import { type Produkt, knopfMitText, montiereProdukt, pfFeld } from "./produkt";

const GEHEIM = ["KD-GEHEIM-4711", "PRIVAT-NOTIZ-XYZ"];
let p: Produkt | null = null;

beforeEach(async () => {
  await i18n.changeLanguage("de");
  sessionStorage.clear();
  netz.anfragen = [];
  netz.lage = { kiAktiv: false, rolle: "experte" };
  vi.stubGlobal("fetch", vi.fn(netzStub));
  medienStub();
});

afterEach(() => {
  p?.abbauen();
  p = null;
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
});

describe("K1/K6 · der freigegebene Testvorgang ist im Produkt erreichbar und begleitbar", () => {
  it("Einstieg → Prüfformular → Start mit einem Satz → Umfang/Endpunkt → Einheitenhinweis, ohne Netzwirkung", async () => {
    p = await montiereProdukt("/klara-vorschau");
    await bis(() => q(document, "klara-vorschau-zur-begleitung") !== null);
    await klick(q(document, "klara-vorschau-zur-begleitung"));
    await bis(() => q(document, "begleitung-angebot") !== null, 120);

    expect(q(document, "page-begleitung-pruefformular")).not.toBeNull();
    expect(q(document, "begleitung-angebot")?.textContent).toContain(
      "Bereich: Prüfformular Netzteil",
    );
    const vorher = netz.anfragen.length;

    const auftrag = q<HTMLInputElement>(document, "begleitung-auftrag") as HTMLInputElement;
    await tippe(auftrag, "Produktrecherche, 45 Minuten");
    await klick(knopfMitText("Begleitung starten"));
    expect(q(document, "begleitung-zustand")?.textContent).toMatch(
      /^Begleiten · Prüfformular Netzteil · bis \d\d:\d\d$/,
    );
    expect(q(document, "begleitung-status")?.textContent).toContain("Zweck: Produktrecherche");

    await tippe(pfFeld("kundennummer"), GEHEIM[0] as string);
    const notiz = document.querySelector<HTMLTextAreaElement>(
      'textarea[name="persoenliche-notiz"]',
    );
    if (notiz) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(notiz, GEHEIM[1]);
    }
    await tippe(pfFeld("leistung"), "250");
    await bis(() => q(document, "begleitung-hinweis") !== null, 160);
    expect(q(document, "begleitung-hinweis")?.textContent).toContain(
      "Im Feld „Leistung“ steht „250“ ohne Einheit. Nächster Schritt: die Einheit ergänzen (W, kW).",
    );
    expect(pfFeld("leistung").value).toBe("250");
    // Gelesen sind genau die sechs freigegebenen Felder — nie Kundennummer oder Notiz.
    expect(q(document, "begleitung-auskunft")?.textContent).toContain(": 6 gelesene Felder");

    expect(mutationen(vorher)).toEqual([]);
    const gesendet = JSON.stringify(netz.anfragen.slice(vorher));
    for (const g of GEHEIM) {
      expect(gesendet).not.toContain(g);
      expect(q(document, "begleitung-status")?.textContent).not.toContain(g);
    }
    expect(gesendet).not.toContain("Produktrecherche");
  });

  it("eine Rolle, die der Vorgang nicht zulässt, sieht das Formular, aber kein Begleitangebot", async () => {
    netz.lage = { kiAktiv: false, rolle: "admin" };
    p = await montiereProdukt("/begleitung/pruefformular");
    await bis(() => q(document, "page-begleitung-pruefformular") !== null, 120);
    await ruhe(20);
    expect(q(document, "page-begleitung-pruefformular")).not.toBeNull();
    expect(q(document, "begleitung-angebot")).toBeNull();
  });

  it("die spätere Prüfung des Formulars meldet fehlende Einheiten erst nach dem Ausfüllen", async () => {
    p = await montiereProdukt("/begleitung/pruefformular");
    await bis(() => q(document, "page-begleitung-pruefformular") !== null, 120);
    await tippe(pfFeld("leistung"), "250");
    await tippe(pfFeld("spannung"), "230 V");
    await klick(q(document, "pruefformular-pruefen"));
    expect(q(document, "pruefformular-befund-leistung")).not.toBeNull();
    expect(q(document, "pruefformular-befund-spannung")).toBeNull();
    await tippe(pfFeld("leistung"), "250 W");
    await klick(q(document, "pruefformular-pruefen"));
    expect(q(document, "pruefformular-vollstaendig")).not.toBeNull();
  });
});
