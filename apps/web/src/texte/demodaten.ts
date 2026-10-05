// ================================================================================================
// R-0913 · DIE DEMODATENKARTE BEI BESTÄTIGT AUSGESCHALTETEM BETRIEBSSCHALTER.
// ================================================================================================
//
// Steht der Betriebsschalter `demodaten` nachweislich auf aus, fehlt der Ladeknopf in der Karte
// „Demodaten" (`pages/AdminDatenDetails.tsx`). Dieser Satz sagt es, statt die Stelle leer zu lassen.
// Er erscheint NUR bei bestätigtem `false` — Laden, Fehler oder ein nicht genannter Schalter sind
// keine Auskunft über den Schalter und bekommen ihn nicht. Das Entfernen vorhandener Demodaten
// bleibt davon unberührt bedienbar.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "demodaten.",
  legacySchluessel: [],
  de: {
    "demodaten.ladenAus": "Laden ist in diesem Betrieb ausgeschaltet.",
  },
  en: {
    "demodaten.ladenAus": "Loading is switched off in this installation.",
  },
  nl: {
    "demodaten.ladenAus": "Laden is in deze omgeving uitgeschakeld.",
  },
} satisfies Textmodul;
