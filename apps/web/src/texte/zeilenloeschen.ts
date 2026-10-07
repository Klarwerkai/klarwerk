// ================================================================================================
// AUFNAHME 20260922 · GESAMT-BIBLIOTHEK-LÖSCHEN (R-0959) — der Name des Papierkorbs an der Trefferzeile.
// ================================================================================================
//
// Berechtigte löschen einen Beitrag direkt aus der Trefferliste; vorher fragt eine ruhige Zeile
// unter dem Treffer nach. Frage, Knöpfe und Abschlussmeldungen sind DIESELBEN wie am „…"-Menü der
// Lesefläche (`ko.deleteQ`, `ko.deleteKeep`, `ko.deleteYes`, `ko.deleteDone`,
// `ko.deleteAlreadyGone`) — derselbe Löschweg, kein zweiter Wortlaut. Neu ist nur der Name des
// Symbolknopfs: er trägt keinen sichtbaren Text, und ein Vorleseprogramm muss sagen können, WELCHER
// Beitrag gelöscht würde.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "zeilenloeschen.",
  legacySchluessel: [],
  de: {
    "zeilenloeschen.knopf": "„{{titel}}“ löschen",
  },
  en: {
    "zeilenloeschen.knopf": "Delete “{{titel}}”",
  },
  nl: {
    "zeilenloeschen.knopf": "‘{{titel}}’ verwijderen",
  },
} satisfies Textmodul;
