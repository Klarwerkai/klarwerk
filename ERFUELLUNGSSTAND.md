<!-- Uebernommen vom Chef (kw-CHEF) am 21.08.2026 aus der Messung PRO3 / JOB 1482 D1.
     Die messende Bahn hatte keinen Schreibzugriff auf dieses Repository; der Inhalt ist
     unveraendert aus ihrer Rueckgabe uebernommen, ergaenzt um Herkunft und Methodengrenzen. -->

# KLARWERK — Erfüllungsstand gegen Pflichtenheft v1.0

Gemessen 20.08.2026 · Quelle: specs/reference/Pflichtenheft.md · Messung: PRO3 / JOB 1482 D1

ERFUELLT 65 (62 %) · TEILWEISE 34 · FEHLT 0 · UNKLAR 6 · Anforderungen gesamt 105
davon funktional  62 von 78 erfuellt (79 %) · nichtfunktional 3 von 27 erfuellt (11 %)

| Kennung | Anforderung (kurz) | Zustand | Beleg |
|---|---|---|---|
| FR-AUTH-01 | Erstes Konto wird Admin | ERFUELLT | services/auth/src/service.test.ts:24 |
| FR-AUTH-02 | Selbstregistrierung, gesperrt bis Freigabe | ERFUELLT | services/auth/src/service.test.ts:30 |
| FR-AUTH-03 | Login, ablaufende Sitzung | ERFUELLT | services/auth/src/service.test.ts:51 |
| FR-AUTH-04 | Logout serverseitig | ERFUELLT | services/auth/src/service.test.ts:70 |
| FR-AUTH-05 | Passwoerter nur gehasht | ERFUELLT | services/auth/src/service.test.ts:78 |
| FR-AUTH-06 | Admin-Passwort-Reset invalidiert Sitzungen | ERFUELLT | services/auth/src/service.test.ts:89 |
| FR-AUTH-07 | SSO/OIDC (SOLL) | ERFUELLT | services/auth/src/oidc.test.ts:47 |
| FR-AUTH-08 | Self-Service-Reset (KANN) | ERFUELLT | services/auth/src/service.test.ts:145 |
| FR-RBAC-01 | Vier Rollen mit Rechtematrix | ERFUELLT | services/rbac/src/policy.test.ts:7 |
| FR-RBAC-02 | Admin verwaltet Nutzer | ERFUELLT | services/rbac/src/policy.test.ts:17 |
| FR-RBAC-03 | Admin entzieht sich nicht selbst Admin | ERFUELLT | services/rbac/src/policy.test.ts:23 |
| FR-RBAC-04 | Serverseitige Rechtepruefung, 403 | ERFUELLT | services/rbac/src/policy.test.ts:32 |
| FR-CAP-01 | Vier Erfassungsmodi | TEILWEISE | apps/web/src/pages/Capture.tsx (Interview/Diktat), kein Fall prueft alle vier |
| FR-CAP-02 | KI-Interview als Redakteur | ERFUELLT | services/capture/src/service.test.ts:251 |
| FR-CAP-03 | Live-Diktat, iOS-robust | TEILWEISE | apps/web/src/lib/speechSupport.ts + tests/capture/speech-support.test.ts:5 — prueft API-Erkennung, nicht „Text live sichtbar" |
| FR-CAP-04 | Foto aus Kamera UND Mediathek | TEILWEISE | apps/web/src/pages/Capture.tsx:4954 accept="image/*" — Mediathek ja; kein `capture=`-Attribut fuer die Kameraquelle |
| FR-CAP-05 | Dokumentanhang mit OCR (SOLL) | ERFUELLT | services/knowledge-object/src/service.test.ts:238 |
| FR-CAP-06 | Entwuerfe im gemeinsamen Pool | ERFUELLT | tests/capture/docx-extract.test.ts:22 |
| FR-CAP-07 | Originalautor bleibt erhalten | ERFUELLT | services/app/src/build-app.test.ts:80 |
| FR-CAP-08 | Metadaten inkl. noetige Validierungen | ERFUELLT | services/capture/src/service.test.ts:127 |
| FR-CAP-09 | Offline-Warteschlange (KANN) | TEILWEISE | apps/web/src/app/useOfflineQueue.ts — kein Sync-Fall gefunden |
| FR-STR-01 | Reasoner strukturiert zu KO | TEILWEISE | services/structure/, services/reasoner/src/extract.test.ts — kein Fall prueft „enthaelt alle Felder" |
| FR-STR-02 | WYSIWYG-Editor | ERFUELLT | tests/app/body-file-link.test.ts:11 |
| FR-STR-03 | Bilder frei platzierbar (SOLL) | ERFUELLT | tests/app/editor-drop-paste.test.ts:9 |
| FR-STR-04 | KI-Schreibhilfe (SOLL) | TEILWEISE | apps/web/src/lib/knowledgeStudioCoach.ts + tests/app/knowledge-studio-coach.test.ts:18 — prueft Hinweise, nicht Uebernahme |
| FR-STR-05 | Vorschau/Bearbeiten ohne Verlust | TEILWEISE | apps/web/src/components/ko/KoRead.tsx:55 — Code, kein Test unter der Kennung |
| FR-STR-06 | Einreichen erzeugt KO, Entwurf weg | ERFUELLT | tests/structure/draft-promote-submission-e2e.test.ts:6 |
| FR-KO-01 | KO-Datenmodell vollstaendig | ERFUELLT | services/knowledge-object/src/service.test.ts:39 |
| FR-KO-02 | Fuenf Wissensarten | ERFUELLT | services/knowledge-object/src/service.test.ts:268 |
| FR-KO-03 | Kategorie + Tags aenderbar | ERFUELLT | services/knowledge-object/src/service.test.ts:282 |
| FR-KO-04 | Versionierung, Ratings zurueck | ERFUELLT | services/knowledge-object/src/service.test.ts:295 |
| FR-VAL-01 | Peer-Bewertung → Status/Trust | ERFUELLT | tests/app/conflict-impact.test.ts:13 |
| FR-VAL-02 | Konfigurierbares Validierungslimit | ERFUELLT | services/validation/src/service.test.ts:21 |
| FR-VAL-03 | Board zeigt nur offene KOs | ERFUELLT | services/validation/src/service.test.ts:87 |
| FR-VAL-04 | Board-Filter kombinierbar | ERFUELLT | services/validation/src/service.test.ts:135 |
| FR-VAL-05 | Zuweisung + Badge + Erledigung | ERFUELLT | services/validation/src/service.test.ts:143 |
| FR-VAL-06 | Zuweisungsstatus in Analytics/Admin | ERFUELLT | services/validation/src/service.test.ts:154 |
| FR-VAL-07 | E-Mail/Push-Zustellung (SOLL) | ERFUELLT | services/app/src/build-app.test.ts:332 |
| FR-CON-01 | Klassifizierte Konflikte | ERFUELLT | services/conflicts/src/service.test.ts:24 |
| FR-CON-02 | Nur Wahrheitskonflikte eskalieren | ERFUELLT | services/conflicts/src/service.test.ts:49 |
| FR-CON-03 | Aufloesungskette bis geloest | ERFUELLT | services/conflicts/src/service.test.ts:58 |
| FR-CON-04 | Konfliktseite + Badge | ERFUELLT | services/conflicts/src/service.test.ts:78 |
| FR-ASK-01 | Begruendete Antwort mit Trust/Quellen | ERFUELLT | services/ask/src/service.test.ts:48 |
| FR-ASK-02 | Semantische Auswahl, Keyword-Fallback | ERFUELLT | tests/ask/reasoner-eval.ts:1 |
| FR-ASK-03 | Ehrliche Verweigerung → Wissensluecke | ERFUELLT | services/ask/src/service.test.ts:56 |
| FR-ASK-04 | „Hat geholfen" wirkt auf Trust + Audit | ERFUELLT | services/ask/src/service.test.ts:84 |
| FR-ASK-05 | Wissensluecken zuweisbar/schliessbar | ERFUELLT | services/ask/src/service.test.ts:164 |
| FR-ASK-06 | Belegstelle/Snippet (KANN) | ERFUELLT | services/reasoner/src/service.test.ts:90 |
| FR-LIB-01 | Bibliothek mit Suche und Filtern | ERFUELLT | tests/library/search-captions.test.ts:2 |
| FR-LIB-02 | Export JSON/MediaWiki/PDF, Import | ERFUELLT | services/library-analytics/src/service.test.ts:88 |
| FR-LIB-03 | Risiko/Luecken inkl. Bus-Faktor (SOLL) | ERFUELLT | services/library-analytics/src/service.test.ts:461 |
| FR-LIB-04 | Wissensgraph (SOLL) | ERFUELLT | services/library-analytics/src/service.test.ts:517 |
| FR-ANA-01 | Analytics-Kennzahlen | ERFUELLT | services/library-analytics/src/service.test.ts:524 |
| FR-ANA-02 | Wirkungs-Dashboard (SOLL) | ERFUELLT | services/app/src/build-app.test.ts:295 |
| FR-AUD-01 | Lueckenloses Audit-Log | ERFUELLT | services/auth/src/service.test.ts:307 |
| FR-AUD-02 | Audit append-only, hash-verkettet | ERFUELLT | services/audit/src/service.test.ts:25 |
| FR-LIF-01 | Anlagenkopplung, Re-Validierung (SOLL) | ERFUELLT | services/lifecycle/src/service.test.ts:26 |
| FR-LIF-02 | Autor-Uebergabe, Originalautor bleibt | ERFUELLT | services/lifecycle/src/service.test.ts:65 |
| FR-LIF-03 | Lernpfade (SOLL) | ERFUELLT | services/lifecycle/src/service.test.ts:71 |
| FR-LIF-04 | Autorenname ueberall sichtbar | ERFUELLT | tests/ko/ko-author.test.ts:6 |
| FR-RSN-01 | Alle Reasoner-Aufgaben | ERFUELLT | services/reasoner/src/service.test.ts:41 |
| FR-RSN-02 | Modellagnostisch per Konfiguration | ERFUELLT | services/reasoner/src/service.test.ts:186 |
| FR-RSN-03 | Anti-Halluzination | ERFUELLT | tests/ask/reasoner-eval.ts:1 |
| FR-RSN-04 | Deterministischer Fallback | ERFUELLT | services/reasoner/src/service.test.ts:131 |
| FR-RSN-05 | Server-echte Statusanzeige | ERFUELLT | tests/security/routeGuardAudit.ts:194 |
| FR-RSN-06 | KI-Schluessel nur serverseitig | TEILWEISE | services/reasoner/src/service.ts:225 — Code, kein Test unter der Kennung |
| FR-MOB-01 | PWA installierbar | TEILWEISE | apps/web/public/manifest.webmanifest, public/sw.js, src/main.tsx — kein PWA-Test in tests/app |
| FR-MOB-02 | Mobile Notiz/Interview, Entwurf primaer | TEILWEISE | apps/web/src/pages/Mobile.tsx:148 — kein Fall zur Primaeraktion |
| FR-MOB-03 | Destruktives mobil per In-App-Bestaetigung | ERFUELLT | tests/capture/mobile-confirm.test.ts:11 |
| FR-I18N-01 | DE/EN vollstaendig inkl. Reasoner | ERFUELLT | services/ask/src/service.test.ts:209 |
| FR-I18N-02 | Erweiterbar (SOLL) | ERFUELLT | services/i18n/src/service.test.ts:27 |
| FR-EXT-01 | Knowledge Import (KANN) | TEILWEISE | services/confluence/src/adapter.test.ts, apps/web/src/pages/Stufe2.tsx — Pipeline ohne Kennungsfall |
| FR-EXT-02 | Importobjekt initial unvalidated (KANN) | ERFUELLT | tests/ko/external-search.test.ts:13 |
| FR-EXT-03 | Output Factory (KANN) | TEILWEISE | services/output/index.ts:1 — Code, kein Test unter der Kennung |
| FR-EXT-04 | Wissens-Priorisierung, 9 Faktoren (KANN) | TEILWEISE | apps/web/src/lib/extConcept.ts, lib/knowledgeHealth.ts |
| FR-EXT-05 | Knowledge House (KANN) | TEILWEISE | apps/web/src/lib/extConcept.ts |
| FR-EXT-06 | Validity & Protection (KANN) | TEILWEISE | apps/web/src/lib/evidenceFreshnessView.ts, lib/evidenceFreshnessIndex.ts |
| FR-EXT-07 | Import-/Output-Felder (SOLL) | TEILWEISE | services/output/src/render.ts:42 — Code, kein Test unter der Kennung |
| NFR-SEC-01 | Passwoerter Salt+Hash | TEILWEISE | services/auth/src/password.ts:4 — Code; die Sache ist ueber FR-AUTH-05 getestet, die Kennung selbst nicht |
| NFR-SEC-02 | TLS, HttpOnly-Sitzung | TEILWEISE | services/app/src/security-headers.ts, src/csrf.ts, src/server.ts — TLS selbst ist Betrieb |
| NFR-SEC-03 | Serverseitige Autorisierung ueberall | TEILWEISE | belegt ueber FR-RBAC-04; AK ist ein Pen-Test, kein Testfall |
| NFR-SEC-04 | OWASP-Top-10-Schutz | ERFUELLT | services/app/src/csrf.test.ts:11 |
| NFR-SEC-05 | Secrets-Management (SOLL) | TEILWEISE | .env.example vorhanden; kein Vault/Secret-Store, keine Rotation gefunden |
| NFR-PRV-01 | Drei Deployment-Modelle transparent | UNKLAR | Dokumentationsanforderung; am Repository nicht entscheidbar |
| NFR-PRV-02 | „Keine Daten verlassen das Haus" nur On-Prem | UNKLAR | Aussage ueber Produkttexte; nicht am Code pruefbar |
| NFR-PRV-03 | No-Training, EU-Residenz vertraglich | UNKLAR | vertragliche Zusicherung; nicht am Code pruefbar |
| NFR-PRV-04 | DSGVO-Konformitaet | TEILWEISE | docs/compliance/gdpr-compliance-runbook.md — Runbook vorhanden, Betroffenenrechte nicht als Fall belegt |
| NFR-TAI-01 | Nachvollziehbarkeit Antwort + Aenderung | TEILWEISE | services/provenance/src/project.ts + FR-AUD-01/02; kein Fall unter dieser Kennung |
| NFR-TAI-02 | Menschliche Aufsicht | TEILWEISE | belegt ueber FR-CON-02 (nur Truth eskaliert); Kennung selbst ungetestet |
| NFR-TAI-03 | EU-AI-Act-Prinzipien dokumentiert (SOLL) | UNKLAR | Dokumentationsnachweis; nicht am Code entscheidbar |
| NFR-PERF-01 | UI < 200 ms, Listen < 1 s bei 10.000 KOs (SOLL) | TEILWEISE | tests/library/facet-scale-measure.test.ts, tests/capture/submit-timing.test.ts — kein Lasttest bei 10.000 |
| NFR-PERF-02 | Reasoner-Antwort < 5 s mit Abbruch (SOLL) | TEILWEISE | tests/capture/wp-d7b-submit-latency.test.ts — Abbruchpfad nicht unter der Kennung belegt |
| NFR-PERF-03 | Skalierung 1.000 Nutzer / 100.000 KOs (SOLL) | ERFUELLT | tests/ask/reasoner-eval.test.ts:56 |
| NFR-OPS-01 | Verfuegbarkeit >= 99,5 % (SOLL) | UNKLAR | SLA-Nachweis; nicht am Repository messbar |
| NFR-OPS-02 | Backups + getestetes Restore | ERFUELLT | scripts/backup/backup.sh, restore-drill.sh, RESTORE.md + tests/security/job1178-restore-drahttest.test.ts |
| NFR-OPS-03 | Observability (SOLL) | TEILWEISE | services/management/src/metrics.test.ts, src/service.ts — Metriken ja; Tracing und KI-Kosten-Logging nicht gefunden |
| NFR-OPS-04 | CI/CD mit Tests (SOLL) | TEILWEISE | .github/workflows/ci.yml — Pipeline ja; Ein-Klick-Deploy je Modell nicht belegt |
| NFR-UX-01 | Bedienbar ohne Schulung, Bestaetigungen | TEILWEISE | tests/capture/discard-nav-dirty-mounted.test.tsx u. a.; AK ist ein Usability-Test |
| NFR-UX-02 | WCAG 2.1 AA (SOLL) | TEILWEISE | vier a11y-/Fokus-Testdateien in tests/app; kein Accessibility-Audit |
| NFR-UX-03 | Responsive + PWA (SOLL) | TEILWEISE | manifest.webmanifest + Mobile.tsx; kein geraeteuebergreifender Test |
| NFR-MNT-01 | Reasoner austauschbar, kein Lock-in | TEILWEISE | belegt ueber FR-RSN-02; Kennung selbst ungetestet |
| NFR-MNT-02 | Modularer, getesteter Code (SOLL) | TEILWEISE | 1026 Testdateien, ./tools/check gruen; Coverage-Ziel und API-Doku nicht belegt |
| NFR-MNT-03 | Mandantenfaehigkeit (SOLL) | UNKLAR | services/app/src/addon-principal.ts vorhanden; Daten-/Konfigurationsisolation nicht entscheidbar |
| NFR-DAT-01 | Transaktionssichere DB, versionierte KO | TEILWEISE | services/db-tx/src/tx.ts, write-fence.test.ts, pg-test-guard.ts; AK „Konsistenz unter Last" ungeprueft |
| NFR-DAT-02 | JSON-Import der Demo-Daten (SOLL) | TEILWEISE | belegt ueber FR-LIB-02; Kennung selbst ungetestet |

---

## Herkunft, Methode und Grenzen dieser Zahl

**Gemessen von PRO3 im Durchgang JOB 1482 D1 am 20.08.2026**, Basis `449d76b`, Quelle
`specs/reference/Pflichtenheft.md` v1.0 vom 14.06.2026
(SHA-256 `2ae2f807c337026f9814301773c039061fbcfef1de2769d8495c96756d063893`).
Volltext der Messung: `_relay/kopf/outbox/RUECKGABE-PRO3-JOB-1482-D1-KLARA-GEGEN-DAS-PFLICHTENHEFT.md`.

**Wie gemessen wurde:** 105 Anforderungen (78 FR + 27 NFR) maschinell aus dem Pflichtenheft
gezogen, dann 1756 Quell- und Testdateien nach jeder einzelnen Kennung durchsucht — getrennt
nach Test- und Quelldatei. Als **ERFUELLT** zaehlt nur, wo die Kennung im **Titel eines echten
Testfalls** steht, etwa `it("FR-VAL-02: n gruene, 0 rote -> validiert", ...)`. Fuer die 36
Kennungen ohne solchen Treffer wurde fachlich Datei fuer Datei gesucht; der Beleg steht in der
Spalte.

**Zwei Grenzen, ausdruecklich benannt:**

1. **Die Belegform wurde an vier der 64 Faelle nachgesehen, nicht an allen.** Dass ein Fall die
   Kennung im Titel fuehrt, heisst: jemand hat ihn fuer dieses Abnahmekriterium geschrieben.
   **Ob er es vollstaendig prueft, ist nicht Fall fuer Fall nachgerechnet.**
2. **Diese Messung traegt kein Substanzurteil einer fremden Instanz** — nur ein Maschinenurteil
   (`BEN-PRUEFUNG-JOB-1482-D1-CODE.md`). Sie ist eine Erhebung, kein Produktcode; eingebaut wird
   sie als Dokument, damit die Zahl nachvollziehbar an einer Stelle steht.

**Unabhaengige Gegenprobe:** Codex kam in derselben Nacht mit einer anderen Methode auf
**denselben Wert von 62 %**. Zwei Verfahren, dieselbe Zahl — das staerkt sie, ersetzt aber
Punkt 1 nicht.

**Was die Zahl NICHT ist:** keine Fortschrittsanzeige, sondern eine **Nachweisquote**. `FEHLT`
steht **null Mal** in der Tabelle: Was das Pflichtenheft verlangt, ist ueberall wenigstens
angefangen. Bei 34 Anforderungen fehlt der Beweis, bei 6 die Entscheidbarkeit.

**Die schaerfste Aussage steht in der Aufteilung:** funktional 62 von 78 (**79 %**),
nichtfunktional 3 von 27 (**11 %**). Alle MUSS-Anforderungen der Kernfunktionen sind erfuellt.
Die NFR-Seite ist fast leer, **weil ihre Abnahmekriterien keine Tests sind** — Pen-Test,
Usability-Test, SLA-Nachweis, Accessibility-Audit, Lasttest. **Das ist keine Bauschuld, sondern
eine Abnahmeschuld, und sie laesst sich nicht durch Programmieren tilgen.**

**Nicht vergleichbar mit den 41 % in `OFFEN.md`:** Die eine Zahl zaehlt Befunde, diese
Anforderungen mit Abnahmenachweis. Vergleichbar ist nur die Richtung.
