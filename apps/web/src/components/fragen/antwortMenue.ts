// FE-003 / R-0703: die Punkte des „…"-Menüs an der Antwortkarte — EINE Liste für die echte Seite
// (`pages/Ask.tsx`) und die Vorführung (`tutorial/fragen/FragenDemo.tsx`), damit beide dieselben
// Punkte in derselben Reihenfolge zeigen (tests/fe003-tutorial-fragen/tutorial-fragen-mounted).
// R-0703: Word, PowerPoint und PDF-Datei tragen die KI-Kennzeichnung in ihren Dateieigenschaften.
export const ANTWORT_MENUEPUNKTE = [
  { id: "print", labelKey: "ask.export.print" },
  { id: "download", labelKey: "ask.export.download" },
  { id: "docx", labelKey: "ask.export.docx" },
  { id: "pptx", labelKey: "ask.export.pptx" },
  { id: "pdf", labelKey: "ask.export.pdfDatei" },
  { id: "mehr", labelKey: "ask.menu.mehr" },
] as const;

export type AntwortMenuepunkt = (typeof ANTWORT_MENUEPUNKTE)[number]["id"];
