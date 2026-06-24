# KLARWERK — Frontend-Funktions-Checkliste & Jira-Bauplan

> **Stand:** 23.06.2026 · **Quelle:** Konsolidiert aus Alt-App-Code (`app/`+`demo/`), `Frontend-Gesamtuebersicht.md`,
> `klarwerk_master_frontend_live_app.md` und `KLARWERK-GESAMTUEBERSICHT-ZUR-PRUEFUNG.md`.
>
> **Zweck:** (1) Jede einzelne Frontend-Funktion **abhakbar** machen — getrennt nach **Gebaut** und **Getestet**.
> (2) Klare **FRONTEND/BACKEND-Zuordnung** für Jira-Labels. (3) **Fehlende Funktionen** ergänzen.
> (4) Jederzeit den Entwicklungsstand sehen.
>
> **Spalten-Legende:**
> - **Label:** `FE` = Frontend · `BE` = Backend · `FE+BE` = beides nötig
> - **BE-API:** ✅ Backend-Modul vorhanden · ❓ Backend-Lücke (zuerst schließen)
> - **Reife (Alt):** **A** = real vorhanden · **V** = funktional/vorhanden · **D** = Demo/Beispieldaten (nur produktiv, wenn datenbasiert)
> - **Stufe:** Pilotkern (1) / Unternehmensbetrieb (2) — aus „Konsolidierter Zielumfang"
> - **[ ] G** = Gebaut · **[ ] T** = Getestet (erst beides → Funktion gilt als fertig)

---

## A. Wie wir das in Jira abbilden (Vorschlag)

**Labels (auf jedem Ticket):**
- `FRONTEND` — Ticket enthält Frontend-Themen.
- `BACKEND` — Ticket enthält Backend-Themen.
- (Tickets mit beidem bekommen **beide** Labels.)
- Optional ergänzend: `STUFE-1`/`STUFE-2`, `REIFE-D` (Demo, Vorsicht), `BE-LUECKE` (Backend muss erst nachgezogen werden).

**Statusfluss (alle noch nicht erledigten Tickets → `To Do`):**
`To Do → In Progress → In Review/Test → Done`. „Done" nur, wenn **Gebaut UND Getestet**.

**Checklisten-Mechanismus — 3 Optionen, Empfehlung:**
1. **Empfohlen: Story je Funktion + 2 Sub-Tasks** („Implementieren", „Testen"). Vorteil: Board zeigt Live-Status, jeder Punkt einzeln abhakbar, Fortschritt rollt zur Epic hoch. → Genau dein „jederzeit Stand sehen".
2. **Leichtgewichtig:** Ein **„FRONTEND-MASTER-CHECKLISTE"**-Ticket je Domäne mit **Beschreibungs-Checkboxen** (Jira-Task-Listen) — pro Funktion `[ ] Gebaut [ ] Getestet`. Schnell, aber kein Einzel-Status.
3. **Add-on:** „Smart Checklist"/„Issue Checklist"-App (Marketplace) für reiche Checklisten — nur falls installierbar.

→ Mein Vorschlag: **Option 1** als verbindliche Arbeitsstruktur **plus** je Domäne ein **Master-Checklisten-Ticket (Option 2)** als Schnellübersicht. Beides spiegelt diese Datei 1:1.

**Epic-Struktur Frontend (neue Epics, Label FRONTEND):**
`KW-FE-FND` Foundation · `KW-FE-AUTH` Auth/Onboarding · `KW-FE-CAP` Capture/Studio · `KW-FE-KO` Wissensobjekt ·
`KW-FE-VAL` Validierung · `KW-FE-CON` Konflikte · `KW-FE-ASK` Ask/Query · `KW-FE-RISK` Risiko/Gaps/Graph ·
`KW-FE-LIB` Bibliothek/Export · `KW-FE-IMP` Import/Review · `KW-FE-OUT` Output/Builder · `KW-FE-ANA` Analytics/Audit ·
`KW-FE-LCY` Lebenszyklus · `KW-FE-ADM` Admin/Users · `KW-FE-MOB` Mobile/PWA · `KW-FE-MGMT` Management-Sichten (Stufe 2).

---

## B. Frontend-Funktions-Checkliste (vollständig)

### 1 · Foundation (`KW-FE-FND`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-FND-01 | App-Shells: Login-Shell, Desktop-Control-Room, Mobile-Shell | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-FND-02 | Rollenabhängige Navigation / Sidebar | FE | ✅ rbac | A | 1 | [ ] | [ ] |
| FE-FND-03 | Command Palette (⌘K) Schnellnavigation/-aktionen | FE | — | V | 1 | [ ] | [ ] |
| FE-FND-04 | Toaster / Benachrichtigungs-Bus | FE | — | A | 1 | [ ] | [ ] |
| FE-FND-05 | In-App-Hilfe (zweisprachig, durchsuchbar) | FE | — | V | 2 | [ ] | [ ] |
| FE-FND-06 | i18n DE/EN inkl. Umschalter (gesamte UI, Formulare, Status) | FE+BE | ✅ i18n | A | 1 | [ ] | [ ] |
| FE-FND-07 | Design-System / UI-Bausteine (`ui.jsx`-Äquivalent) | FE | — | A | 1 | [ ] | [ ] |
| FE-FND-08 | Auth-/Session-Context, optimistische Updates + periodisches Nachladen | FE | ✅ auth | A | 1 | [ ] | [ ] |
| FE-FND-09 | „Missions"-Einstiegsseiten → führen in Vollfunktion (optional) | FE | — | V | 2 | [ ] | [ ] |

### 2 · Auth & Onboarding (`KW-FE-AUTH`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-AUTH-01 | Ersteinrichtung leere Instanz → erstes Konto = Admin (Setup-Maske) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-AUTH-02 | Registrierung (Name, E-Mail, Passwort ≥ 8) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-AUTH-03 | „Wartet auf Freigabe"-Hinweisbildschirm | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-AUTH-04 | Login / Logout / Session-Status | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-AUTH-05 | Eigenes Profil / „Me" | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-AUTH-06 | Self-Service-Passwort-Reset per E-Mail-Link | FE+BE | ✅ notifications | V | 2 | [ ] | [ ] |
| FE-AUTH-07 | SSO/OIDC-Login (alternativ, Rollen-Mapping) | FE+BE | ✅ auth-oidc | V | 2 | [ ] | [ ] |

### 3 · Capture / Expert Studio (`KW-FE-CAP`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-CAP-01 | Erfassungsmodus **Freitext** | FE+BE | ✅ capture | A | 1 | [ ] | [ ] |
| FE-CAP-02 | Erfassungsmodus **Strukturiertes Formular** | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-CAP-03 | Erfassungsmodus **Diktat/Spracheingabe** (Web Speech, plattformabh.) | FE | — | A | 1 | [ ] | [ ] |
| FE-CAP-04 | Erfassungsmodus **Geführtes Wissens-Interview** (Reasoner-Rückfragen) | FE+BE | ✅ reasoner | A | 1 | [ ] | [ ] |
| FE-CAP-05 | Anhänge/Fotos aufnehmen/hochladen (+ Thumbnail-Verkleinerung) | FE+BE | ❓ Objektspeicher | A | 1 | [ ] | [ ] |
| FE-CAP-06 | OCR + Dokument-Parsing (Text/MD/PDF/DOCX, clientseitig) | FE | — | V | 1 | [ ] | [ ] |
| FE-CAP-07 | Entwürfe speichern/fortsetzen (Desktop ↔ Mobile) | FE+BE | ✅ capture | A | 1 | [ ] | [ ] |
| FE-CAP-08 | Metadaten bei Erstellung (Domäne, Asset/Anlage, Re-Validierung) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-CAP-09 | Strukturiertes Ergebnis im Editor prüfen/korrigieren vor Speichern | FE | ✅ | A | 1 | [ ] | [ ] |

### 4 · Reasoner-Assistenz (`KW-FE-CAP`/eingebettet)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-RSN-01 | Strukturierung Rohtext → Wissensobjekt (`structure`) | FE+BE | ✅ reasoner | A | 1 | [ ] | [ ] |
| FE-RSN-02 | Interview-Turns zur Vervollständigung | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-RSN-03 | Textverbesserung/Präzisierung (`assistText`) | FE+BE | ✅ | V | 2 | [ ] | [ ] |
| FE-RSN-04 | Klare UI-Kennzeichnung: Entwurf vs. Empfehlung vs. validiert (kein „KI=Wahrheit") | FE | — | A | 1 | [ ] | [ ] |
| FE-RSN-05 | KI-Schlüssel **nur serverseitig**, nie im Client-Bundle | BE | ✅ | A | 1 | [ ] | [ ] |

### 5 · Wissensobjekt-Detail / Wiki (`KW-FE-KO`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-KO-01 | Detailseite: vollständige Anzeige (Aussage, Bedingungen, Maßnahmen, Tags, Quellen, Asset) | FE+BE | ✅ knowledge-object | A | 1 | [ ] | [ ] |
| FE-KO-02 | Wiki-/Confluence-artige Seitenstruktur | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-KO-03 | Inline-/geführte Bearbeitung | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-KO-04 | Versionierung & Historie | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-KO-05 | Fünf Wissensarten sichtbar (intuition/practice/evolution/tech/negative) | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-KO-06 | Objekt-Aktionen: validieren, kommentieren, Beitrag, Quelle anhängen, Konflikt eskalieren, „hat geholfen", „noch gültig" | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-KO-07 | Externe Quelle anhängen (markiert „nicht peer-validiert") | FE+BE | ❓ ext-proxy | V | 2 | [ ] | [ ] |

### 6 · Validierung / Review (`KW-FE-VAL`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-VAL-01 | Validation Board: Arbeitsliste offener Objekte | FE+BE | ✅ validation | A | 1 | [ ] | [ ] |
| FE-VAL-02 | Filter (Status, Domäne, Kategorie, Tags, Zuweisung) | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-VAL-03 | Bewertung (Grün/Gelb/Rot) → Trust-Update | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-VAL-04 | Statuswechsel pending→review→validated/rejected | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-VAL-05 | Zuweisung zur Validierung (Controller) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-VAL-06 | Revisions-Schleife: Rückgabe an Autor + Kommentare | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-VAL-07 | Sichtbare Rückkehr „validiert → erneut in Prüfung" (Revision/Konflikt/Re-Val) | FE | ✅ | A | 1 | [ ] | [ ] |

### 7 · Konflikte (`KW-FE-CON`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-CON-01 | Konflikt-Board: offene Fälle | FE+BE | ✅ conflicts | A | 1 | [ ] | [ ] |
| FE-CON-02 | Gegenüberstellung widersprüchlicher Positionen + Quellen | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-CON-03 | Konflikt-Klassifikation (Kontext/Zeit/Rolle/Erfahrung/Wahrheit) | FE+BE | ✅ | V | 1 | [ ] | [ ] |
| FE-CON-04 | Eskalation (nur Wahrheitskonflikt zwingend) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-CON-05 | Zweitmeinung einholen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-CON-06 | Auflösung + sichtbare Wirkung auf Status/Trust | FE+BE | ✅ | A | 1 | [ ] | [ ] |

### 8 · Ask / Query Console (`KW-FE-ASK`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-ASK-01 | Betriebliche Frage stellen | FE+BE | ✅ ask | A | 1 | [ ] | [ ] |
| FE-ASK-02 | Relevante Wissensobjekte heranziehen (Retrieval) | FE+BE | ✅ | V | 1 | [ ] | [ ] |
| FE-ASK-03 | Antwort mit Quellen, Evidenz-Level, Konfidenz | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ASK-04 | Konflikt/Unsicherheit/fehlende Grundlage explizit anzeigen (Anti-Halluzination) | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-ASK-05 | Feedback zur Antwort erfassen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ASK-06 | Bei fehlendem Wissen automatisch **Wissenslücke** anlegen | FE+BE | ❓ gaps-API | A | 1 | [ ] | [ ] |

### 9 · Gaps / Risiko / Graph (`KW-FE-RISK`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-RISK-01 | Gaps-Dashboard (offene Lücken) | FE+BE | ❓ gaps-API | A | 1 | [ ] | [ ] |
| FE-RISK-02 | Gap zuweisen / priorisieren / schließen / löschen | FE+BE | ❓ gaps-API | A | 1 | [ ] | [ ] |
| FE-RISK-03 | Bus-Faktor / Single-Expert-Risiko sichtbar | FE+BE | ✅ library-analytics | A/V | 1 | [ ] | [ ] |
| FE-RISK-04 | Risiko-Cockpit nach Bereichen/Domänen | FE+BE | ✅ | A/V | 1 | [ ] | [ ] |
| FE-RISK-05 | Knowledge Graph (SVG aus Live-Daten) | FE+BE | ❓ Graph-Daten | V | 2 | [ ] | [ ] |

### 10 · Bibliothek / Export (`KW-FE-LIB`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-LIB-01 | Volltextsuche + strukturierte Filter (Art/Status/Domäne/Tags) | FE+BE | ✅ library-analytics | A | 1 | [ ] | [ ] |
| FE-LIB-02 | Listen-/Detailzugriff | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-LIB-03 | Export JSON / Text-MD / MediaWiki / PDF | FE+BE | ✅ (PDF im BE) | A | 1 | [ ] | [ ] |
| FE-LIB-04 | Re-Import JSON inkl. Merge ohne Dubletten | FE+BE | ❓ Import-Merge | V | 2 | [ ] | [ ] |
| FE-LIB-05 | Re-Validierung aus der Bibliothek starten | FE+BE | ✅ lifecycle | A | 1 | [ ] | [ ] |

### 11 · Import / Source-Review (`KW-FE-IMP`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-IMP-01 | Dateiannahme + Text/OCR-Extraktion | FE | — | V | 1 | [ ] | [ ] |
| FE-IMP-02 | Importkandidaten erzeugen + Queue | FE+BE | ❓ imports-API | V | 1 | [ ] | [ ] |
| FE-IMP-03 | Source-Review: annehmen/ablehnen/Info anfordern | FE+BE | ❓ imports-API | A | 1 | [ ] | [ ] |
| FE-IMP-04 | Akzeptierte Kandidaten → Validierung/Wissensobjektfluss | FE+BE | ❓/✅ | A | 1 | [ ] | [ ] |

### 12 · Output / Builder (`KW-FE-OUT`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-OUT-01 | Instruction Builder: validierte Objekte → Arbeitsanweisung (MD-Export) | FE+BE | ❓ Output-Logik | V | 2 | [ ] | [ ] |
| FE-OUT-02 | Output Factory: Checkliste/Troubleshooting/Schulung/Management-Summary | FE+BE | ❓ Output-Logik | V | 2 | [ ] | [ ] |
| FE-OUT-03 | Herkunftskennzeichnung an jedem Output (Quelle/Status/Trust/Version/Gültigkeit/Rolle) | FE | ✅ | V | 2 | [ ] | [ ] |

### 13 · Analytics / Audit (`KW-FE-ANA`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-ANA-01 | Analytics-Dashboard (Status/Trust/Aufgaben/Kategorien) | FE+BE | ✅ library-analytics | A/V | 1 | [ ] | [ ] |
| FE-ANA-02 | Wirkungsmetriken (validierte Objekte/Woche, Antwortquote ohne Lücke, Zeitverlauf) | FE+BE | ✅ | A/V | 1 | [ ] | [ ] |
| FE-ANA-03 | Knowledge Health (Reife/Pflege, datenbasiert) | FE+BE | ❓ Health-Metriken | D | 2 | [ ] | [ ] |
| FE-ANA-04 | Audit-Log (sicherheits-/wissensrelevante Aktionen) | FE+BE | ✅ audit | A/V | 1 | [ ] | [ ] |
| FE-ANA-05 | Lineage/Herkunftssicht | FE+BE | ✅ | V | 2 | [ ] | [ ] |

### 14 · Wissenslebenszyklus (`KW-FE-LCY`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-LCY-01 | Re-Validierung / Gültigkeitsprüfung | FE+BE | ✅ lifecycle | A | 1 | [ ] | [ ] |
| FE-LCY-02 | „Noch gültig" bestätigen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-LCY-03 | Signal „hat geholfen" | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-LCY-04 | Autorenübergabe (Herkunft bleibt erhalten) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-LCY-05 | Versionen/Revisionen/Pflegebedarf sichtbar | FE | ✅ | A | 1 | [ ] | [ ] |
| FE-LCY-06 | Lernpfade je Rolle (datenbasiert) | FE+BE | ✅ lifecycle | D | 2 | [ ] | [ ] |

### 15 · Admin / Nutzerverwaltung (`KW-FE-ADM`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-ADM-01 | Nutzerliste | FE+BE | ✅ auth/rbac | A | 1 | [ ] | [ ] |
| FE-ADM-02 | Nutzer anlegen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ADM-03 | Freigabe erteilen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ADM-04 | Rolle ändern | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ADM-05 | Passwort-Reset (Admin) | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ADM-06 | Nutzer löschen | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-ADM-07 | Audit-Einsicht | FE+BE | ✅ audit | A | 1 | [ ] | [ ] |

### 16 · Mobile / PWA (`KW-FE-MOB`)
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-MOB-01 | Installierbare PWA (Vollbild, Icon, Offline-Start) | FE | — | A/V | 1 | [ ] | [ ] |
| FE-MOB-02 | Mobile Erfassung (Entwurf als Primäraktion) | FE+BE | ✅ capture | A | 1 | [ ] | [ ] |
| FE-MOB-03 | Mobile Fragen/Abfrage | FE+BE | ✅ ask | A | 1 | [ ] | [ ] |
| FE-MOB-04 | Mobile Entwürfe | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-MOB-05 | Mobile Wissenszugriff | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-MOB-06 | In-App-Bestätigung bei mobilen Aktionen | FE | — | A | 1 | [ ] | [ ] |
| FE-MOB-07 | Offline-Queue/Sync (Ausbau) | FE+BE | ❓ | D | 2 | [ ] | [ ] |

### 17 · Management-/Kapital-Sichten (`KW-FE-MGMT`) — **Stufe 2, nur datenbasiert**
| ID | Funktion | Label | BE-API | Reife | Stufe | G | T |
|---|---|---|---|---|---|---|---|
| FE-MGMT-01 | Overview / operativer Snapshot | FE+BE | ✅ | A | 1 | [ ] | [ ] |
| FE-MGMT-02 | Pilot-Bericht (30/60/90, echte Kennzahlen, Druck/PDF) | FE+BE | ✅ (Formel prüfen) | A/V | 1 | [ ] | [ ] |
| FE-MGMT-03 | Knowledge Capital Score | FE+BE | ❓ Kennzahl-Logik | D | 2 | [ ] | [ ] |
| FE-MGMT-04 | Knowledge Valuation (€-Modell, transparente Schätzung) | FE+BE | ❓ | D | 2 | [ ] | [ ] |
| FE-MGMT-05 | Knowledge Statement (Aktiva/Risiken/Netto) | FE+BE | ❓ | D | 2 | [ ] | [ ] |
| FE-MGMT-06 | Maturity Journey | FE+BE | ❓ | D | 2 | [ ] | [ ] |
| FE-MGMT-07 | Hero Assist (Handlungsempfehlungen) | FE+BE | ❓ | D | 2 | [ ] | [ ] |
| FE-MGMT-08 | Knowledge House (Unternehmensgedächtnis visuell) | FE+BE | ❓ | D | 2 | [ ] | [ ] |
| FE-MGMT-09 | Wissens-Priorisierung (9-Faktoren-Score) | FE+BE | ❓ | D | 2 | [ ] | [ ] |

---

## C. In Jira **fehlende** Funktionen (ergänzen)

Das bestehende Jira-Board (14 Modul-Epics + FR-Stories) deckt die **Pflichtenheft-FRs** ab — überwiegend **Backend**.
Folgende **Frontend-/Funktionsthemen** sind dort noch **nicht** als Tickets erfasst und sollten ergänzt werden:

- **Alle 16 Frontend-Epics** (`KW-FE-*`) inkl. der obigen Einzel-Funktionen als Stories (Label `FRONTEND`).
- **Source-Review-Queue / Import-Pipeline** als eigene Stories (Alt-`imports`-Flow) — Backend-Lücke `imports-API` (Label `FRONTEND` + `BACKEND` + `BE-LUECKE`).
- **Gaps/Wissenslücken** als eigene API + Frontend (Alt-`gaps`) — `BE-LUECKE`.
- **Output Factory / Instruction Builder** — Output-Logik im Backend offen (`BE-LUECKE`).
- **External Knowledge (Wikipedia-Suche/Anhang)** — optionaler Backend-Proxy.
- **Knowledge Graph** (Daten/Visualisierung).
- **Wissenskapital-Kennzahlen** (Capital/Valuation/Statement/Maturity/Health/Prioritizer) — Stufe 2, nur datenbasiert; bis dahin **nicht als „fertig" zählen** (Reife D).
- **Anhang-/Objektspeicher** (Fotos/Dateien) statt großer JSON/Base64 — `BACKEND`, Stufe-2-relevant.
- **PWA/Offline-Queue** als eigener Ausbau-Story (Stufe 2).

> **Reife-D-Warnung (aus den Aufzeichnungen):** Capital/Valuation/Statement/Maturity/HeroAssist/House/Health/Prioritizer
> liefen im Alt-Stand auf **Beispieldaten**. Sie dürfen erst als erledigt gelten, wenn sie auf **echten Live-Daten + bestätigten Regeln** beruhen.

---

## D. Backend-Lücken, die vor dem jeweiligen Frontend zu schließen sind
*(Tickets Label `BACKEND` + `BE-LUECKE`)*
1. **gaps-API** (Wissenslücken CRUD/Assign/Close) — blockt FE-ASK-06, FE-RISK-01/02.
2. **imports-API / Source-Review** — blockt FE-IMP-02/03/04.
3. **Output-Logik** (Builder/Factory) — blockt FE-OUT-01/02.
4. **External-Knowledge-Proxy** (optional) — FE-KO-07.
5. **Knowledge-Graph-Daten** — FE-RISK-05.
6. **Management-Kennzahlen** (Capital/Valuation/…) — FE-MGMT-03..09 (Stufe 2).
7. **Objekt-/Dateispeicher** für Anhänge — FE-CAP-05 (Stufe 2).

---

## E. Nächste Schritte (sobald Jira-Connector verbunden)
1. **Status-Check:** alle nicht erledigten Tickets → `To Do`.
2. **Labeln:** bestehende Tickets `FRONTEND`/`BACKEND` (Backend-FRs → `BACKEND`; UI-relevante → zusätzlich `FRONTEND`).
3. **Frontend-Epics + Stories anlegen** (diese Datei = Vorlage), Label `FRONTEND`, je Story 2 Sub-Tasks (Implementieren/Testen) **oder** Master-Checklisten-Ticket je Domäne.
4. **Fehlende Funktionen** (Abschnitt C) + **Backend-Lücken** (Abschnitt D) als Tickets ergänzen.
5. **Live-Status:** Board-Filter `label = FRONTEND` → jederzeit aktueller Stand.
