// ================================================================================================
// produkt:20261009:referenzki-pruefdienst (REF-02) — DIE LAUFART DER REFERENZPRÜFUNG.
// ================================================================================================
//
// `mrun.task.referenz` ist die Beschriftung der neuen Laufart `referenz` im KI-Laufprotokoll (eine
// Referenz-KI prüft, ob die genannten Fundstellen die Aussagen einer Antwort tragen). Der Name ist
// durch die Bestandsstelle in pages/Stufe2.tsx (Schlüssel „mrun.task.<Laufart>“) vorgegeben und kann
// das Präfix dieses Moduls nicht tragen — deshalb steht er ausdrücklich in `legacySchluessel`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "referenzpruefung.",
  legacySchluessel: ["mrun.task.referenz"],
  de: {
    "mrun.task.referenz": "Referenzprüfung der Quellen",
  },
  en: {
    "mrun.task.referenz": "Reference check of sources",
  },
  nl: {
    "mrun.task.referenz": "Referentiecontrole van bronnen",
  },
} satisfies Textmodul;
