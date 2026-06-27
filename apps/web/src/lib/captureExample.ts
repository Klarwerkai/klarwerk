// SCRUM-257: Produktnaher Beispielinhalt für den Capture-Einstieg. DOM-frei und damit testbar.
// Es ist bewusst eine ROHE Erfahrungsnotiz aus dem Betrieb (kein fertig validiertes Wissen) und an
// die aktuelle Stage-1-Story angeschlossen: industrielle Lücke an Linie L4 (Dosierwert/Schichtwechsel).
// Keine Fake-Magie — die KI strukturiert daraus nur einen Entwurf, den ein Mensch prüft und einreicht.
export interface CaptureExample {
  raw: string;
  category: string;
  asset: string;
  tags: string[];
  noticeKey: string;
}

export const CAPTURE_EXAMPLE: CaptureExample = {
  raw:
    "Nach dem Schichtwechsel an Linie L4 schwankt der Dosierwert der Klebstoffdosierung. " +
    "In der Praxis stabilisiert sich die Linie, wenn vor dem ersten Auftrag der Nullpunkt am HMI " +
    "geprüft und die Dosierpumpe DP-4 entlüftet wird. Gilt besonders nach Gebindewechsel oder " +
    "längerer Pause.",
  category: "Qualität",
  asset: "Linie L4 / Dosierstation DP-4",
  tags: ["Dosierung", "Linie L4", "Schichtwechsel", "Qualität"],
  noticeKey: "capture.exampleLoaded",
};
