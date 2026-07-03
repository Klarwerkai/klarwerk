# Pedi-Entscheidungen 03.07. (Berater-Fragen) — Umsetzungsplan

> Quelle: BERATER_FRAGEN_2026-07-03.md mit Pedis Antworten. Verantwortlich: Boss-Session (Admin),
> Paul (Umsetzung), Pedi (Zugänge/Käufe/Abnahmen).

## Entschieden (ins Entscheidungs-Log übernommen)

1. **RC-Freeze: JA.** Reihenfolge: ① Paul fixt SCRUM-443 (RBAC, klein) ② Freeze-Slice
   (Version `1.0.0-beta.1`) ③ Runner grün ④ Boss committet + setzt Git-Tag `v1.0.0-beta.1`
   ⑤ ab dann NUR noch Fixes bis nach dem VIP-Termin. Generalprobe 04.07. auf exakt diesem Stand.
2. **Pilot:** erst nach dem ersten Beta-Test; eigener, separater Server nur für den Kunden,
   ohne unseren Zugang.
3. **Beta-Betrieb:** eigener Hetzner-Cloud-Server je Beta-Kunde, Subdomain von klarwerk.ai.
   Konsequenz (Berater K3/H3/M8): Postgres-Nachweis + Sicherheits-Härtung + trustProxy werden
   VORAUSSETZUNG vor dem ersten Deploy — eigene Ticket-Serie nach dem VIP-Termin.
4. **LLM:** aus Kostengründen vorerst bestehende Lösung (Anthropic); Eval-Sitzung 2 (14B/Mistral)
   im Credit-Fenster (~01.08.) abschließen; für die Beta wird ein eigener Plan gemacht.
5. **Zielmarkt: „jede Organisation" ist verbindlich** → Specs/Glossar/Demo-Pfad nachziehen (Ticket).
   Kategorielabel: Vorschlag Boss = einheitlich **„Reasoning System"** (CI-Wortmarke) — Pedi bestätigt/verwirft.
6. **Investor-Zahlen:** als gekennzeichnete **Projektionen/Beispiele** umformulieren — vor 05.07. (Ticket).
7. **Ordner-Umzug** nach `~/Documents/KLARWERK-Projekt/`: JA — koordiniert, erst kopieren → testen →
   dann alt löschen. Empfehlung Boss: **NACH dem VIP-Termin** (05.07.), weil Sync-Skript, alle
   Schreibtisch-Apps, Paul-Runner und Freigaben fest auf die heutigen Pfade zeigen (Plan unten).

## Q6 · Zugänge für die zweite Person (Pedi legt an — Checkliste)

| # | System | Was anlegen | Hinweis |
|---|---|---|---|
| 1 | **Jira** klarwerk.atlassian.net | Eigenes Konto einladen + Rolle Admin | zweiter Site-Admin = Notfall-Übernahme |
| 2 | **GitHub** Org Klarwerkai | Eigenes Konto als Org-Owner/Admin | NICHT dein Konto teilen; eigener PAT |
| 3 | **Gitea** (localhost:3000) | Zweites Admin-Konto | läuft lokal auf deinem Mac — beim Umzug/Backup mitdenken |
| 4 | **Anthropic Console** | Als Mitglied der Organisation einladen | eigener API-Key, nie Keys teilen |
| 5 | **UpCloud** | Sub-Account/2. Benutzer (Teams-Funktion) | Käufe bleiben trotzdem nur bei dir |
| 6 | **Hetzner** (kommt für Beta) | Beim Anlegen direkt 2. Benutzer einrichten | |
| 7 | **Domain/DNS klarwerk.ai** (Registrar/Cloudflare) | 2. Benutzer oder dokumentierter Notfall-Zugang | für Subdomain-Anlage Beta nötig |
| 8 | **Google (Gemini/Veo)** | optional 2. Nutzer | nur Videos, unkritisch |
| 9 | **Passwortmanager** (NEU, s. Backup) | Gemeinsamer Tresor „KLARWERK" | Fundament für alles Obige |
| 10 | **SSH LLM-Server** | Eigenes Schlüsselpaar der 2. Person erzeugen + bei UpCloud hinterlegen | Private Keys werden NIE geteilt |

Danach: einseitige **Notfallkarte** in PROJECT_CONTEXT (wer übernimmt was bei Mac-/Personenausfall) — schreibt Paul, sobald die Konten existieren.

## Q9 · Alt-Secrets — Rotationsliste (Pedi kontrolliert, setzt neu, dann Klartext-Stellen melden)

| # | Secret | Fundort (Klartext) | Aktion |
|---|---|---|---|
| 1 | Cloudflare-Token (ARGUS-Ära) | ARGUS-Projekt-Handbuch §8 / Chatverläufe | Noch aktiv? → widerrufen bzw. rotieren |
| 2 | Alter Anthropic-Key (ARGUS-Ära) | ehem. Chatverlauf | in Console prüfen → widerrufen |
| 3 | Demo-Basic-Auth | `ARGUS/PROJEKT-DOKUMENTATION.md` | Zugang tot? sonst ändern; Stelle schwärzen |
| 4 | `open-engine/.env.local` | Klartext-Datei im ARGUS-Umfeld | Inhalt prüfen → rotieren, Datei löschen |
| 5 | (vorsorglich) aktueller Anthropic-App-Key | nur Schlüsselbund | bei Gelegenheit rotieren (Hygiene) |
| 6 | (vorsorglich) UpCloud-API-Token | nur Schlüsselbund | nach Eval-Ende rotieren |
| 7 | GitHub-PAT(s) | credential helper | Ablaufdatum setzen/prüfen |

Nach Rotation: kurze Meldung, dann lässt Boss/Paul die Klartext-Stellen in den Alt-Dokumenten schwärzen.

## #2 · Backup MIT Zweitperson-Zugang — Vorschlag (Pedi wählt)

**Empfehlung (Kombination A+B+C):**
- **A · PMO-Ordner → privates GitHub-Repo** (`klarwerk-reporting-pmo`), in die Sync-App aufnehmen.
  Kehrt die alte „bewusst ohne Git"-Entscheidung um — das Audit hat die Abwägung verändert:
  Offsite-Backup + Versionierung + Zugriff der zweiten Person wiegen schwerer. Enthält KEINE Secrets → git-tauglich.
- **B · Gemeinsamer Passwortmanager** (Bitwarden Organisation oder 1Password Teams, ~0–5 €/Monat):
  geteilter Tresor „KLARWERK" mit allen Konten-Zugängen + Recovery-Codes. Ersetzt NICHT den
  macOS-Schlüsselbund für App-Laufzeit-Keys, ist aber die Notfall-Hinterlegung für Menschen.
  SSH-Private-Keys bleiben je Person lokal (jeder eigenes Paar, Public Keys hinterlegt).
- **C · Time Machine aktiv halten** (ganzer Mac, inkl. Gitea-Daten) — prüfen: letztes Backup-Datum!
- Optional D: verschlüsselter USB-Stick mit `llm-eval-zugang/` + Recovery-Codes im Safe.

## Q8 · Umzugsplan `~/Documents/KLARWERK-Projekt/` (Ticket, NACH 05.07.)

Phase 1 Inventur: alle Pfad-Verweise (Sync-.command, alle App-Hüllen, Paul-Runner, PROJECT_CONTEXT 03/06,
Gitea-Remotes, Cowork-Freigaben). Phase 2 KOPIEREN (nicht verschieben) in neue Struktur
(`KLARWERK-Projekt/{dev_Klarwerk, Klarwerk, KLARWERK_Reporting_PMO, Argus}`), alle Skripte/Apps auf
neue Pfade, Freigaben neu setzen (nur noch dieser Ordner!). Phase 3 testen: Sync, App-Start, Runner,
Prüfstand, ein kompletter Ticket-Durchlauf. Phase 4 erst nach mehrtägigem fehlerfreiem Betrieb:
Alt-Ordner löschen. Private Dokumente bleiben unangetastet außerhalb. Koordination: Boss kündigt
Umzugsfenster an, Paul pausiert währenddessen.
