# Jira-Inventar — alle 7 Projekte

_Erfasst 06.07.2026 via Connector. Offene Tickets (statusCategory ≠ Done) im Detail; „Done" als Bestand._
_Methodik: Connector liefert volle Beschreibungen → Ergebnis-Dateien per Grep ausgewertet (Schlüssel+Titel)._

## Überblick
| Projekt | Track | max. Key | Offene Tickets | Aktivität |
|---|---|---|---|---|
| SCRUM | Produkt (Team 1/Paul) | ~464 | **~60 offen** | hochaktiv (Paul) |
| KLLM | Local LLM (Team 2) | ~73 | **~24 offen** | hochaktiv (LLM-Eval + KLARWERK-Gehirn + Insel) |
| KWN | Nerd/Insel | 5 | **5 offen** | aktiv (VIP-Insel-Bau) |
| KWEB | Website (Team 4) | ~111 | ~7 offen | Pedi-getrieben (Videos/Relaunch) |
| KREL | Release-Ops (Team 5) | ~34 | **1 offen** (KREL-34) | ruht seit 01.07. |
| KBB | Business (Team 3) | ~111 | **0 offen** | ruht seit 01.07. |
| KGURU | Gap-Kontrolle (Team 6) | ~30 | **0 offen** | ruht seit 01.07. |

Gesamt-Tickets projektübergreifend ~676 (Berater-Zählung, konsistent mit Key-Bereichen).

## SCRUM — offener Produkt-Backlog (~60)
**Bugs/Betrieb:** SCRUM-464 (Sync→GitHub, High), 463 (Admin Nutzer anlegen), 462 (.app-Launcher ersetzen),
461 (Coolify/Postgres aufräumen), 453 (Bild-Paste), 447 (Hetzner-Inventur), 446 (Ordner-Umzug), 412 (CI-Dialog-Farben).
**VIP-Feedback (05.–06.07.):** 458 (Erfassung radikal vereinfachen), 460 (Suche→KI-Antwort), 459 (Dokument-Fragen),
457 (Entwurf fortsetzen), 456 (Studio-Bild), 455 (PW-Reset-Wdh.), 454 (Erfassen aus Dok „bereits validiert"),
452/451 (Bilder/Sprache aus Datei).
**Erfassen/Studio/KI:** 435 (an Artikel anhängen), 434/433 (Auffindbarkeit), 427 (lange Dok abschnittsweise),
426 (Public-KI-Anreicherung), 424 (zwei KI-Backends), 423 (LLM-Testergebnisse im PMO), 421 (Upload-Grenzen),
414 (externe Wissensabfrage), 409/405 (Fakten aus Dok), 406 (?-Hilfen), 404/403/410 (Editor/Interview/Sprache),
393 (Verhörer-Interview), 386 (konfigurierbare KI-Assist), 428/413 (LLM-Test/KI-Übersicht Admin).
**Vertrauen/Investor/Onboarding:** 444 (Investor-Zahlen als Projektionen), 445 (Zielmarkt „jede Organisation" angleichen),
442 (Beta-Readiness-Kennzahl), 441/440/437 (VIP-Bereitschaft), 439 (Audit-Ketten-Integrität), 438 („Extern·ungeprüft"),
436 (PMO-Sammel-Draft), 432/431/430 (Management-/Executive-Sicht, Export), 429 (Onboarding), 415 (Vertraulichkeit),
425 (Validierungs-Board UI), 420 (Re-Validierung), 402 (Demo-Seed jede Organisation), 395 (Prüfer-Zuweisung),
394 (Admin-Bereiche), 392 (KO-Löschen), 385 (Desktop-App), 448/450/449 (Konflikt-Fundament/Werksreset/Rechte).

## KLLM — Local LLM (Team 2, ~24 offen)
- **LLM-Eval-Kette:** KLLM-55 (Konzept-Neuausrichtung GPU statt MacBook), 56 (Prüfstand), 57 (Eval-Lauf L40S),
  58 (70B-Kurzlauf), 59 (Entscheidungs-Brief Pedi), 60 (Dauerbetrieb), 61 (App-Anbindung lokaler LLM), 54 (Compose).
  Alt/Sandbox: KLLM-3/4/5/7/41.
- **KLARWERK-Gehirn (modellunabhängige Wissens-/Gedächtnisschicht) — Berater-Konzept ticketisiert:**
  KLLM-63 (Dach), 64 (PoC), 65 (Embedding+Vektor-Store bge-m3), 66 (signierter USB-Sync), 67 (Interaktionsgedächtnis),
  68 (MCP-Zugriffsschicht), 69 (KI-Arbeitsgruppe).
- **Insel-Betrieb (Nerd, in KLLM angelegt):** KLLM-62 (Dach Mac-Studio-Insel), 70 (Wiederaufbau-Doku), 71 (E-Mail),
  72 (404-Bug Nutzer anlegen), 73 (HTTPS-Header-Fix).

## KWN — Nerd/Insel (5 offen, alle To Do)
KWN-1 (Offline-Installer), KWN-2 (lokaler LLM + Prüfstand-Abnahme), KWN-3 (USB-Update-Routine),
KWN-4 (Notfall-Fernhilfe-Tunnel), KWN-5 (VIP-Bedienkarte + On-Prem-Blaupause). Ableitung aus KLLM-62-Bausteinen.

## KWEB — Website (Team 4, ~7 offen)
KWEB-104 (Astro-Relaunch v1 + Deploy-App), 106 (Promo-Video Veo-Prompts), 107 (rotierende KO-Beispiele Hero),
108 (Positionierung „jede Organisation"), 109/110/111 (Promo-Video-Varianten Werkhalle/Büro/Lachsfabrik).
→ KWEB-108 bestätigt: Positionierungs-Entscheidung „jede Organisation" ist in die Website-Tickets eingeflossen.

## KREL — Release-Ops (Team 5, 1 offen)
KREL-34 (Beta RC Runtime Smoke Re-Test nach Team-1-Build-Evidence) — der von Team 5 genannte nächste Schritt.

## KBB / KGURU — 0 offen
Beide Projekte vollständig auf „Done" (Team 3 zuletzt KBB-111 / Team 6 KGURU-30, je 01.07.). Ruhend.
