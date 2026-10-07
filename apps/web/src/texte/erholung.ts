// ================================================================================================
// SPEICHERZUSTAND UND ERHOLUNG · DIE TEXTE DIESES AUFTRAGS — bei ihrer Funktion.
// ================================================================================================
//
// WOHER SIE KOMMEN: `produkt:20261007:speichern-erholung` (Ausbauliste Punkt 6). Zwei Flächen:
//   · das Blatt (`components/erfassen/Blatt.tsx`) sagt beim expliziten Speichern, in welcher Lage
//     es ist — läuft, wartet auf Verbindung, fehlgeschlagen, gespeichert;
//   · die Bibliothek (`components/bibliothek/BibliothekFlaeche.tsx`) nennt beim Nulltreffer die
//     aktiven Filter und setzt sie direkt zurück, ohne den Suchtext anzufassen.
//
// WAS DIE SÄTZE NICHT BEHAUPTEN: dass ein ungespeicherter Text ein Neuladen ohne Netz übersteht.
// Das Blatt hält ihn nur im Fenster; der Wartesatz sagt das ausdrücklich (Kriterium 6).
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "erholung.",
  legacySchluessel: [],
  de: {
    "erholung.speichern.laeuft": "Wird gespeichert …",
    "erholung.speichern.wartet": "Wartet auf Verbindung – noch nicht gespeichert",
    "erholung.speichern.wartetHinweis":
      "Deine Eingabe bleibt hier stehen. Sobald die Verbindung zurück ist, wird automatisch gespeichert und hier bestätigt. Bis dahin die Seite nicht neu laden oder schließen – die Eingabe liegt nur in diesem Fenster.",
    "erholung.speichern.fehlgeschlagen": "Nicht gespeichert – der Versuch ist fehlgeschlagen",
    "erholung.speichern.gespeichert": "Gespeichert – vom Server bestätigt",
    "erholung.speichern.wechselOhneVerbindung":
      "Ohne Verbindung kann jetzt nicht gespeichert werden. Bleib auf der Seite – deine Eingabe bleibt erhalten und lässt sich speichern, sobald die Verbindung zurück ist.",
    "erholung.filter.aktiv": "Aktive Filter:",
    "erholung.filter.zuruecksetzen": "Filter zurücksetzen – Suchtext bleibt",
  },
  en: {
    "erholung.speichern.laeuft": "Saving …",
    "erholung.speichern.wartet": "Waiting for connection – not saved yet",
    "erholung.speichern.wartetHinweis":
      "Your input stays here. As soon as the connection is back, it is saved automatically and confirmed here. Until then, do not reload or close the page – the input exists only in this window.",
    "erholung.speichern.fehlgeschlagen": "Not saved – the attempt failed",
    "erholung.speichern.gespeichert": "Saved – confirmed by the server",
    "erholung.speichern.wechselOhneVerbindung":
      "Without a connection nothing can be saved right now. Stay on the page – your input is kept and can be saved as soon as the connection is back.",
    "erholung.filter.aktiv": "Active filters:",
    "erholung.filter.zuruecksetzen": "Reset filters – search text stays",
  },
  nl: {
    "erholung.speichern.laeuft": "Wordt opgeslagen …",
    "erholung.speichern.wartet": "Wacht op verbinding – nog niet opgeslagen",
    "erholung.speichern.wartetHinweis":
      "Je invoer blijft hier staan. Zodra de verbinding terug is, wordt automatisch opgeslagen en hier bevestigd. Laad of sluit de pagina tot dan niet – de invoer bestaat alleen in dit venster.",
    "erholung.speichern.fehlgeschlagen": "Niet opgeslagen – de poging is mislukt",
    "erholung.speichern.gespeichert": "Opgeslagen – bevestigd door de server",
    "erholung.speichern.wechselOhneVerbindung":
      "Zonder verbinding kan nu niet worden opgeslagen. Blijf op de pagina – je invoer blijft bewaard en kan worden opgeslagen zodra de verbinding terug is.",
    "erholung.filter.aktiv": "Actieve filters:",
    "erholung.filter.zuruecksetzen": "Filters resetten – zoektekst blijft",
  },
} satisfies Textmodul;
