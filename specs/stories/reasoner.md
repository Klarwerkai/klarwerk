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

## Datenmodell (Auszug)
Keine eigene Persistenz außer Konfiguration + KI-Kosten-/Nutzungs-Logging (NFR-OPS-03).

## Nicht-Ziele (v1)
Fine-Tuning eigener Modelle; Client-seitige Inferenz.

## Offene Fragen
On-Premises-Modell/Hardware (Pflichtenheft §7) · Default-Modell je Deployment-Modell · Embedding-Quelle für semantische Suche.
