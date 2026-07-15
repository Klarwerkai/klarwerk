// SCRUM-488 (Nullschulung): Der „Datei"-Einfügen-Button im Editor darf nur erscheinen, wenn er auch
// etwas kann — sonst öffnet er nur ein leeres „keine Dateien"-Menü (toter Klick). Sichtbar, wenn ein
// Datei-Upload verdrahtet ist (onAttachFiles vorhanden) ODER es einfügbare Object-Store-Dateien gibt.
// DOM-frei, damit die Sichtbarkeits-Regel testbar bleibt.
export function editorFileButtonVisible(canAttach: boolean, fileCount: number): boolean {
  return canAttach || fileCount > 0;
}
