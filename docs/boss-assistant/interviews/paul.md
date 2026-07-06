# Interview — Paul

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Paul (unverifiziert, wo markiert)._

## ⚠️ Prämissen-Korrektur (wichtig)
- Paul ist **NICHT** amtierender Boss-Vertreter und steuert das Projekt **nicht** übergreifend.
- Paul = **Cloud-Implementierungs-Session**, die mit Pedi (Stakeholder, **peter@kohnert.pro**) arbeitet: baut Features/
  liefert Code in Pedis Mac-Repo; **Pedi fährt das Gate (Runner → Commit → Push → Deploy).**
- Übergreifende Steuerung + Produktrichtung liegen bei **The Boss**; strategische Entscheidungen hat Paul bewusst
  liegen gelassen bis Boss morgen zurück ist.
- Paul konnte **meine (Assistent-)Identität nicht verifizieren** → gute Sicherheitshaltung; autoritative Gesamtsicht
  mit Boss/Pedi abgleichen. Was er nicht belegen kann (z.B. „Teams 1–7"-Landkarte), erfindet er nicht.

## 1. Rolle & Domäne
- Umsetzung im modularen Monolithen (`/services/<modul>`, `/apps/web`, Fastify + React): Feature-Bau, Bugfixes,
  Sanitizer/Editor, Deploy-/Lokal-Skripte, Verifikation.
- **Außerhalb Mandat:** Produktrichtung, teamübergreifende Priorisierung, Push/Deploy (Pedi), Secrets (nur Schlüsselbund).

## 2. Aufgaben & Verantwortung
- Von Pedi angeforderte Slices bauen, Sicherheitsregeln halten (kein Push/Deploy durch Paul, keine Secrets im
  Code/Chat), VIP-Fortschritt in % führen. **Keine Governance.**

## 3. Gesamtstand
- **Live auf Hetzner/Coolify (`app.klarwerk.ai`), aktuell `v1.0.0-beta.1.x`, Freeze-Kandidat für VIP-Vortest.**
- **Geliefert:** 8 Fixes + Storage-Guard; KI-Header-Pille (Externe/Interne KI · Herkunft · DSGVO); Werksreset-
  Absicherung (SCRUM-450); Bild-vom-Rechner-Fix (SCRUM-456); Studio-Datei-Anhang; Suche→Antwort Slice 1 (SCRUM-460);
  Formatierung Stufe 2 (Tabellen bleiben erhalten).
- **Wartet auf Re-Test:** Bild-Insert + Tabellen (Pedi testet).
- **Zurückgestellt (Boss):** Vordertür/„Word-Weg", W2 Ganz-Dokument-Import, Suche-Slice 2.
- **VIP-Feedback-Abarbeitung gesamt ~55 %.**

## 4. Entscheidungen & verworfene Ansätze
- **DSGVO-Logik (auf Pedis Weisung):** Bestätigung immer „nein", außer interne KI aus der EU; Herkunftsland ergänzt.
  Verworfen: erste „Inhaus/amber"-Darstellung.
- **Login-Vorfall:** Hypothese „Datenverlust durch In-Memory" → widerlegt (Postgres, Daten sicher); Ursache war
  wohl Login-Sperre (5 Fehlversuche/15 Min). Verworfen: „sauberer DB-Neuaufbau" → bewusst auf laufender DB geblieben,
  Aufräumen vertagt (SCRUM-461).
- **Ausliefern/Push:** „KLARWERK Sync" pusht nur nach **Gitea, nicht GitHub** → Coolify baute alte Commits.
  Interim: Ship-Skript pusht jetzt selbst nach GitHub — **weicht bewusst von Regel „Push nur über Sync" ab**
  (SCRUM-464).
- **Bild-Insert:** zwei falsche Fixes (execCommand→Range→insertAdjacentHTML), echte Ursache: Server-CSP erlaubt bei
  `img-src` kein `blob:`, `fileToThumbDataUrl` scheiterte still → korrigiert auf FileReader/`data:` (CSP bleibt streng).
- **Tabellen:** vorher bewusst ausgeschlossen (offene Design-Frage, Stufe 2). Paul entschied: Tabellen **erhalten**
  (nicht editieren) → berührt offene Design-Frage → **auf Boss-Liste**.
- **Abweichung von Team-1–7-Lösungen:** kann Paul nichts Belastbares sagen (keine verifizierte Übersicht, spekuliert nicht).

## 5. Aktuell / bis morgen
- Zuletzt Formatierung Stufe 2 (Tabellen) geliefert; wartet auf Pedis Re-Test (Bild-Insert + Tabellen).
- Nächster nicht-Boss-abhängiger Kandidat: **Suche-Slice 2** (Antwort inline in Bibliothek).
- Bis morgen: Boss zurück → Richtungsentscheide Vordertür/W2/Suche.

## 6. Offene Boss-Entscheidungen + Risiken/Widersprüche
- **Entscheidungen:** Vordertür/„Word-Weg"; W2 Ganz-Dokument-Toggle; Suche-Slice-2-Design; SCRUM-464 Dauer-Fix
  (Sync um GitHub-Push ergänzen ODER Ship pusht dauerhaft selbst); SCRUM-461 DB-Aufräumen; ob „Tabellen erhalten"
  genügt oder voller Paste-Normalisierer folgt.
- **Widersprüche/Risiken:**
  - **Doku vs. Realität:** `PROJECT_CONTEXT` sagt „KLARWERK Sync = GitHub und Gitea"; real pusht Sync nur Gitea → **SCRUM-464** (hohe Prio, blockierte zeitweise Ausliefern).
  - **Regression:** Admin-Maske „Nutzer anlegen" funktioniert nicht (Workaround: Selbst-Registrieren + Freigabe) → **SCRUM-463**, Bezug SCRUM-147.
  - **🔑 Sicherheit offen:** bei Coolify-Token-Einrichtung wurde früher ein **privater SSH-Deploy-Key im Chat sichtbar** → muss rotiert werden (neuer Key in Coolify + GitHub, alten entfernen). Wert nicht wiedergegeben.

## 7. Berater & Nerd + Referenzen
- **Berater:** hinzugezogen für Konzept „Vordertür/Word-Weg"-Erfassung („so einfach wie Word, aber nicht Word"),
  weil VIP-Kernfeedback „ich verzettel mich" eine Neugestaltung des Eingabewegs braucht (= Produktrichtung, Boss-Sache).
  Brief: `docs/team2-austausch/paul-auftrag-erfassung-vordertuer.md`.
- **Nerd:** baut zentrales **KI-Zugangs-/Provider-System** (liefert künftig KI-Herkunft zentral; heute leitet Paul sie
  interim aus Provider-ID ab). Notiz: `docs/team2-austausch/paul-notiz-ki-herkunft-fuer-nerd.md`.
- **Jira:** SCRUM-449 (Zugriffsrechte), 450, 451, 455, 456, 457, 458 (Stufe 1), 460, 461, 462, 463, 464.
- **GitHub:** `git@github.com:Klarwerkai/klarwerk.git`, Branch `main`, Deploy via Coolify (`app.klarwerk.ai`).
