# Modul: extensions — Strategische Erweiterungen

> Quelle: Pflichtenheft §3.14 (FR-EXT-01…07). Jira-Epic: KW-EXT.
> Status laut Pflichtenheft: in Demo/App als **interaktive Screens** umgesetzt; produktive
> Import-/Extraktions-Pipeline = **Roadmap**. Klar als „Demo/Konzept" kennzeichnen.

## Ziel
Strategische Differenzierung: Wissen importieren, priorisieren, als Outputs ausgeben und als
„Company Memory" visualisieren — zunächst als Konzept-Screens.

## User Stories & Akzeptanzkriterien (KANN, sofern nicht anders vermerkt)

### FR-EXT-01 · Knowledge Import (KANN)
- [ ] **Gegeben** Quellen (Video, SOP, Servicebericht, Excel, Wiki, PDF, Foto), **dann** zeigt der Screen die Pipeline Upload→Extrahieren→Strukturieren→Validieren→Freigeben→Wiederverwenden mit Befunden (Kandidaten/Konflikte/fehlend/veraltet/Dubletten/IP).

### FR-EXT-02 · Importiertes Objekt (KANN)
- [ ] **Gegeben** ein Import, **dann** initial `unvalidated/imported/draft`, der Validierung zugewiesen, Originalquelle verlinkt (im Konzept/Datenmodell vorgesehen).

### FR-EXT-03 · Output Factory (KANN)
- [ ] **Gegeben** validiertes Wissen, **dann** Vorschau von Arbeitsanweisung/SOP/Checkliste/Training/FAQ **nur** aus validierten Objekten, mit voller Provenance (Quelle, Trust, Status, Version, Gültigkeit, Rolle, Unsicherheiten).

### FR-EXT-04 · Wissens-Priorisierung (KANN)
- [ ] **Gegeben** 9 Faktoren (Bus-Faktor, Kritikalität, Prozessnähe, Alter, Quellenqualität, Konfliktdichte, Wiederholhäufigkeit, Schadenspotenzial, IP-Wert), **dann** gerankte Liste mit Score, Flags, Faktor-Detail.

### FR-EXT-05 · Knowledge House / Company Memory (KANN)
- [ ] **Gegeben** Domänen als Stockwerke (gesichert vs. fragil), **dann** Screen mit Füllgrad + KPIs (Import→Haus→Output).

### FR-EXT-06 · Validity & Protection (KANN)
- [ ] **Gegeben** ein Objekt, **dann** zwei Sichten — Aktualität (frisch/altert/fällig/veraltet) und IP-Sensitivität (öffentlich…streng vertraulich) — mit Maßnahme/Deployment-Empfehlung.

### FR-EXT-07 · Import/Output-Felder (SOLL, Konzept)
- [ ] **Gegeben** das Datenmodell, **dann** sind `source_type`, `import_status`, `validity_until`, `freshness_status`, `ip_sensitivity`, `output_eligible`, `generated_outputs` u. a. dokumentiert.

## Abgrenzung
Produktive Pipeline ist **nicht** v1-Scope; v1 liefert die Konzept-Screens + Datenmodell-Vorsorge.
Konnektoren zu Drittsystemen über JSON hinaus sind Out of Scope (§6).

## Offene Fragen
Welche EXT-Teile werden in v1 real vs. nur als Screen · Extraktions-Pipeline-Architektur (Roadmap).
