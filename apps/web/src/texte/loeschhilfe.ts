// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0888 / R-0943 — KLARAS LÖSCHHILFE SAGT, WAS LÖSCHEN WIRKLICH TUT.
// ================================================================================================
//
// Bens Befund (Nacharbeit 13): „Die weiterhin von Klara verwendete Löschhilfe behauptet eine
// endgültige Entfernung, während der dokumentierte Produktweg gelöschte Beiträge zunächst im
// Papierkorb hält." `vhelp.deleteKo.body` sagte „Entfernt dieses Wissensobjekt endgültig“ und kannte
// weder Papierkorb noch Wiederherstellung.
//
// DER PRODUKTWEG, an dem dieser Text abgeglichen ist:
//   · `services/knowledge-object/src/service.ts:6502-6535` — Löschen dürfen Autor, Controller und
//     Admin (serverseitig erzwungen); normales Löschen ist der Papierkorb, hart gelöscht werden nur
//     Demo-Daten;
//   · `TRASH_RETENTION_DAYS = 30` (`service.ts:220`, Pedi 17.09.2026: 28 → 30), danach entfernt der
//     Aufräumlauf den Beitrag endgültig;
//   · die Löschabfrage der Fläche (`ko.deleteQ`) und der Papierkorb der Verwaltung
//     (`adm.trash.help`): 30 Tage, Wiederherstellung durch den Admin.
//
// EIN NEUER SCHLÜSSEL statt eines geänderten Werts: `vhelp.deleteKo.body` steht im eingefrorenen
// Textschnappschuss (`tests/i18n-textmodule/werte-vorher.json`). Dieselbe Bauform wie
// `entwurfspool.saveDraftHelp.body` für die Erfassen-Hilfe (`lib/captureHelp.ts`); die Umleitung
// steht in `lib/reviewHelp.ts`. Der Titel bleibt beim Schema.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "loeschhilfe.",
  legacySchluessel: [],
  de: {
    "loeschhilfe.deleteKo.body":
      "Legt dieses Wissensobjekt in den Papierkorb — erlaubt nur dem Autor selbst sowie Controller und Admin; der Server erzwingt dieselbe Regel. Vor dem Löschen fragt die Bestätigung bewusst nach. Im Papierkorb bleibt der Beitrag 30 Tage und kann vom Admin wiederhergestellt werden; danach wird er automatisch endgültig entfernt. Demo-Daten werden sofort endgültig gelöscht. Die Löschung wird im Audit protokolliert. Wenn das Wissen nur veraltet ist, ist Überarbeiten oder ein Konflikt der ehrlichere Weg als Löschen.",
  },
  en: {
    "loeschhilfe.deleteKo.body":
      "Moves this knowledge object to the recycle bin — allowed only for the author, controllers and admins; the server enforces the same rule. The confirmation deliberately asks before deleting. The entry stays in the recycle bin for 30 days, where an admin can restore it; after that it is removed permanently and automatically. Demo data is deleted permanently right away. The deletion is recorded in the audit log. If the knowledge is merely outdated, reworking it or reporting a conflict is the more honest path than deletion.",
  },
  nl: {
    "loeschhilfe.deleteKo.body":
      "Verplaatst dit kennisobject naar de prullenbak — alleen toegestaan voor de auteur zelf en voor controller en admin; de server dwingt dezelfde regel af. Vóór het verwijderen vraagt de bevestiging bewust na. De bijdrage blijft 30 dagen in de prullenbak en is daar door de admin te herstellen; daarna wordt ze automatisch definitief verwijderd. Demogegevens worden meteen definitief verwijderd. De verwijdering wordt in de audit vastgelegd. Als de kennis alleen verouderd is, is herzien of een conflict de eerlijkere weg dan verwijderen.",
  },
} satisfies Textmodul;
