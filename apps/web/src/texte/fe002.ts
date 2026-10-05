// ================================================================================================
// FE-002 · HEADER TEIL 1 — DIE WÖRTER, AN DENEN MAN DIE VIER ZWECKE DES KOPFBANDS ERKENNT.
// ================================================================================================
//
// Pedis Befund (26.09.2026, /start, Adminansicht, Version .612): wichtige Arbeitsseiten lagen hinter
// dem Zahnrad unter „Bereiche", das Suchfeld sagte sichtbar nur „Suchen", „Gehe zu …" erklärte
// nicht, dass es Seiten findet, und Meldungen waren erst im Kontomenü benannt.
//
// Diese Schlüssel geben jedem der vier Zwecke ein eigenes, sichtbares Wort:
//   · Arbeitsbereiche  — der beschriftete Einstieg zu den weiteren Arbeitsseiten
//   · Wissen suchen    — das Suchfeld (Bibliothek), sichtbar statt nur im `aria-label`
//   · Seite finden     — der Schnellzugriff ⌘K auf Seiten, sichtbar von der Wissenssuche getrennt
//   · Einstellungen    — Name des Zahnrads (Einstellungen und Hilfe)
//   · Meldungen        — der eigene Zugang mit Zahl der ungelesenen Meldungen
//
// Die Namen sind ein UMSETZUNGSVORSCHLAG zu FE-002; Pedi hat die Detailgestaltung noch nicht
// abgenommen (Prüfpaket: docs/belege/fe-002/PRUEFPAKET.md). Altnamen werden nicht übernommen —
// die bisherigen Schlüssel in `i18n.ts` bleiben unverändert stehen.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "fe002.",
  legacySchluessel: [],
  de: {
    "fe002.arbeitsbereiche": "Arbeitsbereiche",
    "fe002.seiteFinden": "Seite finden",
    "fe002.seiteFindenMenue": "Seite finden …",
    "fe002.seiteFindenLabel": "Seite finden (Schnellzugriff, ⌘K oder Strg+K)",
    "fe002.wissenSuchen": "Wissen suchen",
    "fe002.einstellungen": "Einstellungen und Hilfe",
    "fe002.persoenlicheEinstellungen": "Persönliche Einstellungen",
    "fe002.meldungen": "Meldungen",
    "fe002.meldungenUngelesen_one": "{{count}} ungelesene Meldung",
    "fe002.meldungenUngelesen_other": "{{count}} ungelesene Meldungen",
    "fe002.meldungenKeine": "Keine ungelesenen Meldungen",
    "fe002.meldungenUnbestaetigt": "Stand der Meldungen wird geprüft",
    "fe002.meldungenLaden": "Meldungen werden geladen …",
    "fe002.meldungenFehler":
      "Meldungen konnten gerade nicht geladen werden. Die Anzahl ungelesener Meldungen ist unbekannt.",
    "fe002.meldungenNeu_one": "{{count}} neu",
    "fe002.meldungenNeu_other": "{{count}} neu",
    "fe002.paletteHinweis": "Seiten und Bereiche öffnen. Inhalte finden Sie über „Wissen suchen“.",
  },
  en: {
    "fe002.arbeitsbereiche": "Work areas",
    "fe002.seiteFinden": "Find page",
    "fe002.seiteFindenMenue": "Find page …",
    "fe002.seiteFindenLabel": "Find page (quick access, ⌘K or Ctrl+K)",
    "fe002.wissenSuchen": "Search knowledge",
    "fe002.einstellungen": "Settings and help",
    "fe002.persoenlicheEinstellungen": "Personal settings",
    "fe002.meldungen": "Notifications",
    "fe002.meldungenUngelesen_one": "{{count}} unread notification",
    "fe002.meldungenUngelesen_other": "{{count}} unread notifications",
    "fe002.meldungenKeine": "No unread notifications",
    "fe002.meldungenUnbestaetigt": "Checking notifications",
    "fe002.meldungenLaden": "Loading notifications …",
    "fe002.meldungenFehler":
      "Notifications could not be loaded right now. The number of unread notifications is unknown.",
    "fe002.meldungenNeu_one": "{{count}} new",
    "fe002.meldungenNeu_other": "{{count}} new",
    "fe002.paletteHinweis": "Open pages and areas. To find content, use “Search knowledge”.",
  },
  nl: {
    "fe002.arbeitsbereiche": "Werkgebieden",
    "fe002.seiteFinden": "Pagina vinden",
    "fe002.seiteFindenMenue": "Pagina vinden …",
    "fe002.seiteFindenLabel": "Pagina vinden (snelle toegang, ⌘K of Ctrl+K)",
    "fe002.wissenSuchen": "Kennis zoeken",
    "fe002.einstellungen": "Instellingen en hulp",
    "fe002.persoenlicheEinstellungen": "Persoonlijke instellingen",
    "fe002.meldungen": "Meldingen",
    "fe002.meldungenUngelesen_one": "{{count}} ongelezen melding",
    "fe002.meldungenUngelesen_other": "{{count}} ongelezen meldingen",
    "fe002.meldungenKeine": "Geen ongelezen meldingen",
    "fe002.meldungenUnbestaetigt": "Stand van de meldingen wordt gecontroleerd",
    "fe002.meldungenLaden": "Meldingen worden geladen …",
    "fe002.meldungenFehler":
      "Meldingen konden nu niet worden geladen. Het aantal ongelezen meldingen is onbekend.",
    "fe002.meldungenNeu_one": "{{count}} nieuw",
    "fe002.meldungenNeu_other": "{{count}} nieuw",
    "fe002.paletteHinweis": "Pagina's en gebieden openen. Inhoud vindt u via „Kennis zoeken”.",
  },
} satisfies Textmodul;
