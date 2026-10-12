// ================================================================================================
// EDITOR-EINHEITLICH (produkt:20261007:editor-einheitlich) · K1/K2/K3 — DIE REGEL OHNE OBERFLÄCHE.
// ================================================================================================
//
// Drei Dinge werden hier gemessen, jedes an echten Funktionen und nicht an Nachbildungen:
//
//   1. PARITÄT: die Client-Abschrift (`apps/web/src/lib/aussageAusInhalt.ts`) schneidet genau wie
//      die Serverregel (`services/structure/src/kernaussage.ts`). Dasselbe Muster wie
//      `tests/capture/draft-limits-shared.test.ts` — der Client darf `services/` nicht importieren.
//   2. ERKENNUNG (K2): eine Aussage, die der Erstellweg aus dem Inhalt gebildet hat, wird als
//      „folgt dem Inhalt" erkannt — eine eigene, abweichende Aussage NICHT.
//   3. PFLICHT (K3): fehlende Pflichtangaben je Weg, mit der Regel des Speicher-Checks.
//
// Alle Texte sind fiktiv.
import { describe, expect, it } from "vitest";
import {
  AUSSAGE_MAX,
  aussageAusErstemAbsatz,
  aussageAusInhalt,
  aussageAusKlartext,
  aussageFolgtInhalt,
  fehlendePflichtangaben,
  mitNeuemInhalt,
} from "../../apps/web/src/lib/aussageAusInhalt";
import { frontDoorStatement } from "../../apps/web/src/lib/captureFrontDoor";
import {
  KERNAUSSAGE_MAX,
  htmlToPlainText,
  kernaussageAusHtml,
  kernaussageAusKlartext,
} from "../../services/structure";

const KURZ = "<p>Bei Überdruck Ventil X zuerst entlasten. Danach manuell schließen.</p>";

/** Ein Inhalt über der Grenze: viele Sätze, damit die Kürzung an einer Satzgrenze greift. */
const SCHRITTE = Array.from({ length: 30 }, (_, i) => `Schritt ${i + 1}: Ventil X prüfen.`);
const LANG = `<h2>Ablauf</h2><p>${SCHRITTE.join(" ")}</p><p>Zweiter Absatz mit Nachtrag.</p>`;

/** Fälle, an denen beide Fassungen dasselbe Ergebnis liefern müssen. */
const KLARTEXTE = [
  "",
  "   ",
  "Ein Satz.",
  "Ohne Satzende aber mit Wörtern",
  htmlToPlainText(KURZ),
  htmlToPlainText(LANG),
  `${"Wort ".repeat(140)}Ende.`,
  "x".repeat(700),
  `„Zitat am Ende."${" weiter".repeat(90)}`,
];

describe("EDITOR-EINHEITLICH · Parität: Client-Abschrift = Serverregel", () => {
  it("P1 · dieselbe Grenze", () => {
    expect(AUSSAGE_MAX).toBe(KERNAUSSAGE_MAX);
  });

  it("P2 · Klartext: jeder Fall schneidet gleich", () => {
    for (const text of KLARTEXTE) {
      expect(aussageAusKlartext(text), JSON.stringify(text.slice(0, 40))).toBe(
        kernaussageAusKlartext(text),
      );
    }
  });

  it("P3 · erster Absatz: jeder Fall schneidet gleich", () => {
    for (const html of [KURZ, LANG, "<p></p><p>Nur im zweiten.</p>", "<figure></figure>"]) {
      expect(aussageAusErstemAbsatz(html), html.slice(0, 40)).toBe(kernaussageAusHtml(html));
    }
  });
});

describe("EDITOR-EINHEITLICH · K2 — welche Aussage dem Inhalt folgt", () => {
  it("E1 · kurzer Text, wie das Blatt ihn anlegt: Aussage = Klartext → folgt", () => {
    // Erstellweg: der Client schickt `frontDoorStatement`, der Server kürzt mit seiner Regel.
    const gespeichert = kernaussageAusKlartext(frontDoorStatement(KURZ, "Ventil X"));
    expect(aussageFolgtInhalt(gespeichert, KURZ)).toBe(true);
  });

  it("E2 · langer Text: die gekürzte Aussage des Erstellwegs wird erkannt", () => {
    const gespeichert = kernaussageAusKlartext(frontDoorStatement(LANG, "Ventil X"));
    expect(gespeichert.length).toBeLessThanOrEqual(KERNAUSSAGE_MAX);
    expect(gespeichert.length).toBeLessThan(htmlToPlainText(LANG).length);
    expect(aussageFolgtInhalt(gespeichert, LANG)).toBe(true);
  });

  it("E3 · Rückfall der Entwurfsroute (erster Absatz) und des Anlegens (ganzer Klartext)", () => {
    expect(aussageFolgtInhalt(kernaussageAusHtml(LANG), LANG)).toBe(true);
    expect(aussageFolgtInhalt(htmlToPlainText(LANG), LANG)).toBe(true);
  });

  it("E4 · eine eigene, abweichende Aussage folgt NICHT — auch nicht ein bloßer Anfang", () => {
    expect(aussageFolgtInhalt("Ventil X sicher schließen.", KURZ)).toBe(false);
    // Nur der Anfang des ersten Satzes ist keine Form, die ein Erstellweg schreibt.
    expect(aussageFolgtInhalt("Bei Überdruck", KURZ)).toBe(false);
  });

  it("E5 · ohne Inhalt oder ohne Aussage folgt nichts", () => {
    expect(aussageFolgtInhalt("Bei Überdruck Ventil X schließen.", "")).toBe(false);
    expect(aussageFolgtInhalt("Bei Überdruck Ventil X schließen.", null)).toBe(false);
    expect(aussageFolgtInhalt("", KURZ)).toBe(false);
    expect(aussageFolgtInhalt("Text", "<p></p>")).toBe(false);
  });

  it("E6 · Inhalt ändern: gekoppelte Aussage zieht mit, eigene bleibt wortgleich", () => {
    const neu = "<p>Ventil X erst nach Freigabe öffnen. Danach Druck prüfen.</p>";
    const gekoppelt = {
      statement: htmlToPlainText(KURZ),
      bodyHtml: KURZ,
      aussageFolgtInhalt: true,
    };
    const eigen = { statement: "Eigene Aussage.", bodyHtml: KURZ, aussageFolgtInhalt: false };

    expect(mitNeuemInhalt(gekoppelt, neu)).toEqual({
      statement: "Ventil X erst nach Freigabe öffnen. Danach Druck prüfen.",
      bodyHtml: neu,
      aussageFolgtInhalt: true,
    });
    expect(mitNeuemInhalt(eigen, neu)).toEqual({ ...eigen, bodyHtml: neu });
  });

  it("E7 · die nachgezogene Aussage ist dieselbe, die das Erstellen aus diesem Inhalt bildet", () => {
    expect(aussageAusInhalt(LANG)).toBe(kernaussageAusKlartext(frontDoorStatement(LANG, "x")));
  });
});

describe("EDITOR-EINHEITLICH · K3 — Pflichtangaben je Weg", () => {
  const voll = { title: "Ventil X", statement: "Aussage.", bodyHtml: KURZ };

  it("F1 · Direktweg: Titel und Aussage/Inhalt (Regel des Speicher-Checks beim Erstellen)", () => {
    expect(fehlendePflichtangaben(voll, false)).toEqual([]);
    expect(fehlendePflichtangaben({ ...voll, title: "  " }, false)).toEqual(["titel"]);
    // Aussage leer, Inhalt da: genügt — wie `capture.ready.content` „Aussage / Inhalt".
    expect(fehlendePflichtangaben({ ...voll, statement: "" }, false)).toEqual([]);
    const leer = { title: "", statement: " ", bodyHtml: "<p></p>" };
    expect(fehlendePflichtangaben(leer, false)).toEqual(["titel", "inhalt"]);
  });

  it("F2 · Prüfweg: nur die Aussage — der Titel reist dort nicht mit", () => {
    expect(fehlendePflichtangaben({ ...voll, title: "" }, true)).toEqual([]);
    expect(fehlendePflichtangaben({ ...voll, statement: "  " }, true)).toEqual(["aussage"]);
  });
});
