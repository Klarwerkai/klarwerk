// @vitest-environment jsdom
// ================================================================================================
// FIRMENWÖRTERBUCH · FORMATIERUNGSGRENZEN IM EDITOR — Segmentierung UND Abgleich zusammen (K2/K3).
// ================================================================================================
//
// Bens Befund (Nacharbeit 3): an jeder Inline-Formatierung zerfiel der Text in eigene Segmente.
// „Konto <b>Plus</b>" wurde dadurch als unerwünschtes „Konto" beanstandet, obwohl „Konto Plus"
// ein zugelassenes Synonym ist, und „Kunden<b>account</b>" blieb unerkannt. Gemessen wird hier der
// GANZE Weg ohne Netz: die Segmente, die der Editor sendet (`segmenteAusHtml`), der echte Abgleich
// des Servers (`begriffsHinweise`) und die Übernahme an der Fundstelle (`hinweisUebernehmen`).
import { describe, expect, it } from "vitest";
import { hinweisUebernehmen, segmenteAusHtml } from "../../apps/web/src/lib/begriffshinweise";
import { type BegriffFassung, begriffsHinweise } from "../../services/app/src/firmenwoerterbuch";

const KONTO: BegriffFassung = {
  id: "b-konto",
  version: 1,
  geltungsbereich: "Vertrieb",
  verantwortlich: "Test",
  definition: { de: "Das Konto eines Kunden." },
  bezeichnungen: {
    de: {
      vorzug: "Kundenkonto",
      synonyme: ["Konto Plus"],
      unerwuenscht: ["Konto", "Kundenaccount"],
    },
  },
  geaendertVon: "u-1",
  geaendertAm: "2026-10-06T08:00:00.000Z",
};

describe("K3 · das zugelassene Synonym über eine Formatierungsgrenze wird nicht beanstandet", () => {
  it("„Konto <b>Plus</b>“ ergibt keinen Hinweis — das freistehende „Konto“ danach schon", () => {
    const html = "<p>Das Konto <b>Plus</b> ist gebucht; das Konto bleibt offen.</p>";
    const { hinweise } = begriffsHinweise([KONTO], segmenteAusHtml(html), "Vertrieb");
    expect(hinweise.map((h) => [h.segment, h.start, h.gefunden])).toEqual([
      [0, "Das Konto Plus ist gebucht; das ".length, "Konto"],
    ]);
  });
});

describe("K2/K4 · die unerwünschte Variante über eine Formatierungsgrenze wird erkannt und übernommen", () => {
  it("„Kunden<b>account</b>“ ergibt den Hinweis mit Vorzugsbezeichnung; Übernehmen ersetzt genau ihn", () => {
    const html = "<p>Im Kunden<b>account</b> steht <i>alles</i>.</p><p>Kundenaccount bleibt.</p>";
    const segmente = segmenteAusHtml(html);
    const { hinweise } = begriffsHinweise([KONTO], segmente, "Vertrieb");
    expect(hinweise.map((h) => [h.segment, h.gefunden, h.vorzug])).toEqual([
      [0, "Kundenaccount", "Kundenkonto"],
      [1, "Kundenaccount", "Kundenkonto"],
    ]);
    const ergebnis = hinweisUebernehmen(html, hinweise[0] as (typeof hinweise)[number], segmente);
    expect(ergebnis).toEqual({
      lage: "uebernommen",
      // Nacharbeit 4: nur der abweichende Teil wird ersetzt, dort, wo er stand — das <b> bleibt.
      html: "<p>Im Kunden<b>konto</b> steht <i>alles</i>.</p><p>Kundenaccount bleibt.</p>",
    });
  });
});
