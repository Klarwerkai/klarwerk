# BERATER — Offene Fragen an Pedi · 03.07.2026

> Begleitdokument zu `BERATER_AUDIT_2026-07-03.md`. Diese Fragen kann nur **du** als
> Stakeholder beantworten — sie sind keine technischen Lücken, sondern Weichenstellungen,
> von denen abhängt, wie dringend einzelne Empfehlungen sind. Ich habe zu jeder Frage die
> Optionen und ihre Konsequenz notiert, damit du schnell entscheiden kannst. Reihenfolge =
> grob nach zeitlicher Dringlichkeit. Nichts hier ist ein verstecktes „du musst" — es sind
> echte Wahlmöglichkeiten.

---

## 1 · RC-Freeze — jetzt einfrieren oder erst die 50 Tickets sichten?

**Kontext:** Der Beta-Fahrplan wartet seit dem 02.07. auf dein Kommando „RC einfrieren" (Boss-Stand §3). Seither sind ~24 weitere Versionsstände entstanden (v0.9.22 → v0.9.45), und **50 SCRUM-Tickets** stehen gesammelt auf „In Review" — alle warten auf deine Sichtabnahme. Der Stand von gestern 21:36 Uhr ist gate-grün (1.382 Tests).

**Optionen:**
- **(a) Jetzt einfrieren** auf v0.9.45 als RC (Tag `1.0.0-beta.1`), dann nur noch Fixes. Vorteil: stabiler Demo-Stand für den 05.07., klare Zäsur. Nachteil: die 50 Reviews holst du nachgelagert nach.
- **(b) Erst sichten, dann einfrieren.** Vorteil: du weißt genau, was drin ist. Nachteil: 50 Tickets in 2 Tagen zu sichten ist viel; jede weitere Lieferung verschiebt den Freeze.

**Meine Einschätzung:** (a) — mit einer verkürzten Sichtabnahme der 5–6 sichtbarsten Punkte (Bereitschafts-/Sicherheits-Bereich, Papierkorb, Validierungs-Board). Ein Freeze vor dem VIP-Termin ist mehr wert als vollständige Review-Abdeckung.

**Deine Antwort:** _______________

---

## 2 · Erster echter Pilotkunde — wann, und ist die Kanzlei-Antwort da?

**Kontext:** Die Dringlichkeit des gesamten DSGVO-Pakets (AVV mit Anthropic, DSFA, Retention-Fristen, Self-Service-Betroffenenrechte) hängt daran, **wann echte Personendaten** ins System kommen. Die versandfertige Kanzlei-Mail (D-010) liegt seit Tagen unversendet (`klarwerk-business-backend/docs/D010_LEGAL_BRIEFING_FUER_KANZLEI_V1.md`, Boss-Stand §6). Solange nur Demo-/synthetische Daten laufen, ist die Lage entspannt; ab dem ersten realen Kunden ist NFR-PRV-04 (MUSS) blockierend.

**Frage:** Gibt es einen angepeilten Termin für den ersten Piloten? Und: Kannst du die D-010-Mail heute senden (5 Minuten), damit die Rechtsberatung parallel anläuft?

**Deine Antwort:** _______________

---

## 3 · Wo läuft die Beta — lokal oder app.klarwerk.ai?

**Kontext:** Das entscheidet die Reihenfolge mehrerer Empfehlungen. **Lokal** (Desktop-App, In-Memory/Journal, nur du) heißt: Postgres-Nachweis (K3), Sicherheits-Härtung (H3/M8) und trustProxy sind **nicht dringend**. **Öffentlich** (Coolify → app.klarwerk.ai, auch hinter Basic-Auth) heißt: diese Punkte werden **Voraussetzung vor dem Deploy**, weil dann echte Netzwerk-Angriffsfläche entsteht.

**Optionen:**
- **(a) Beta bleibt vorerst lokal** — VIP-Test und erste Tester über deinen Mac / eine kontrollierte Instanz.
- **(b) app.klarwerk.ai kommt bald** — dann K3/H3/M8 in die 2 Wochen nach dem Termin einplanen, vor dem ersten externen Login.

**Deine Antwort:** _______________

---

## 4 · On-Premises-LLM — strategisch gesetzt oder Option?

**Kontext:** Der Eval-Erfolg (Qwen3-32B = Claude-Niveau, ~0,52 €/1.000 Aufgaben GPU-Zeit) macht den eigenen Server fachlich attraktiv, aber der Dauerbetrieb (KLLM-60) bedeutet Härtung, Monitoring und laufende Kosten. Die Grundsatzentscheidung D-012 sagt: die Beta hängt **nicht** am eigenen Server — Anthropic trägt sie.

**Optionen:**
- **(a) Eigener Server wird strategisch** (On-Prem als Verkaufsargument für datensensible Kunden) → KLLM-60 Dauerbetrieb + KLLM-61 App-Anbindung einplanen, Zeitfenster Gratis-Credits bis ~01.08. nutzen.
- **(b) Anthropic bleibt Betriebsweg**, eigener LLM nur als Blaupause für Kunden, die es verlangen → Sitzung 2 zu Ende führen, dann parken.

**Meine Einschätzung:** Sitzung 2 (14B/Mistral) im Credit-Fenster auf jeden Fall abschließen (fast kostenlos, schließt KLLM-57/59 sauber ab) — die Dauerbetriebs-Entscheidung kannst du danach in Ruhe treffen.

**Deine Antwort:** _______________

---

## 5 · Zielmarkt — „jede Organisation" oder „industriell"?

**Kontext:** Am 02.07. hast du die Positionierung auf „Knowledge Continuity — für jede Organisation" verbreitert (Website, Demo-Beispiele). Das verbindliche Pflichtenheft und das Harness-Glossar sagen aber weiter „industrielle Organisationen". Nach eurem eigenen Prinzip („Code ist regenerierbares Ergebnis aus Spec + Harness") ist das ein Widerspruch in der Quelle der Wahrheit, kein Schönheitsfehler.

**Frage:** Welche Positionierung ist verbindlich? Sobald du das entscheidest, ziehen wir die Specs, das Glossar und den Demo-Pfad in einem kleinen Slice nach (M6), damit alle Ebenen wieder dasselbe sagen. Nebenfrage: Kategorielabel „Reasoning System" (Website-Titel) oder „Knowledge OS" (Onboarding-Doku) — eines von beiden, konsistent?

**Deine Antwort:** _______________

---

## 6 · Zweiter Mensch mit Zugängen (Bus-Faktor)?

**Kontext:** Aktuell bist du der einzige Mensch für Push, alle Keys/Konten, Abnahmen und Außenkommunikation. Das Projekt hat dieses Risiko selbst erfasst (PMO-RISK-0001), aber es gibt kein Notfall-Runbook und keine zweite Person, die im Ernstfall übernehmen könnte.

**Frage:** Gibt es eine Vertrauensperson (der neue Mitarbeiter?), die als **zweiter Jira-/GitHub-Admin** eingetragen werden und im Notfall Zugänge übernehmen könnte? Falls ja, richte ich (bzw. Paul) eine einseitige Notfallkarte in `PROJECT_CONTEXT/` ein: Mac-Ausfall, Session-Ausfall, Zugangs-Hinterlegung.

**Deine Antwort:** _______________

---

## 7 · Investor-Kennzahlen als Projektionen kennzeichnen?

**Kontext:** Das aus ARGUS übernommene Investor-Material nennt harte Zahlen (98,5 % Genauigkeit, 1.247 Konflikte/Monat, 99,9 % Uptime), die real nicht gemessen sind — das Projekt-Handbuch führt das selbst als offenen Punkt (§4.7/§11). Das kollidiert mit eurem Markenkern „Vertrauen ist Evidenz, nie behauptet".

**Frage:** Sollen wir diese Zahlen vor jeder externen Verwendung (VIP-Termin, Deck) als **gekennzeichnete Projektionen/Beispiele** umformulieren? Für den 05.07. würde ich es empfehlen — ein Investor, der nach der Quelle fragt, ist sonst ein unangenehmer Moment.

**Deine Antwort:** _______________

---

## 8 · Privatdaten im freigegebenen Ordner

**Kontext:** Im für die Sessions freigegebenen Ordner `Documents` liegen sehr persönliche Dokumente (Gehaltsabrechnungen, Geburtsurkunden, Patientenverfügung, Versicherungs-PDFs) direkt neben den Projektordnern. Jede Claude-Session mit dieser Freigabe kann sie prinzipiell lesen. Kein akutes Projekt-Risiko, aber unnötige Exposition.

**Optionen:**
- **(a) So lassen** (dein Rechner, deine Entscheidung).
- **(b) Projektarbeit bündeln:** alle KLARWERK-Ordner unter ein gemeinsames `~/Documents/KLARWERK-Projekt/` ziehen und künftig nur diesen Unterordner freigeben.

**Deine Antwort:** _______________

---

## 9 · (klein) Alt-Secrets rotieren?

**Kontext:** Laut ARGUS-Projekt-Handbuch §8 standen Cloudflare-Token und ein Anthropic-Key früher im Chatverlauf; `ARGUS/PROJEKT-DOKUMENTATION.md` nennt Demo-Basic-Auth im Klartext; `open-engine/.env.local` liegt im Klartext. Falls eines davon noch aktiv ist, sollte es rotiert werden.

**Frage:** Sind die alten Cloudflare-/Anthropic-Zugänge noch in Benutzung? Wenn nicht mehr gebraucht: widerrufen. Wenn ja: neu erzeugen und die Klartext-Stellen schwärzen.

**Deine Antwort:** _______________

---

*Sobald du diese Punkte beantwortet hast, kann die Umsetzungsseite (Boss-Session / Paul) die
Empfehlungen aus dem Hauptbericht in der richtigen Reihenfolge und mit der richtigen Dringlichkeit
angehen. Für den VIP-Termin sind nur die Fragen 1–3 und 7 zeitkritisch — der Rest kann in Ruhe
in den Tagen danach entschieden werden.*
