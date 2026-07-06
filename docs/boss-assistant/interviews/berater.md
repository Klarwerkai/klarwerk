# Interview — Berater

_Erhalten: 2026-07-06. Quelle: Selbstauskunft Berater (unabhängiger Architektur-/Produktberater)._

## 1. Rolle & Domäne
- **Externer, unabhängiger Architektur- und Produktberater** für KLARWERK, im Auftrag von Pedi (alleiniger
  Stakeholder), techn. Koordination über Paul. **Arbeitet ausschließlich lesend & konzeptionell** — schreibt
  Berichte/Konzepte, fasst Code/Tickets nicht an.
- Domäne über die Zeit: Gesamt-Projektaudit, Konflikt-/Duplikatlogik, Prüfstand-Testdesign, modellunabhängige
  Wissensschicht, Anwender-Hilfe/Wissensbibliothek, zuletzt Erfassungs-UX („Vordertür").

## 2. Aufgaben & Verantwortung
- Ist-Analyse & Schwachstellenbewertung; gate-sauber umsetzbare Fachkonzepte; ehrliche Gegenproben zu Projektthesen;
  Klärungsfragen statt Raten. **Verantwortet Richtigkeit/Ehrlichkeit der Empfehlungen, nicht deren Einbau.**

## 3. Stand der Recherchen
- **Abgeschlossen:** Gesamtaudit 03.07.; Fachkonzept Konflikte/Rollen/Datei/Import 04.07.; Konflikterkennung 04.07.;
  Duplikate 04.07.; 53 Prüfstand-Testfälle 04.07.; Wissensschicht „KLARWERK-Gehirn" 05.07.; Hilfe-Lieferung 1 04.07.;
  49 Klara-Sektionstexte 05.07.; 77 FAQ-Antworten 05.07.; Erfassungs-Vordertür 06.07.
- **Laufend:** Audit 255 Kurzhilfen gegen `docs/hilfe/HILFE-REGISTER.md` (Lieferung 2); Bibliotheks-Artikel Teil 0
  (Lieferung 3b); EN-Fassungen.
- **Offen/wartend:** Lieferung 4 (Konzept Hilfe-Assistent Klara, zurückgestellt bis Bibliothek steht); vier
  ⚑-Terminologie-Entscheidungen bei Pedi.

## 4. Wichtigste Empfehlungen (inkl. revidierter)
- **Audit 03.07. Top-Empfehlungen:** vor VIP einfrieren + **Backup der nur lokal existierenden PMO-/Schlüsseldaten
  (K1)** + Generalprobe; danach Postgres-Pfad real testen (K3), RBAC-Selbstaussperrung fixen (H7), Sicherheits-Härtung
  vor Internet-Deploy. **Kernbotschaft: nicht der Funktionskern gefährdet die Beta, sondern Backup/Bus-Faktor, weiche
  Gates und der ungetestete Produktionspfad.**
- **Revidiert — Konflikt-Auto-Anlegen:** erst empfahl er nur Vorschlag + menschliche Bestätigung (A0-6); Pedis Auftrag
  setzte „automatisch anlegen" verbindlich → Empfehlung selbst revidiert, Ehrlichkeit über „Rauchmelder"-Logik +
  Zitat-Wächter gesichert.
- **Revidiert — Duplikat:** erst `duplicate` als 6. Konflikttyp; auf Pedis Wunsch eigene Seite → zurückgezogen,
  eigenständiges Duplikat-Konzept (Enum-Zusatz explizit widerrufen). Begründung: Konflikt = „evtl. falsch" vs.
  Überschneidung = „Bestand unaufgeräumt" — nicht mischen.
- **Wissensschicht:** „OB1-Muster übernehmen, Code selbst bauen" (gegen 1:1-Adoption) — wegen FSL-Lizenz
  (2-Jahres-Konkurrenzklausel), Supabase/Cloud-Kopplung (Air-Gap-untauglich), Gefahr doppelter Wissens-Datenmodelle.

## 5. Offene Fragen & Abhängigkeiten
- Umsetzung durch Paul (Code) unter Pedis Freigabe; Berater liefert nur Vorlagen.
- Wartet auf **vier ⚑-Terminologie-Entscheidungen** (Anzeigename „Wissensobjekt/Wissenseintrag"; ob „Bus-Faktor"
  Hauptbegriff bleibt) — Voraussetzung für konsistente Bibliothek + Synonym-Suche.
- **Vordertür (06.07.):** Boss-Abgleich steht aus; ist Empfehlung, nicht gebaut. Editor-/Sanitizer-Annahmen von Paul
  gegen Code zu prüfen.

## 6. Risiken, Fallstricke & Widersprüche
- **Hervorgehobene Risiken:** Bus-Faktor auf Pedi + Session-Konstruktion (K4 = PMO-RISK-0001); ungetesteter Postgres-/
  `test:integration`-Pfad (K3); **Gate-Erosion (K2, Block ohne Gate-Lauf geliefert)**; Wissensschicht-Kernbefund
  „das Embedding-Modell ist auch ein Modell" — die einzige nicht frei tauschbare Modellkomponente, im Auftrag nicht
  adressiert; Vordertür-Widerspruch: „Ganz-Dokument-Import als verlässlich" kippt Bibliothek zur Dokumentenhalde
  (Empfehlung: eigene Herkunftsart „externe Referenz" mit Prüffrage, nicht Default).
- **⚠️ Divergenz Empfehlung ↔ gebaut:** empfahl Vier-Augen-Prüfung fremder Beiträge (B2-9); laut Pauls belegter
  P-3-Antwort **nicht so gebaut** — Prüfen bleibt Controller/Admin, keine „wirksame Rolle"-Anzeige. Berater passte
  B2-9 + FAQ an die **Realität** an, nicht an seine Empfehlung. Umgekehrt: Audit-Sorge „Vertraulichkeit nicht
  integriert" war überholt — ist gebaut (v1, Grenze: schützt vor Abfluss nach außen, versteckt nichts vor Kollegen).
- **Dokumentierte Projekt-Widersprüche (unabhängig bestätigt):**
  - Positionierung **„Industrie" (Specs) vs. „jede Organisation" (Website/Kurs)**.
  - **Versions-/Dashboard-Drift:** Doku v0.9.22 vs. Code **v0.9.45**; PMO „Beta ~35 %"; **Team 2 als „pausiert" trotz
    Eval-Erfolg** → deckt sich mit C-03/C-04 (Dashboard-Stale-Data).
  - **Trust=100 in Alt-Tests vs. nachträglich TRUST_MAX 99** (SCRUM-359).
  - KWEB-107/108 Ticket-/Commit-Kreuz.
  - Terminologie: `chelp.knowledgeType.body` nennt „Erfahrungs-/Prozess-/Faktenwissen" statt Bauchgefühl/Best
    Practice/Lernkurve/Technik/Negativwissen.

## 7. Übergabewissen: Quellen, Analysen, Ablageorte
- **Analysegrundlagen:** PROJECT_CONTEXT 00–12, CLAUDE.md, `docs/qm/claude-after-report.md` (**10.874 Zeilen**),
  **alle 676 Jira-Tickets (SCRUM/KLLM/KWEB/KGURU/KREL) per API**, PMO `data/pmo-items.json` (144 Items),
  Prüfstand-Ergebnisse, Git-Reflog, Code-Stichproben (`services/`, `apps/web/`, `tests/security/routeGuardAudit.ts`),
  ARGUS/Specs; `docs/team2-austausch/paul-antworten-P1-P10.md` (Ehrlichkeitsanker), `docs/hilfe/HILFE-REGISTER.md` (255 Texte).
- **Ablageorte `docs/qm/`:** `BERATER_AUDIT_2026-07-03.md`, `BERATER_FRAGEN_2026-07-03.md`,
  `BERATER_KONZEPT_KONFLIKTE_ROLLEN_DATEIEN_2026-07-04.md`, `BERATER_KONZEPT_KONFLIKTERKENNUNG_2026-07-04.md`,
  `BERATER_KONZEPT_DUPLIKATE_2026-07-04.md`, `BERATER_PRUEFSTAND_TESTFAELLE_V2_2026-07-04.json`,
  `BERATER_KONZEPT_WISSENSSCHICHT_KLARWERK-GEHIRN_2026-07-05.md`, `HILFE_LIEFERUNG-1_..._2026-07-04.md`.
- **`docs/team2-austausch/`:** `berater-hilfetexte-elemente-LIEFERUNG.md` (49 Klara-Texte),
  `HILFE_LIEFERUNG-3a_FAQ-ANTWORTEN_2026-07-05.md` (77 FAQ), `berater-konzept-erfassung-vordertuer.md`.
- **Tickets/Bezüge:** SCRUM (App-Kern), KLLM-56/57/59/60/61/62 (Prüfstand/Eval/KI-Verwaltung/Insel), KWN-2
  (Insel-Prüfstand), KWN-3 (USB-Update), SCRUM-359 (Trust 99), SCRUM-414/424/426 (externe/duale KI), SCRUM-415
  (Vertraulichkeit), SCRUM-422 (Papierkorb), SCRUM-393 (Interview-Nachbohren, offen), D-010 (Kanzlei/Datenschutz),
  PMO-RISK-0001 (Bus-Faktor). Referenzsystem Wissensschicht: **OB1 „Open Brain" (FSL-1.1-MIT)**.
