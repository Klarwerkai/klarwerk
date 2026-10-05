// ================================================================================================
// FE-003 · DIE UNTERRICHTSFOLGE „FRAGEN“ — erklären → vormachen → gemeinsam üben → selbst anwenden.
// ================================================================================================
//
// Sieben Schritte nach dem freigegebenen Ticket FE-003 („Unterrichtsfolge für Fragen“), in dieser
// Reihenfolge und mit diesen Inhalten. Die Texte stehen in `texte/tutorial.ts` (DE/EN/NL); hier
// steht nur die GLIEDERUNG: welcher Schritt, welche Teile der Vorführung, auf welches Bedienelement
// jeder Teil zeigt.
//
// Die Ziele sind die Namen aus `components/fragen/ziele.ts`, die die echten Bausteine selbst
// tragen. Wer einen Baustein umbaut und dabei ein Ziel verliert, sieht es in der Demo
// („Bedienelement fehlt“) und in `tests/fe003-tutorial-fragen/` — keine stummen Zeiger.
import { FRAGEN_ZIEL } from "../../components/fragen/ziele";
import type { TutorialDefinition, TutorialTeil } from "../typen";

const LESEN_MS = 4500;

// Der Lückensatz wird hier nur ZITIERT (Schritt 6 nennt ihn beim Namen), nicht als Zustand gezeigt.
// Die Lektion ist keine Lückenfläche im Sinn von `tests/app/mega54-ein-naechster-schritt-sammler`;
// gezeigt wird die Lücke samt nächstem Schritt in `FragenDemo.tsx` (`DemoLuecke`), und dort prüft
// der Sammler sie.
const LUECKENSATZ = "ask.noBasisTitle";

function teil(schritt: string, id: string, ziel: string | null, dauerMs = LESEN_MS): TutorialTeil {
  return { id, textKey: `tutorial.fragen.${schritt}.teil.${id}`, ziel, dauerMs };
}

function schritt(
  id: string,
  teile: TutorialTeil[],
  interaktiv = false,
): TutorialDefinition["schritte"][number] {
  return {
    id,
    titelKey: `tutorial.fragen.${id}.titel`,
    kurzKey: `tutorial.fragen.${id}.kurz`,
    textKey: `tutorial.fragen.${id}.text`,
    vertiefungKey: `tutorial.fragen.${id}.vertiefung`,
    teile,
    interaktiv,
  };
}

export const FRAGEN_LEKTION: TutorialDefinition = {
  id: "fragen",
  pfad: "/fragen",
  titelKey: "tutorial.fragen.titel",
  lernzielKey: "tutorial.fragen.lernziel",
  // Die Beschriftungen, die die Texte nennen — aus den Schlüsseln der echten Seite.
  textWerte: (t) => ({
    beispiele: t("ask.examplesLabel").replace(/:\s*$/, ""),
    mehr: t("ask.menu.mehr"),
    verwendet: t("ask.attribution.carrying.badge"),
    angesehen: t("ask.attribution.consulted.badge"),
    unbekannt: t("ask.attribution.unclear.badge"),
    luecke: t(LUECKENSATZ),
    bibliothek: t("ask.aiUnavailable.toLibrary"),
    erfassen: t("ask.aiUnavailable.toCapture"),
    kopieren: t("ask.export.copy"),
    geholfen: t("ask.helpful"),
    eigeneFrage: t("tutorial.fragen.uebergang.knopf"),
  }),
  uebergabeZiel: FRAGEN_ZIEL.fragefeld,
  schritte: [
    schritt("verstehen", [
      teil("verstehen", "feld", FRAGEN_ZIEL.fragefeld),
      teil("verstehen", "beispiele", FRAGEN_ZIEL.beispiele),
      teil("verstehen", "ergebnis", null),
    ]),
    schritt("formulieren", [
      // Die Tippvorführung (Takt `TIPP_MS` in `FragenDemo.tsx`) braucht die Frage plus Lesezeit.
      teil("formulieren", "tippen", FRAGEN_ZIEL.fragefeld, 5000),
      teil("formulieren", "kontext", FRAGEN_ZIEL.fragefeld),
    ]),
    schritt("absenden", [
      teil("absenden", "knopf", FRAGEN_ZIEL.absenden),
      teil("absenden", "warten", FRAGEN_ZIEL.warten),
    ]),
    schritt("antwort", [
      teil("antwort", "aussage", FRAGEN_ZIEL.antworttext),
      teil("antwort", "ziffer", FRAGEN_ZIEL.quellenchip),
      teil("antwort", "kennzeichnung", FRAGEN_ZIEL.kiHinweis),
    ]),
    // Der TATSÄCHLICHE Quellenweg der Seite: Chip an der Antwort, dann „…“ → „Mehr …“ →
    // Quellenliste. Die Teile ab „liste“ liegen im Blatt „Mehr“; der Schritt spielt nicht von
    // selbst (ein Blatt, das sich ungefragt öffnet, nähme der Tastatur den Rahmen weg).
    schritt(
      "quelle",
      [
        teil("quelle", "chip", FRAGEN_ZIEL.quellenchip),
        teil("quelle", "menue", FRAGEN_ZIEL.menue),
        teil("quelle", "liste", FRAGEN_ZIEL.quellenliste),
        teil("quelle", "stand", FRAGEN_ZIEL.quellenstand),
        teil("quelle", "original", FRAGEN_ZIEL.original),
      ],
      true,
    ),
    schritt("sonderfaelle", [
      teil("sonderfaelle", "luecke", FRAGEN_ZIEL.luecke),
      teil("sonderfaelle", "unsicher", FRAGEN_ZIEL.quellenchip),
      teil("sonderfaelle", "kiaus", FRAGEN_ZIEL.kiAus),
    ]),
    schritt(
      "ueben",
      [
        teil("ueben", "eingeben", FRAGEN_ZIEL.fragefeld),
        teil("ueben", "senden", FRAGEN_ZIEL.absenden),
        teil("ueben", "pruefen", FRAGEN_ZIEL.quellenchip),
      ],
      true,
    ),
  ],
  laden: () =>
    import("./FragenDemo").then((m) => ({ Demo: m.FragenDemo, Uebergang: m.FragenUebergang })),
};
