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
// eingefrorenen Textschnappschuss liegt.
//
// Für die Entwurfs-Erklärung gilt: keine Beschriftung in Anführungszeichen. Der Text steht auf dem Erfassen-Blatt, und dort darf die
// Hilfe nur Beschriftungen des Blattes zitieren (R-1000) — dieselbe Regel wie in `entwurfspool.ts`.
// Nacharbeit 15 (Ben): Klara (`sec:capture.resumeTitle`, `lib/klaraRegistry.ts`) liest jetzt
// dieselbe Fassung; Seitenhilfe und Klara sagen damit dasselbe.
//
// NACHARBEIT 15 · DIE ERKLÄRUNG ZUM KONFLIKTFORMULAR. Bens Befund: `vhelp.conflictForm.body` nennt
// „drei Angaben“, das Formular verlangt aber zusätzlich die Art der Arbeit
// (`components/bibliothek/MehrAbschnitte.tsx`: „Konflikt eröffnen“ bleibt ohne Gegen-Objekt UND ohne
// Arbeitsart gesperrt; der Platzhalter ist nicht wählbar). Die neue Fassung nennt alle vier Felder mit
// ihrer angezeigten Beschriftung, sagt, welche Pflicht sind, und erklärt die drei Arbeitsarten mit den
// Sätzen aus `texte/konfliktarbeit.ts`. Umgeleitet in `lib/reviewHelp.ts`, also an der Fläche und in
// Klara dieselbe. Hier dürfen Beschriftungen zitiert werden: das Formular steht nicht auf dem Blatt.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "abschnittshilfe.",
  legacySchluessel: [],
  de: {
    "abschnittshilfe.capture.resumeTitle":
      "Hier liegen deine gespeicherten Entwürfe — alles, was du angefangen, aber noch nicht eingereicht hast. Nichts davon ist verloren. Ein Entwurf ist privat: Nur du siehst ihn, solange du ihn nicht unter Meine Entwürfe bewusst in den gemeinsamen Pool gibst, und in keiner Prüfung und keiner Antwort taucht er auf, bevor du ihn einreichst. Tippe einen Entwurf an, um weiterzuarbeiten, oder verwirf ihn, wenn er sich erledigt hat.",
    "abschnittshilfe.conflictForm.body":
      "Vier Angaben gehören zur Meldung: „Widersprechendes Objekt“ (womit widerspricht sich dieses Wissen?), „Konfliktart“, „Art der Arbeit“ und unter „Worin besteht der Widerspruch?“ eine kurze Beschreibung mit deinem Kontext. Pflicht sind das widersprechende Objekt und die Art der Arbeit — ohne beide bleibt „Konflikt eröffnen“ gesperrt. Die Art der Arbeit sagt, wie der Konflikt später entschieden wird: Einen Regelkonflikt entscheidet nur eine befugte Person, ein Sachkonflikt wird durch Belege entschieden, ein Versionskonflikt betrifft dieselbe Sache in zwei Ständen. Nach dem Absenden entsteht ein offener Konfliktfall — beide Objekte bleiben nutzbar markiert, bis der Konflikt bewusst aufgelöst ist.",
  },
  en: {
    "abschnittshilfe.capture.resumeTitle":
      "Your saved drafts are here — everything you started but have not submitted yet. None of it is lost. A draft is private: only you see it unless you deliberately share it to the common pool under My drafts, and it appears in no check and no answer before you submit it. Tap a draft to continue working on it, or discard it once it is no longer needed.",
    "abschnittshilfe.conflictForm.body":
      "Four details belong to the report: the “Contradicting object” (what does this knowledge contradict?), the “Conflict type”, the “Kind of work” and, under “What is the contradiction?”, a short description with your context. The contradicting object and the kind of work are required — without both, “Open conflict” stays locked. The kind of work says how the conflict will be decided later: a rule conflict is decided only by an authorised person, a factual conflict is settled by evidence, a version conflict concerns the same thing in two states. After sending, an open conflict case is created — both objects stay usable and marked until the conflict is consciously resolved.",
  },
  nl: {
    "abschnittshilfe.capture.resumeTitle":
      "Hier staan je opgeslagen concepten — alles wat je bent begonnen maar nog niet hebt ingediend. Niets daarvan gaat verloren. Een concept is privé: alleen jij ziet het, tenzij je het onder Mijn concepten bewust in de gemeenschappelijke pool zet, en het verschijnt in geen enkele controle en geen enkel antwoord voordat je het indient. Tik op een concept om verder te werken, of verwerp het als het niet meer nodig is.",
    "abschnittshilfe.conflictForm.body":
      "Vier gegevens horen bij de melding: het “Tegensprekend object” (waarmee spreekt deze kennis zich tegen?), de “Conflictsoort”, de “Soort werk” en onder “Waarin bestaat de tegenspraak?” een korte beschrijving met je context. Verplicht zijn het tegensprekende object en de soort werk — zonder beide blijft “Conflict openen” vergrendeld. De soort werk zegt hoe het conflict later beslist wordt: een regelconflict beslist alleen een bevoegde persoon, een inhoudelijk conflict wordt met bewijs beslist, een versieconflict gaat over dezelfde zaak in twee stadia. Na het verzenden ontstaat een open conflictgeval — beide objecten blijven bruikbaar en gemarkeerd tot het conflict bewust is opgelost.",
  },
} satisfies Textmodul;
