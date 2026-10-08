// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0888 / R-1017 — ABSCHNITTSERKLÄRUNGEN, DIE DER HEUTIGEN FLÄCHE FOLGEN.
// ================================================================================================
//
// Bens Befund (Nacharbeit 13): die vorhandenen Abschnittserklärungen (`shelp.*`, Berater-Lieferung
// 05.07.) erreichten bis hierher nur Klaras Suche; sie stehen jetzt in der Seitenhilfe der Fläche
// (`HelpTip`). Beim Einbinden ist jeder Text gegen die heutige Fläche gelesen worden. EINER sagt
// etwas, das seit dem gemeinsamen Entwurfspool (R-2099) nicht mehr stimmt:
//   `shelp.capture.resumeTitle` — „nichts davon sehen die Prüfer, solange du es nicht einreichst".
//   Ein Entwurf ist privat, kann aber unter Meine Entwürfe bewusst in den Pool gegeben werden; dann
//   sehen ihn alle mit Schreibrecht (`texte/entwurfspool.ts`, `entwurfspool.saveDraftHelp.body`).
// Die berichtigte Fassung steht hier unter einem NEUEN Schlüssel, weil der alte Wert im
// eingefrorenen Textschnappschuss liegt. Klara (`sec:capture.resumeTitle`) liest weiterhin den
// alten Schlüssel; das steht als Rest im Abgleichsdokument.
//
// Keine Beschriftung in Anführungszeichen: der Text steht auf dem Erfassen-Blatt, und dort darf die
// Hilfe nur Beschriftungen des Blattes zitieren (R-1000) — dieselbe Regel wie in `entwurfspool.ts`.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "abschnittshilfe.",
  legacySchluessel: [],
  de: {
    "abschnittshilfe.capture.resumeTitle":
      "Hier liegen deine gespeicherten Entwürfe — alles, was du angefangen, aber noch nicht eingereicht hast. Nichts davon ist verloren. Ein Entwurf ist privat: Nur du siehst ihn, solange du ihn nicht unter Meine Entwürfe bewusst in den gemeinsamen Pool gibst, und in keiner Prüfung und keiner Antwort taucht er auf, bevor du ihn einreichst. Tippe einen Entwurf an, um weiterzuarbeiten, oder verwirf ihn, wenn er sich erledigt hat.",
  },
  en: {
    "abschnittshilfe.capture.resumeTitle":
      "Your saved drafts are here — everything you started but have not submitted yet. None of it is lost. A draft is private: only you see it unless you deliberately share it to the common pool under My drafts, and it appears in no check and no answer before you submit it. Tap a draft to continue working on it, or discard it once it is no longer needed.",
  },
  nl: {
    "abschnittshilfe.capture.resumeTitle":
      "Hier staan je opgeslagen concepten — alles wat je bent begonnen maar nog niet hebt ingediend. Niets daarvan gaat verloren. Een concept is privé: alleen jij ziet het, tenzij je het onder Mijn concepten bewust in de gemeenschappelijke pool zet, en het verschijnt in geen enkele controle en geen enkel antwoord voordat je het indient. Tik op een concept om verder te werken, of verwerp het als het niet meer nodig is.",
  },
} satisfies Textmodul;
