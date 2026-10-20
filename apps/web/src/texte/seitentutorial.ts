import { SEITEN } from "../tutorial/seiten/daten";
import type { Textmodul } from "./intern/pruefung";
const gemeinsam = {
  de: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Den tatsächlichen Weg auf {{seite}} verstehen und selbst bewusst anwenden.",
    "seitentutorial.orientierung": "Orientieren",
    "seitentutorial.aktion": "Kernaktion",
    "seitentutorial.ergebnis": "Ergebnis prüfen",
    "seitentutorial.sonderfall": "Wenn es anders läuft",
    "seitentutorial.rahmen":
      "Die Erklärung arbeitet mit den sichtbaren Bedienelementen der echten Seite und deinen heutigen Rechten. Weiter, Zurück und Pause steuern nur die Begleitung.",
    "seitentutorial.grenze":
      "Dies ist Bedienhilfe, kein gespeicherter Entwurf und keine Freigabe. Die Begleitung führt keine Arbeit aus. Eingaben und jede Bestätigung erfolgen bewusst auf der echten Seite.",
    "seitentutorial.demo": "Begleitung an der echten Seite",
    "seitentutorial.zeigen": "Bedienelement zeigen",
    "seitentutorial.fehlend":
      "Dieses Ziel ist derzeit nicht bedienbar oder nicht sichtbar. Prüfe Ladezustand, Auswahl und heutige Rechte. Die Erklärung bleibt verfügbar; es wurde nichts ausgeführt.",
    "seitentutorial.uebergang": "Auf der echten Seite fortfahren",
    "seitentutorial.fortsetzen": "Tutorial fortsetzen",
    "seitentutorial.unterbrochen":
      "Unterbrochene Begleitung auf {{pfad}}: {{titel}}. Zurückkehren öffnet denselben Schritt pausiert.",
    "seitentutorial.zurueck": "Zur unterbrochenen Seite",
  },
  en: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Understand the actual workflow on {{seite}} and apply it deliberately yourself.",
    "seitentutorial.orientierung": "Orient yourself",
    "seitentutorial.aktion": "Core action",
    "seitentutorial.ergebnis": "Check the result",
    "seitentutorial.sonderfall": "When things differ",
    "seitentutorial.rahmen":
      "This explanation uses the real page's visible controls and your current permissions. Next, Back and Pause control only the tutorial.",
    "seitentutorial.grenze":
      "This is guidance, not a saved draft or approval. It performs no work. Enter data and confirm actions deliberately on the real page.",
    "seitentutorial.demo": "Guidance on the real page",
    "seitentutorial.zeigen": "Show the control",
    "seitentutorial.fehlend":
      "This target is not currently usable or visible. Check loading, selection and current permissions. Guidance remains available; nothing was executed.",
    "seitentutorial.uebergang": "Continue on the real page",
    "seitentutorial.fortsetzen": "Resume tutorial",
    "seitentutorial.unterbrochen":
      "Interrupted guidance on {{pfad}}: {{titel}}. Returning opens the same step paused.",
    "seitentutorial.zurueck": "Return to the interrupted page",
  },
  nl: {
    "seitentutorial.titel": "Tutorial: {{seite}}",
    "seitentutorial.lernziel":
      "Begrijp de echte werkwijze op {{seite}} en pas deze bewust zelf toe.",
    "seitentutorial.orientierung": "Oriënteren",
    "seitentutorial.aktion": "Kernactie",
    "seitentutorial.ergebnis": "Resultaat controleren",
    "seitentutorial.sonderfall": "Als het anders loopt",
    "seitentutorial.rahmen":
      "Deze uitleg gebruikt zichtbare bediening van de echte pagina en je huidige rechten. Verder, Terug en Pauze sturen alleen de tutorial.",
    "seitentutorial.grenze":
      "Dit is hulp, geen opgeslagen concept of goedkeuring. De hulp voert geen werk uit. Voer gegevens en bevestigingen bewust op de echte pagina in.",
    "seitentutorial.demo": "Hulp op de echte pagina",
    "seitentutorial.zeigen": "Bediening tonen",
    "seitentutorial.fehlend":
      "Dit doel is nu niet bedienbaar of zichtbaar. Controleer laden, selectie en huidige rechten. De uitleg blijft beschikbaar; er is niets uitgevoerd.",
    "seitentutorial.uebergang": "Verder op de echte pagina",
    "seitentutorial.fortsetzen": "Tutorial hervatten",
    "seitentutorial.unterbrochen":
      "Onderbroken hulp op {{pfad}}: {{titel}}. Terugkeren opent dezelfde stap gepauzeerd.",
    "seitentutorial.zurueck": "Terug naar de onderbroken pagina",
  },
};
function texte(sprache: "de" | "en" | "nl", index: number): Record<string, string> {
  const ausgabe: Record<string, string> = { ...gemeinsam[sprache] };
  for (const s of SEITEN) {
    for (const feld of ["aktion", "ergebnis", "sonderfall"] as const) {
      ausgabe[`seitentutorial.${s.id}.${feld}`] = s[feld][index] ?? "";
    }
  }
  return ausgabe;
}
export default {
  praefix: "seitentutorial.",
  legacySchluessel: [],
  de: texte("de", 0),
  en: texte("en", 1),
  nl: texte("nl", 2),
} satisfies Textmodul;
