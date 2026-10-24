import { createElement } from "react";
import type { TutorialDefinition, TutorialDemoProps } from "../typen";
import { SEITEN } from "./daten";
export const SEITEN_TUTORIALS: readonly TutorialDefinition[] = SEITEN.flatMap((seite) =>
  seite.pfade.map((pfad) => ({
    id: `seite-${seite.id}`,
    pfad,
    titelKey: "seitentutorial.titel",
    lernzielKey: "seitentutorial.lernziel",
    textWerte: (t: (key: string) => string) => ({ seite: t(seite.titelKey) }),
    uebergabeZiel: `seite-${seite.id}.aktion`,
    echteZiele: { [`seite-${seite.id}.aktion`]: seite.ziel },
    schritte: ["orientierung", "aktion", "ergebnis", "sonderfall"].map((id) => ({
      id,
      titelKey: `seitentutorial.${id}`,
      kurzKey: `seitentutorial.${id}`,
      textKey: id === "orientierung" ? "seitentutorial.rahmen" : `seitentutorial.${seite.id}.${id}`,
      vertiefungKey: "seitentutorial.grenze",
      interaktiv: true,
      teile: [
        {
          id: "zeigen",
          textKey: `seitentutorial.${seite.id}.aktion`,
          ziel: `seite-${seite.id}.aktion`,
          dauerMs: 4500,
        },
      ],
    })),
    laden: () =>
      import("./SeitenDemo").then((m) => ({
        Demo: (props: TutorialDemoProps) => createElement(m.SeitenDemo, { ...props, seite }),
        Uebergang: m.SeitenUebergang,
      })),
  })),
);
