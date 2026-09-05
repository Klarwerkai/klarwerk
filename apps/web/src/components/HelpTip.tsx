import { useSeitenhilfeAnmeldung } from "../shell/SeitenhilfeContext";

// Inline-Hilfe (FE-FND-05), seit JOB 3060 · H1 OHNE Sprechblase im Sichtfeld.
//
// Bis hierher öffnete ein „?"-Knopf neben dem Feld ein Popover mit Titel, Text und Link ins
// Hilfe-Center. Pedi (04.09.): Erklärung gehört hinter Zahnrad/Profil, nicht ins Sichtfeld. Der
// Baustein bleibt an seinen 14 Seiten stehen (die Aufrufe werden hier NICHT entfernt — das ist
// Sache der Seitenaufträge JOB 3061-3065), rendert aber nichts mehr: er meldet Titel und Text bei
// der Seitenhilfe an (shell/SeitenhilfeContext.tsx), und das Zahnrad-Menü listet sie unter
// „Seitenhilfe" für die aktuelle Seite. Kein Text geht verloren; er wechselt nur den Ort.
export function HelpTip({ title, body }: { title: string; body: string }): null {
  useSeitenhilfeAnmeldung(title, body);
  return null;
}
