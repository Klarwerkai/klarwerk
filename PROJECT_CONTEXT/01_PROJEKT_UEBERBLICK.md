# Projekt-Überblick KLARWERK

## Was ist KLARWERK?

KLARWERK ist ein **Reasoning System für Erfahrungswissen**: Organisationen sichern das
Wissen ihrer Experten (erzählen/diktieren/Interview/aus Dokumenten), die KI strukturiert es
zu **Wissensobjekten (KO)**, Kollegen **validieren** es (Peer-Prüfung), und danach ist es
**ehrlich nutzbar**: Fragen werden NUR aus validiertem Wissen beantwortet, mit Quellenangabe —
oder das System sagt ehrlich „dazu liegt kein gesichertes Wissen vor" und startet die
Wissenslücken-Rettung. Kein Halluzinieren, keine Fake-Antworten. Leitmotiv: **Knowledge
Continuity — für jede Organisation** (Industrie, Pflege, Kanzleien, Vereine, Versicherungen,
Berater, NGOs — bewusst NICHT nur Techniker; Pedi-Auftrag 02.07.).

## Wer ist beteiligt?

- **Pedi (Peter Kohnert)** — einziger menschlicher Stakeholder & Product Owner. Nicht-technisch:
  bedient NUR die macOS-Apps auf dem Schreibtisch, Browser, Jira-Oberfläche. Keine Terminals.
- **Boss-Session (Claude)** — koordinierende Session: plant, setzt um, dokumentiert, hält Jira/
  PMO/Guru aktuell. Historisch wurden Aufgaben als Prompts an Ausführungs-Chats („Teams")
  vergeben; seit 02.07. wird meist **alles direkt in der Boss-Session** umgesetzt.
- **Neu ab 03.07.:** ein **zweiter menschlicher Mitarbeiter** mit eigener Claude-Mac-App
  (Regeln dafür: `02_ARBEITSREGELN.md`, Abschnitt „Mehrere Mitarbeiter").

## Team-/Themenstruktur (logische Tracks, Jira-Präfixe)

- **Team 1 · App** (SCRUM-…): die KLARWERK-App selbst (dieses Repo).
- **Team 2 · Lokaler LLM-Server** (KLLM-…): eigener LLM-Server (UpCloud-Eval → Dauerbetrieb), s. Datei 05.
- **Team 3 · Ops** (…): Betrieb/Deploy (Coolify, app.klarwerk.ai) — noch früh.
- **Team 5 · Website** (KWEB-…): öffentliche Website klarwerk.ai (eigenes Repo).
- **Team 6 · Guru** (KGURU-…): Wissens-/Anforderungsregister des Projekts (eigenes Repo, „Meta-KLARWERK").
- **Team 7 · PMO** (PMO-…): Reporting-Dashboard (lokaler Ordner, bewusst OHNE Git) inkl. Prüfstand.
- **Releases** (KREL-…): Release-/RC-Arbeit.

## Die App in einem Absatz (v0.9.x-beta)

Modularer Monolith (Fastify-Module unter `/services`, React-Frontend `/apps/web`), In-Memory/
Dev-Persist-Datenhaltung, i18n DE/EN, Rollen (admin/controller/expert/…), Kernkreislauf:
**Erfassen → Studio strukturieren → Prüfen & einreichen → Validierung (Peers) → Bibliothek →
Fragen (ehrliche Antworten) → Lücken/Konflikte/Lebenszyklus**. Reasoner-Aufgaben (6 Einsätze:
Strukturieren, Schreibhilfe, Interview, Antworten, Kandidaten-Auswahl, Wissen-aus-Datei) laufen
über eine anbieteragnostische `ModelClient`-Abstraktion — heute Anthropic-API, morgen zusätzlich
eigener vLLM-Server (KLLM-61). Ohne gültigen Key: **deterministischer Fallback, ehrlich markiert**.

## Produkt-Grundsätze (in jeder Entscheidung spürbar)

1. Ehrlichkeit vor Optik (keine Schein-Funktionen, ehrliche Leere-Zustände).
2. Der Mensch übernimmt bewusst — KI macht Vorschläge, speichert nie automatisch.
3. Validierung trägt das Vertrauen (Stufe-Modell; externe Quellen sind Stufe 2, nie peer-Ersatz).
4. Progressive Disclosure + ?-Hilfen — Pedi ist Maßstab: „selbst ich verliere mich hier" ⇒ Hilfe fehlt.
5. Jede Organisation als Zielgruppe (Beispiele/Sprache nie nur Industrie).
