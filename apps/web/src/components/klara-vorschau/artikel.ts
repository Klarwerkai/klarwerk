// ================================================================================================
// KLARA-VORSCHAU · DIE FIKTIVEN ARTIKEL — reine Demodaten, kein Wissensobjekt, kein Serverabruf.
// ================================================================================================
//
// Klara braucht einen Artikel, an dem sie zeigen kann, was sie mit einer Markierung tut. Ein echtes
// Wissensobjekt dafür anzulegen hiesse, den Bestand zu verändern — das ist ausdrücklich nicht Teil
// der Vorschau. Diese Artikel sind deshalb Konstanten im Bündel, frei erfunden (keine Firma, keine
// Person, keine echte Anlage) und nur auf Deutsch hinterlegt (die Seite sagt das).
//
// Je Absatz liegen die vorgefertigten Antworten bereit: Erklärung, Zusammenfassung und ein
// Umformulierungsvorschlag. Klara „rechnet“ nichts aus; sie zeigt den Ablauf.

export interface DemoAbsatz {
  nr: number;
  text: string;
  erklaerung: string;
  zusammenfassung: string;
  umformulierung: string;
}

export interface DemoArtikel {
  id: string;
  titel: string;
  bereich: string;
  kurz: string;
  absaetze: readonly DemoAbsatz[];
}

export const DEMO_ARTIKEL: readonly DemoArtikel[] = [
  {
    id: "foerderbandrolle",
    titel: "Förderbandrolle FB-200 tauschen (fiktiv)",
    bereich: "Instandhaltung · Halle 3 (fiktiv)",
    kurz: "wie die Rolle sicher getauscht, eingestellt und der Tausch dokumentiert wird.",
    absaetze: [
      {
        nr: 1,
        text: "Vor dem Tausch der Förderbandrolle wird die Anlage am Hauptschalter ausgeschaltet und mit dem persönlichen Vorhängeschloss gegen Wiedereinschalten gesichert. Erst wenn die Anzeige „Energie frei“ leuchtet, darf die Schutzhaube geöffnet werden.",
        erklaerung:
          "Hier geht es um die Sicherheit vor der Arbeit: Ausschalten allein reicht nicht. Das eigene Schloss am Hauptschalter verhindert, dass jemand anderes die Anlage wieder startet, während du daran arbeitest. Die Anzeige „Energie frei“ ist das Zeichen, dass keine Restenergie mehr anliegt.",
        zusammenfassung:
          "Anlage ausschalten, mit eigenem Schloss sichern, auf „Energie frei“ warten – erst dann die Haube öffnen.",
        umformulierung:
          "Schalte die Anlage am Hauptschalter aus und sichere sie mit deinem eigenen Vorhängeschloss. Öffne die Schutzhaube erst, wenn die Anzeige „Energie frei“ leuchtet.",
      },
      {
        nr: 2,
        text: "Die alte Rolle wird an beiden Lagerböcken gelöst. Dazu werden die vier Innensechskantschrauben M8 gegen den Uhrzeigersinn gedreht, während eine zweite Person die Rolle hält, damit sie nicht auf das Band fällt.",
        erklaerung:
          "Die Rolle hängt links und rechts in je einem Lagerbock. Sobald die vier Schrauben gelöst sind, hält sie nichts mehr – deshalb stützt eine zweite Person die Rolle, sonst fällt sie auf das Band und beschädigt es.",
        zusammenfassung: "Vier M8-Schrauben lösen – zu zweit, damit die Rolle nicht herunterfällt.",
        umformulierung:
          "Löse die alte Rolle an beiden Lagerböcken: Drehe die vier Innensechskantschrauben M8 gegen den Uhrzeigersinn heraus. Eine zweite Person hält dabei die Rolle fest.",
      },
      {
        nr: 3,
        text: "Die neue Rolle wird so eingesetzt, dass der Pfeil auf der Stirnseite in Laufrichtung des Bandes zeigt. Die Schrauben werden über Kreuz mit 25 Nm angezogen; ein zu hohes Drehmoment beschädigt die Lagerschale.",
        erklaerung:
          "Der Pfeil auf der Rolle muss in die Richtung zeigen, in die das Band läuft – sonst verschleisst das Lager schneller. „Über Kreuz“ heisst: die Schrauben abwechselnd diagonal anziehen, damit die Rolle gerade sitzt. 25 Nm ist die Obergrenze; mehr drückt die Lagerschale ein.",
        zusammenfassung: "Pfeil in Laufrichtung, Schrauben über Kreuz mit genau 25 Nm.",
        umformulierung:
          "Setze die neue Rolle so ein, dass ihr Pfeil in Laufrichtung des Bandes zeigt. Ziehe die Schrauben über Kreuz mit 25 Nm an – nicht fester, sonst leidet die Lagerschale.",
      },
      {
        nr: 4,
        text: "Nach dem Einbau läuft das Band zwei Minuten im Tippbetrieb. Läuft es seitlich aus der Spur, wird die Rolle an der Stellschraube nachjustiert und der Testlauf wiederholt. Das Ergebnis wird im Wartungsbuch vermerkt.",
        erklaerung:
          "Der kurze Testlauf zeigt, ob das Band mittig läuft. Wandert es zur Seite, stellst du die Rolle an der Stellschraube nach und testest erneut. Der Eintrag im Wartungsbuch macht den Tausch für die nächste Schicht nachvollziehbar.",
        zusammenfassung:
          "Zwei Minuten Testlauf, bei Bedarf nachjustieren, dann im Wartungsbuch eintragen.",
        umformulierung:
          "Lass das Band nach dem Einbau zwei Minuten im Tippbetrieb laufen. Läuft es aus der Spur, justiere die Rolle an der Stellschraube nach und teste erneut. Trage das Ergebnis ins Wartungsbuch ein.",
      },
    ],
  },
  {
    id: "schichtuebergabe",
    titel: "Schichtübergabe in der Verpackung (fiktiv)",
    bereich: "Produktion · Verpackungslinie 2 (fiktiv)",
    kurz: "was bei der Übergabe zwischen zwei Schichten mündlich und schriftlich weitergegeben wird.",
    absaetze: [
      {
        nr: 1,
        text: "Die Übergabe findet zehn Minuten vor Schichtende direkt an der Linie statt. Die abgebende Schicht nennt offene Störungen, den aktuellen Auftrag und den Materialstand.",
        erklaerung:
          "Die Übergabe passiert an der Linie, nicht im Pausenraum, damit man Störungen gleich zeigen kann. Drei Dinge gehören immer dazu: was gerade nicht funktioniert, welcher Auftrag läuft und wie viel Material noch da ist.",
        zusammenfassung: "Zehn Minuten vor Schichtende an der Linie: Störungen, Auftrag, Material.",
        umformulierung:
          "Übergib zehn Minuten vor Schichtende direkt an der Linie. Nenne offene Störungen, den laufenden Auftrag und den Materialstand.",
      },
      {
        nr: 2,
        text: "Alles Gesagte wird im Übergabeblatt festgehalten und von beiden Schichtleitungen abgezeichnet. Fehlt eine Unterschrift, gilt die Übergabe als nicht erfolgt.",
        erklaerung:
          "Was nur gesagt wird, geht leicht verloren. Deshalb wird es aufgeschrieben, und beide Schichtleitungen unterschreiben. Erst mit beiden Unterschriften ist die Verantwortung übergeben.",
        zusammenfassung: "Übergabeblatt ausfüllen, beide unterschreiben – sonst keine Übergabe.",
        umformulierung:
          "Halte alles im Übergabeblatt fest und lass es von beiden Schichtleitungen abzeichnen. Ohne beide Unterschriften ist die Übergabe nicht erfolgt.",
      },
    ],
  },
];

export function demoArtikel(id: string | undefined): DemoArtikel | null {
  return DEMO_ARTIKEL.find((a) => a.id === id) ?? null;
}

export const VORSCHAU_PFAD = "/klara-vorschau";

export function artikelPfad(id: string): string {
  return `${VORSCHAU_PFAD}/artikel/${id}`;
}
