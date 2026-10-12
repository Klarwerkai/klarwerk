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
    "demodaten.ladenAus":
      "Laden ist in diesem Betrieb ausgeschaltet. Zuständig ist der Serverbetrieb dieser Installation; hier lässt es sich nicht einschalten.",
  },
  en: {
    "demodaten.ladenAus":
      "Loading is switched off in this installation. The server operator is responsible; it cannot be switched on here.",
  },
  nl: {
    "demodaten.ladenAus":
      "Laden is in deze omgeving uitgeschakeld. De serverbeheerder is hiervoor verantwoordelijk; hier kan het niet worden ingeschakeld.",
  },
} satisfies Textmodul;
