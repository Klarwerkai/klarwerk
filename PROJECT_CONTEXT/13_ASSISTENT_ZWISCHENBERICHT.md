# 13 · Zwischenbericht des Boss-Assistenten — Status quo KLARWERK

> Erstellt 06.07.2026 vom **Assistenten** (Boss-Assistent) nach Befragung aller Agenten +
> Verifikation gegen `dev_Klarwerk`-Repo, Git-Log und Jira-Connector.
> Arbeits-/Rohstand: `docs/boss-assistant/` (Interviews, Widersprüche, Timeline, offene Fragen).
> **Lesbar auch für ein Nachfolge-Onboarding.**

## 0. In einem Satz
KLARWERK ist eine live betriebene Beta (`app.klarwerk.ai`, **v1.0.0-beta.1.4**) eines „Knowledge OS für
Erfahrungswissen"; der Produktkern steht, aber der Weg zur echten Beta hängt an Betriebssicherheit
(Backup/Bus-Faktor), ungetesteten Produktionspfaden und einigen Steuerungs-/Doku-Altlasten — nicht am Funktionskern.

## 1. Wer arbeitet woran (verifiziert)
- **Pedi** — Mensch, einziger Stakeholder; trifft alle materiellen Entscheidungen, fährt Runner/Commit/Push/Deploy.
- **The Boss** — Steuerungs-Session (im Urlaub bis Di. 07.07.), Koordination + Produktrichtung.
- **Paul** — Cloud-Implementierungs-Session; baut Features im Produkt-Repo, **keine Governance**. Liefert → Pedi committet.
- **Berater** — externer, read-only Architektur-/Produktberater (Audit, Konzepte, Hilfe/Bibliothek, Erfassungs-UX).
- **Nerd** — Betrieb der air-gapped Mac-Studio-Insel (lokaler LLM), Jira-Projekt **KWN**.
- **Assistent (ich)** — Wissensbasis, Verifikation, Onboarding-Vorbereitung.
- **Teams 1–7** — heute primär **logische Tracks / Jira-Präfixe** (Entscheidung 02.07.), nicht mehr getrennt aktive Agenten.

### Architektur- & Repo-Landkarte (7 Jira-Projekte, verifiziert)
| Track | Jira | Repo/Ort | Rolle | Zuletzt aktiv |
|---|---|---|---|---|
| Team 1 Produktkern | SCRUM | `dev_Klarwerk` | Knowledge-OS-App (Node/Fastify/React) | laufend (Paul) |
| Team 2 Local LLM | KLLM | `klarwerk-local-llm` | Eigener LLM (UpCloud-Eval, Insel) | 04.–05.07. |
| Team 3 Business | KBB | `klarwerk-business-backend` | Pilot-/Commercial-Blueprint (nur Doku) | 01.07. |
| Team 4 Website | KWEB | `klarwerk-public-website` | Öffentliche Marketing-Site | ~01.07. |
| Team 5 Release Ops | KREL | `klarwerk-release-ops` | Beta-QA / RC-Bewertung (Doku) | 01.07. |
| Team 6 Gap-Kontrolle | KGURU | `klarwerk-knowledge-guru` | read-only Pflichtenheft-/Gap-Prüfung | 01.07. |
| Nerd Insel | KWN | Mac Studio + `dev_Klarwerk` | air-gapped On-Prem-Betrieb | 05.07. |
| Team 7 PMO | — (kein Jira) | `KLARWERK_Reporting_PMO` (lokal) | Reporting-Dashboard, PMO-Automatik | laufend |

## 2. Produktstand (verifiziert am Repo)
- **Live:** `app.klarwerk.ai` auf Hetzner/Coolify, **v1.0.0-beta.1.4** (06.07.). Versionsquelle `apps/web/src/version.ts`,
  Schema `1.0.0-beta.<Freeze>.<Push-Zähler>`.
- **Funktionskern** (Erfassen → Studio → Validieren → Fragen/Ask → Audit) steht; jüngste Lieferungen: KI-Herkunfts-/
  DSGVO-Pille, Werksreset (SCRUM-450), Bild-vom-Rechner + Bild-Insert-Fix (CSP/blob), Formatierung Stufe 2 (Tabellen),
  Suche→Antwort Slice 1 (SCRUM-460), Konflikt-/Duplikaterkennung („jeder gegen jeden").
- **VIP-Feedback-Abarbeitung ~55 %** (Paul); RC-Bewertung Team 5: „ready_for_pedi_review: yes, conditional_ready_for_beta: no".
- **Lebende PMO-Zahl (`pmo-items.json`, verifiziert 06.07.):** 144 Items — 28 done, 34 partially_done, 53 recognized,
  5 in_progress, 10 planned, 6 blocked, 5 paused (alle Team 2), 2 deferred, 1 archiviert. **P0 = 13.**
  **Beta-relevant (high): 49 Items, davon 19 done (≈ 39 %).**
  Wichtig: **12 der 13 P0 sind Team 3 (Legal/Go-No-Go) und Team 5 (RC/Smoke)** — nur 1 P0 ist Produktkern
  (Beta Core Flow, partially_done). → belegt: die Beta hängt an Gates/Betrieb, nicht am Funktionskern.
- **Ehrlichkeits-DNA** (verifiziert im Repo/Tickets): deterministischer Fallback statt Fake-KI, Quellenbindung,
  Wissenslücke statt Erfindung, Trust-Deckel **99** (SCRUM-359), KI speichert nie automatisch.

## 3. Steuerungs-Timeline (3 Phasen)
1. **Bis 02.07. — manuell:** Pedi moderierte Team-Chats; Kernproblem Wissensverlust je Session-Ende.
2. **02.–03.07. — Boss-zentral:** „Alles direkt in der Boss-Session"; Teams werden zu Jira-Tracks; v0.9.14–0.9.21 +
   Werkzeuglandschaft (Sync-/LLM-/Prüfstand-Apps).
3. **Seit 03.07. abends — arbeitsteilig (Budget):** Paul baut · Pedi fährt Gates/Commit/Push · Boss pausiert bis Di.
   Freeze `v1.0.0-beta.1` (03.07.) → **aufgehoben 04.07.** (Geschwindigkeit über Stand-Stabilität, mit Auflagen;
   nächster Tag `v1.0.0-beta.2` am Di.).

## 4. Wichtigste offene Risiken (für Boss-Entscheidung)
1. **Backup / Bus-Faktor:** PMO-/Schlüsseldaten nur lokal auf Pedis Mac; Mac-Studio-Insel = SPOF ohne verifizierten
   Wiederaufbau (Berater-K1, PMO-RISK-0001). **→ Pedi-Entscheidung 06.07.: ein Systemadministrator wird eingestellt,
   der Datenverwaltung/Backup übernimmt.** Bis Besetzung bleibt das Restrisiko.
2. **Persistenz (C-13 aufgelöst) + K3:** drei Umgebungen — **Live-Server = Postgres** (Coolify/`DATABASE_URL`),
   **Desktop-App = Journal** (`.localdb`), **Mac-Studio-Insel = Journal OHNE Backup** (Nerd bestätigt: bei Plattendefekt
   weg, SPOF KLLM-70). Offen: Postgres-Pfad nicht über alle Module verifiziert (K3); Insel-Backup + DB-Weg unentschieden;
   RC-Laufzeit-Smoke, Pen-Test (AG-07), Restore/DR (AG-09), Load/Scale (AG-03) — Aufgaben des Systemadministrators.
3. **Key-Rotationen:** Pedi 06.07.: **Keys sind sicher; planmäßige Erneuerung während der Beta-Phase** (kein Leck, nicht dringlich).
4. **Auslieferungs-Kette (SCRUM-464, High):** „KLARWERK Sync" pusht nur Gitea, nicht GitHub → Coolify baute Altstände;
   06.07. per Ship-Skript umgangen, Dauer-Fix (Sync erweitern) noch zu entscheiden.
5. **Admin-Regression (SCRUM-463):** „Nutzer anlegen" defekt (Workaround Selbst-Registrieren).
6. **Prozess/Governance:** Session-/Commit-Zuordnung auf dem Mac nicht eindeutig (alle Commits = `peterkohnert@mac`);
   Mandate für „Assistent" und „Nerd" (noch) nicht im Entscheidungs-Log.

## 5. Offene Produktrichtungs-Entscheidungen (warten auf Boss)
- **Erfassungs-„Vordertür" / Word-Weg** (VIP-Kernfeedback „ich verzettel mich") — Berater-Konzept liegt, nicht gebaut.
- **W2 Ganz-Dokument-Import** vs. eigene Herkunftsart „externe Referenz" (Berater warnt vor „Dokumentenhalde").
- **Suche-Slice 2** (Antwort/Summary inline in der Bibliothek, SCRUM-460).
- **Terminologie** (4 ⚑-Entscheidungen: Anzeigename „Wissensobjekt/-eintrag"; „Bus-Faktor" als Hauptbegriff?).
- **Local-LLM-Betriebsmodell** nach Eval-Sitzung 2 (Credit-Fenster UpCloud verfällt ~01.08.).

## 6. Aufgelöste/geklärte Widersprüche (Kurz)
- „Team 2 pausiert" = **präzisiert:** In `pmo-items.json` sind 5 Team-2-Items bewusst als `paused` geführt —
  das ist ein **Beta-Scope-Label** (Team 2 aus der Beta ausgeparkt, D-012), NICHT „Team 2 inaktiv". Real entwickelt
  Team 2 aktiv weiter (`klarwerk-local-llm`-Commits, KLLM-62). Beides gleichzeitig wahr.
- „45 %" = veraltete `app.js`-Anzeige; **lebende Zahl jetzt verifiziert** (s. oben: 28/144 done, beta-relevant 19/49).
  Die „13 P0" stimmen zufällig noch, sind aber zu ~92 % Team-3/5-Gate-Themen, nicht Produktbugs.
- Positionierung „Industrie vs. jede Organisation" = per Pedi-Entscheidung **„jede Organisation"**; Specs nachziehen.
- `d25e7df` = dokumentierter arbeitsteiliger Commit (Paul-Liefervorrat, Pedi committet), kein Fremdzugriff.

## 6a. Tiefenprüfung (Nachtrag 06.07.)
- **Maßgebliche Tiefenquelle:** `docs/qm/BERATER_AUDIT_2026-07-03.md` — vollständiger, belegter Projekt-Audit
  (bestätigt alle Kernrisiken). Für Boss/Nachfolger die beste Einzeldatei nach diesem Bericht.
- **Jira vollständig inventarisiert** (`docs/boss-assistant/jira-inventar.md`): 7 Projekte, ~676 Tickets; offener
  Produkt-Backlog ~60 (SCRUM), Team 2 (KLLM) ~24 offen inkl. neuer strategischer Serie **„KLARWERK-Gehirn"**
  (KLLM-63…69: modellunabhängige Wissens-/Gedächtnisschicht mit lokalem Embedding bge-m3 + Vektor-Store). KBB/KGURU
  0 offen (ruhend).
- **Code-Struktur kartiert** (`docs/boss-assistant/code-map.md`): 21 Service-Module, 20 Seiten, 158 lib-Helfer,
  195 Tests; Modulgrenzen per dependency-cruiser erzwungen.
- **Neue offene Frage (C-13):** Läuft die Live-Beta auf **In-Memory + Dev-Journal** (Berater 03.07.) oder **Postgres**
  (Paul 06.07.)? Für Backup/DR hochrelevant — zu klären.
- **Team-2-Eval präzisiert (C-14):** Qwen3-32B erreicht **22/24 = Claude-Niveau mit Denkmodus aus** (1,7 s vs. 3,3 s);
  der dem VIP vorgelegte Vorsichtswert ist 16/24.

## 7. Verifikationsgrenzen (ehrlich)
Über die Shell erreiche ich **nur `dev_Klarwerk`**. Schwester-Repos + `pmo-items.json` konnte ich nicht direkt
prüfen — deren Innenstände beruhen auf Selbstauskunft + Jira, nicht auf Dateiprüfung. Jira wurde per Connector
verifiziert (7 Projekte, Schlüssel-Tickets). Team-Aussagen sind, wo bestätigbar, konsistent.

## 8. Nächste Schritte des Assistenten
- **Team 2:** Agent beendet/nicht mehr erreichbar (Pedi 06.07.) — direkte Befragung entfällt; Wissen nur noch aus
  `klarwerk-local-llm`-Repo + KLLM-Tickets. Track wird von Paul/Nerd fortgeführt.
- **C-13 geschlossen** (Paul+Nerd+Code): Live=Postgres (fail-loud-Guard), Desktop/Insel=Journal; Insel ohne Backup;
  K3 offen (nur 1 Real-PG-Integrationstest, viele Module nur laufzeit-erprobt) → Systemadministrator.
- Für Boss zu entscheiden: Ticket „Backup + DB-Entscheidung Insel" (Nerd bietet Anlage an); Systemadministrator einstellen.
- Diese Datei bei größeren Änderungen fortschreiben; Detailtiefe bleibt in `docs/boss-assistant/`.

## Team-Status (Agenten) — Stand 06.07.
| Track | Agent erreichbar? | zuletzt aktiv |
|---|---|---|
| Team 1 Produkt | über Paul fortgeführt | laufend |
| Team 2 Local LLM | **nein (beendet)** | ~05.07. |
| Team 3 Business | nein (Urlaub) | 01.07. |
| Team 4 Website | nein (Urlaub) | ~01.07. |
| Team 5 Release-Ops | nein (Urlaub) | 01.07. |
| Team 6 Gap-Kontrolle | nein (Urlaub) | 01.07. |
| Team 7 PMO | via Automatik/Paul | laufend |
| Boss | zurück ab Di. 07.07. | pausiert |
| Paul · Berater · Nerd | ja | laufend |
