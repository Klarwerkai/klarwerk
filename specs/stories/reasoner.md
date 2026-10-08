# Modul: reasoner — KI-Schicht

> Quelle: Pflichtenheft §3.11 (FR-RSN-01…06), NFR-MNT-01, NFR-SEC-05. Jira-Epic: KW-RSN.
> Querschnitt-Modul: wird von capture, structure, validation, conflicts, ask genutzt.

## Ziel
Gekapselte, anbieteragnostische KI-Schicht mit Anti-Halluzination, deterministischem Fallback
und serverseitiger Schlüsselhaltung.

## User Stories & Akzeptanzkriterien

### FR-RSN-01 · Aufgabenspektrum (MUSS)
- [ ] **Gegeben** die Reasoner-Schicht, **dann** verfügbar: Strukturieren, Beantworten, Interview, semantische Suche/Auswahl, Zweitmeinung, Schreibhilfe.

### FR-RSN-02 · Modell-/anbieteragnostisch (MUSS, NFR-MNT-01)
- [ ] **Gegeben** ein Modellwechsel, **dann** per Konfiguration ohne Codeänderung der Fachlogik.

### FR-RSN-03 · Anti-Halluzination (MUSS)
- [ ] **Gegeben** fehlendes belastbares Wissen, **dann** keine Rateantwort; Trennung gesichert/ungeprüft/Meinung/extern/Annahme; Unwissen wird benannt.
- [ ] **Gegeben** die Schreibhilfe `assist` (`POST /api/reasoner` mit `task:"assist"`), **dann** wird der Text nur sprachlich geglättet/präzisiert, ohne Inhalt/Fakten zu erfinden; ohne Modell liefert der deterministische Fallback eine markierte (`demo:true`) Glättung.

### FR-RSN-04 · Deterministischer Fallback (MUSS)
- [ ] **Gegeben** kein Modell, **dann** laufen alle Seiten; Antworten sind als Demo erkennbar.

### FR-RSN-05 · Server-echte Statusanzeige (MUSS)
- [ ] **Gegeben** die Anzeige „Reasoner aktiv/offline", **dann** spiegelt sie die tatsächliche Modell-Verfügbarkeit.

### FR-RSN-06 · Schlüssel nur serverseitig (MUSS, NFR-SEC-05)
- [ ] **Gegeben** das Frontend-Bundle, **dann** enthält es keinen KI-Schlüssel.

## API / Schnittstellen (Entwurf)
Interne Schicht `reasoner.structure|answer|interview|search|secondOpinion|assist`. HTTP `GET /api/reasoner/status`. Adapter pro Anbieter hinter einheitlichem Interface; Konfiguration via ENV/Secret-Store.

## Aufgabenvertrag im Code (Aufnahme 20260922 · gesamt-reasoner-vertrag, Stand 2026-10-08)
Die Namen im Entwurf oben weichen vom Code ab. Die sechs Aufgaben der Quelle (R-0687, FR-RSN-01)
liegen an der öffentlichen Fläche `services/reasoner/index.ts` (Klasse `Reasoner`):

| Aufgabe (Quelle) | Entwurf oben | Reasoner-Methode | Einstellung je Aufgabe |
|---|---|---|---|
| Strukturieren | `structure` | `structure` | `structure` |
| Antworten | `answer` | `answer` | `answer` |
| Interview | `interview` | `interview` | `interview` |
| Kandidaten-Auswahl / semantische Suche | `search` | `select` | `select` |
| Zweitmeinung | `secondOpinion` | `judgeConflictOutcome` (Konfliktprüfung zweier Kerntexte) | folgt der globalen Wahl |
| Schreibhilfe | `assist` | `assistText` | `assist` |

Modell und Endpunkt sind Einstellung, nicht Code (FR-RSN-02, NFR-MNT-01): `REASONER_MODEL`,
`OPENAI_MODEL`, `ANTHROPIC_MODEL`, `OPENAI_BASE_URL` und der lokale LLM (`model-client.ts`), dazu
die Admin-Zuordnung global und je Aufgabe (`PUT /api/reasoner/config`, persistiert in
`reasoner_policy`). Belege: `tests/ki-aufgabenvertrag/sechs-aufgaben.test.ts` (alle sechs über eine
Schicht, Umstellen per Einstellung), `tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`
(Anbieterwechsel am Netzweg), `tests/openai-cloud-anbieter/openai-ist-ein-externer-cloud-anbieter.test.ts`
(Modell und Endpunkt aus der Umgebung).

Offen bzw. anderswo geführt:
- **Zweitmeinung im Konfliktablauf.** `POST /api/conflicts/:id/second-opinion` nimmt heute nur
  menschlichen Freitext; die Konfliktprüfung des Reasoners ist dort nicht angebunden. Der Ablauf
  Eskalation → Zweitmeinung → Entscheidung gehört zum Auftrag `gesamt-konfliktentscheidung`, die
  Zweitmeinung zu Klara-Antworten zu `gesamt-klara-zweitmeinung`.
- **Mandantenfähigkeit (NFR-MNT-03).** Umgesetzt im festgelegten Mandantenmodell des Produkts:
  ein Kunde = eine Instanz mit eigenem Datenbestand (`services/app/src/addon-principal.ts:25-29`).
  Daten, Konten, Sitzungen und KI-Zuordnung (`reasoner_policy` je Datenbank) sind damit je Kunde
  getrennt. Beleg: `tests/mandanten-isolation/instanz-ist-mandantengrenze.test.ts` — zwei
  Kunden-Instanzen über die echten HTTP-Routen; keine sieht Wissensobjekte, Anmeldung oder
  KI-Zuordnung der anderen. NICHT gebaut ist der Betrieb mehrerer Kunden in EINER Instanz mit
  Trennung je Anfrage; das ist eine eigene Architekturentscheidung (dort als „v2/SSO" geführt).

## Datenmodell (Auszug)
Keine eigene Persistenz außer Konfiguration + KI-Kosten-/Nutzungs-Logging (NFR-OPS-03).

## Nicht-Ziele (v1)
Fine-Tuning eigener Modelle; Client-seitige Inferenz.

## Offene Fragen
On-Premises-Modell/Hardware (Pflichtenheft §7) · Default-Modell je Deployment-Modell · Embedding-Quelle für semantische Suche.
