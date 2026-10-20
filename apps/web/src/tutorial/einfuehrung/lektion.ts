import type { TutorialDefinition } from "../typen";
/** Eigener Inhalt im gelieferten Tutorialbereich; kein Register-/Engineumbau. */
export const EINFUEHRUNG_UEBUNG: TutorialDefinition = {
  id: "persoenliche-einfuehrung",
  pfad: "/profil",
  titelKey: "klaraeinfuehrung.uebung",
  lernzielKey: "klaraeinfuehrung.lernziel",
  schritte: [
    {
      id: "quelle",
      titelKey: "klaraeinfuehrung.uebung",
      kurzKey: "klaraeinfuehrung.uebung",
      textKey: "klaraeinfuehrung.uebungText",
      vertiefungKey: "klaraeinfuehrung.warnung",
      interaktiv: true,
      teile: [{ id: "quelle", textKey: "klaraeinfuehrung.uebungText", ziel: null, dauerMs: 0 }],
    },
  ],
  textWerte: () => ({}),
  uebergabeZiel: "gedaechtnis-neu",
  laden: () => import("./Uebung"),
};
