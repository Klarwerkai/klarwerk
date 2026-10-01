# KI-Laufprotokoll — Abgleich der Aufnahme `gesamt-ki-laufprotokoll`

Auftrag `aufnahme:20260922:gesamt-ki-laufprotokoll`, Lauf 1, Basis `e6e4bf16`
(1.0.0-beta.1.638). Runde 1 am 01.10.2026, Runde 2 (Nacharbeit nach Bens Befunden B1–B5) am
01.10.2026. Fassungen sind die Ship-Commits, in denen eine Lieferung zuerst stand. Die Fassung
dieses Laufs erzeugt der Starter.

## Gelieferter Stand vor diesem Lauf (wiederverwendet, nicht neu gebaut)

| Teil | Lieferung | Fassung | Beleg |
|---|---|---|---|
| Protokoll v1, nur Metadaten (Aufgabe, Anbieter, Erfolg/Fehler, Ersatzmodus `fallback`, `demo`, Start/Ende) | SCRUM-164/167 | `7feb10ae`, `bbdb74e7` (26.06.) | `services/model-runs/src/types.ts`, `services/model-runs/src/*.test.ts` |
| Laufkontext nur als Kennungen (`actor`, `subject` = KO) | mega26 Block A | `5150cd5a` | `sanitizeModelRunContext` in `types.ts` |
| Echter Modellname statt zweimal Anbieter | JOB 3036 | 1.0.0-beta.1.50 | `tests/ki-lauf-modell/` |
| Modell und Dauer je Lauf in der KI-Übersicht | JOB 3044 | 1.0.0-beta.1.68 | `tests/ki-lauf-dauer/` |
| Acht Aufgabenarten in der Karte, unbekannte Art als Satz (DE/EN/NL) | JOB 3069 | 1.0.0-beta.1.81 | `tests/ki-aufgabenarten/` |
| Tokenverbrauch je Lauf, auch bei Fehlversuchen (V9 Scheibe 3) | JOB 3074 | 1.0.0-beta.1.88 | `tests/ki-lauf-verbrauch/` |
| MR-SELECT-1: Import-Auswahl (`POST /api/admin/import/confluence/select`) schreibt je echter Anfrage genau einen `select`-Lauf | JOB 3127 | 1.0.0-beta.1.140 | `tests/select-lauf-protokoll/` |
| Gescheiterte Ausweichversuche stehen im Datensatz des Laufs (Anbieter, Modell, Grund) | JOB 3276 | 1.0.0-beta.1.202 | `Reasoner.versuchsfehlerZeile`, `tests/ki-assist-leer/` |

## In diesem Lauf geliefert

| Befund / Kriterium | Lieferung | Beleg (dieses Verzeichnis) |
|---|---|---|
| R-1572, R-1621: `ModelCapacityError` | Ein Lauf, der an der Auslastung endet, schreibt genau einen `error`-Datensatz (Glied, bisheriger Verbrauch, zuletzt gerufenes Modell, Versuchsfehler). Die 503 bleibt, auch wenn das Protokoll nicht schreiben kann. Gilt auch für Konflikt- und Dublettenurteil. | `kapazitaet-hinterlaesst-spur.test.ts` K1–K3, `protokoll-vollstaendig.test.ts` W5 |
| Ben R1 B1, R-0612 „ohne Frage- und Antworttexte“ | `error` übernimmt Meldungen nur noch von einer Erlaubnisliste selbstgebauter Fehlertypen (Zeitlimit, HTTP samt Anbieterbegründung, leere Antwort, Auslastung, Abschaltung, Vertraulichkeitssperre, `ReasonerMeldungFehler`). Für jeden anderen Fehler stehen nur Typ und Fehlerklasse da, z. B. `SyntaxError (parse)`. Der Fehlerdatensatz trägt die Versuchszeile aller Glieder. | `protokoll-vollstaendig.test.ts` I1–I3 |
| Ben R1 B2, R-0612 „jeder Aufruf“, R-1666 | Vier neue Laufarten: `enrich`, `conflict`, `duplicate`, `probe` (öffentliche Anreicherung, Konflikt-/Dublettenurteil, Anbieterprobe einschließlich lokaler Probe). Je Aufruf mit Modellversuch entsteht genau ein Lauf mit Modell, Verbrauch, Ausgang und inhaltsfreier Fehlerzeile. Ohne Modellversuch entsteht keiner. Karte, Zählung und Texte DE/EN/NL kennen die zwölf Arten (`MODEL_RUN_TASKS`). | `protokoll-vollstaendig.test.ts` W1–W6, `auswertung-flaeche.test.tsx` F6, `tests/ki-aufgabenarten/` R3a–R3i |
| Ben R1 B3, V9, R-0705, R-0759, R-0833 | Kosten je Lauf: werden beim Schreiben aus Verbrauch × Preisliste berechnet und mit Preisstand gespeichert (`kosten`). Die Preisliste setzt der Betreiber über `KLARWERK_KI_PREISLISTE` (Startvertrag, `env.demo.beispiel`). Der Code liefert **keine** Preise mit. Die Laufkarte zeigt je Lauf die Kosten. Die neue KI-Auswertung zeigt je Währung die Summe für den gewählten Zeitraum (7/30/90 Tage), jeweils mit Grundmenge und Preisstand. | `kosten-und-auswertung.test.ts` P1–P3, S1, A1, R1–R2; `auswertung-flaeche.test.tsx` F1, F3–F5 |
| Ben R1 B4, R-0759, R-1984 | `erzeugt` = Art und Anzahl dessen, was ein gelungener Lauf zurückgab (z. B. 3 × Punkt, 1 × Urteil), nie der Inhalt. Die Laufkarte zeigt es an. | `protokoll-vollstaendig.test.ts` E1–E3, W1–W3; `auswertung-flaeche.test.tsx` F2 |
| Ben R1 B5, R-2071 | Strukturierte Logzeile `ki_lauf` je Lauf über den App-Logger: Aufgabe, Status, Anbieter, Modell, Dauer, Token, Kosten, Erzeugnis. Fehlertext, Anfragender und Gegenstand stehen nicht darin. Dazu `GET /api/model-runs/auswertung?von&bis` (`ko.read`, nur Summen) und die Auswertungskarte als KI-Nutzungs- und Kosten-Dashboard. | `kosten-und-auswertung.test.ts` S1–S2, A1–A2, R1–R3 |

Gegenproben: Wird die Meldungs-Erlaubnisliste ausgeschaltet oder schreibt das Laufbuch nichts,
fallen I1, I2, W1–W5 und E3 rot aus. Ohne die Kapazitätskorrektur fallen K1 und K2 rot aus.

## Offen, mit Grund

- **Preise selbst (Entscheidung Pedi):** Welche Preise, welche Währung und welcher Stand gelten,
  ist nicht festgelegt. Der Mechanismus steht. Ohne gesetzte `KLARWERK_KI_PREISLISTE` zeigt die
  Übersicht „Keine Preisliste hinterlegt — Kosten werden nicht berechnet.“ Altläufe tragen keine
  Kosten, sie werden nicht nachberechnet.
- **Erzeugte Gegenstände als Kennungen:** `erzeugt` nennt Art und Anzahl. Eine Verknüpfung zum
  später gespeicherten Entwurf/KO entsteht erst in den Routen nach dem Lauf und ist nicht gebaut.
  `subject` (KO) bleibt der einzige Objektbezug.
- **Tracing und externe Metriken (R-2071):** Es gibt keine OpenTelemetry- oder Prometheus-Anbindung.
  Das wäre eine neue Betriebsinfrastruktur und braucht eine Entscheidung. Geliefert sind
  strukturierte Logzeile, Auswertungs-API und Dashboard-Karte.
- **Kennzeichnung nach KI-VO Art. 50:** Die neuen Laufarten sind bewusst nicht in
  `KI_ERZEUGENDE_AUFGABEN` aufgenommen (Begründung in `services/model-runs/src/types.ts`). Ob
  `enrich` gekennzeichnet werden muss, ist eine Rechtsfrage und hier nicht entschieden.
- **Anzeige des Fehlergrunds:** `error` steht im Datensatz und in der API. Die Laufkarte zeigt ihn
  nicht.
- **Nicht geprüft (R-1536, R-1544, R-1567):**
  - echte Anbieter-API und Schlüsselbund,
  - PostgreSQL-Persistenz einschließlich des neuen `PgModelRunRepo.zwischen`,
  - Browserlayout und echte Tastaturbedienung der Karten in Chromium,
  - „unbekannte Live-Art“ und die vollständige Karten-Zustandsmatrix,
  - die Klärung OpenAI-400/`model-error` (N12d).

  Im Bau wurde nichts davon ausgeführt (kein Docker, kein Browser auf dem Produktions-Mac).

## Quellenwidersprüche

- „Modellläufe werden nicht protokolliert“ (Register, zeitweise): durch SCRUM-164 (26.06.)
  überholt. Bis zu diesem Lauf waren vier Modellwege tatsächlich ohne Protokoll (B2, jetzt
  geschlossen).
- „select rechnet grundsätzlich ohne Modell“ (`types.ts` am Feld `model`, `Reasoner.select`):
  gilt nur für das synchrone Keyword-Ranking `Reasoner.select`. Dafür gibt es keinen produktiven
  Aufrufer. Der produktive `select`-Weg ist `deriveImportCriteria` (JOB 3127) und befragt ein
  echtes Modell.
- `apps/web/src/api/types.ts` (JOB 3074) sagte „KEIN PREIS … die Oberfläche zeigt keine
  Kostenzahl“. Das gilt seit diesem Lauf nur noch ohne hinterlegte Preisliste.
- R-1567 nennt sechs Fallback-Läufe. Sie sind keine KI-Abnahme. Eine Abnahme mit echtem Modell
  fehlt weiterhin.
