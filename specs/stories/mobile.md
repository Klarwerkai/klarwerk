# Modul: mobile — Mobile / PWA

> Quelle: Pflichtenheft §3.12 (FR-MOB-01…03), NFR-UX-03. Jira-Epic: KW-MOB.

## Ziel
Mobile Nutzung mit Fokus auf Erfassen/Fragen/Entwürfe, installierbar als PWA, mit
In-App-Bestätigungen statt nativer Dialoge.

## User Stories & Akzeptanzkriterien

### FR-MOB-01 · PWA-Mobilansicht (MUSS)
- [ ] **Gegeben** „Zum Home-Bildschirm", **dann** Vollbild-App mit Icon und Offline-Start (Aufnehmen/Fragen/Entwürfe/Wissen).

### FR-MOB-02 · Entwurf als Primäraktion (MUSS)
- [ ] **Gegeben** mobil Notiz/Interview, **dann** beide Modi vorhanden; der Entwurf-Button ist dominant.

### FR-MOB-03 · In-App-Bestätigung (MUSS)
- [ ] **Gegeben** eine destruktive Aktion mobil, **dann** Inline-Bestätigung (kein nativer Dialog).

## API / Schnittstellen (Entwurf)
Nutzt bestehende `capture`/`ask`-Endpunkte. PWA: Manifest + Service Worker (Offline-Shell, Cache).

## Datenmodell
Keine eigene Persistenz; teilt sich `drafts`/`kos`. Offline-Queue siehe FR-CAP-09.

## Nicht-Ziele (v1)
Native Store-Apps (Out of Scope §6).

## Offene Fragen
Umfang Offline-Funktionen · Push-Mechanik mobil (mit FR-VAL-07 abstimmen).
