// ================================================================================================
// R-0936 · INHALTSQUALITÄT IM STUDIO — die Sätze der Tragfähigkeitsanzeige, bei ihrer Funktion.
// ================================================================================================
//
// R-0936: „Eine ruhige Anzeige sagt, wie tragfähig der Text gerade ist und was ihn besser machen
// würde — ohne Punkte und ohne Wertung der Person." Die Anzeige selbst gibt es seit SCRUM-353
// (`components/StudioContributionPanel.tsx`); ihre bisherigen Sätze sprachen aber die Person an
// („Guter Anfang.", „Dein Beitrag", „Dein Erfahrungswissen zählt"). Diese Sätze beschreiben
// ausschliesslich den TEXT:
//   · `tragfaehigkeit.titel` — Überschrift der Anzeige.
//   · `tragfaehigkeit.stand.<empty|draft|solid>` — wie tragfähig der Text gerade ist.
//   · `tragfaehigkeit.textNichtPerson` — die ehrliche Grenze: Text statt Person, keine Punkte,
//     gesichert erst nach der Prüfung.
// Die alten `studio.contrib.*`-Schlüssel bleiben im Grundbestand unverändert stehen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "tragfaehigkeit.",
  legacySchluessel: [],
  de: {
    "tragfaehigkeit.titel": "Tragfähigkeit des Textes",
    "tragfaehigkeit.stand.empty": "Noch kein Text. Ein roher Anfang reicht für den ersten Schritt.",
    "tragfaehigkeit.stand.draft":
      "Der Text trägt erst in Teilen. Die Hinweise unten machen ihn klarer und nützlicher.",
    "tragfaehigkeit.stand.solid":
      "Der Text ist klar gegliedert und trägt — bereit zum Übernehmen und Prüfen lassen.",
    "tragfaehigkeit.textNichtPerson":
      "Beschreibt nur den Text, nicht die Person — ohne Punkte. Gesichert ist der Inhalt erst nach der Prüfung durch Kolleg:innen.",
  },
  en: {
    "tragfaehigkeit.titel": "How well the text holds up",
    "tragfaehigkeit.stand.empty": "No text yet. A rough beginning is enough for the first step.",
    "tragfaehigkeit.stand.draft":
      "The text holds up only in parts so far. The hints below make it clearer and more useful.",
    "tragfaehigkeit.stand.solid":
      "The text is clearly structured and holds up — ready to apply and get reviewed.",
    "tragfaehigkeit.textNichtPerson":
      "Describes the text only, not the person — no points. The content is secured only after colleagues review it.",
  },
  nl: {
    "tragfaehigkeit.titel": "Draagkracht van de tekst",
    "tragfaehigkeit.stand.empty": "Nog geen tekst. Een ruwe aanzet is genoeg voor de eerste stap.",
    "tragfaehigkeit.stand.draft":
      "De tekst draagt nog maar gedeeltelijk. De hints hieronder maken hem duidelijker en nuttiger.",
    "tragfaehigkeit.stand.solid":
      "De tekst is duidelijk gestructureerd en draagt — klaar om over te nemen en te laten beoordelen.",
    "tragfaehigkeit.textNichtPerson":
      "Beschrijft alleen de tekst, niet de persoon — zonder punten. De inhoud is pas geborgd na beoordeling door collega's.",
  },
} satisfies Textmodul;
