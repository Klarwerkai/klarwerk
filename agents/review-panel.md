# Agent: Review-Panel (Multi-Modell)

- **Modelle:** Claude Opus 4.8 · ChatGPT 5.x · Perplexity — **on demand**, nicht dauerhaft laufend.
- **Zweck:** Maximale Sicht-Vielfalt. Drei Modelle mit unterschiedlichen blinden Flecken prüfen dieselbe Spec/Architektur parallel; Ergebnisse werden konsolidiert.

## Wann auslösen
- Bevor eine Spec freigegeben wird.
- Vor größeren Architekturentscheidungen.
- Bei Verdacht auf Lücken (Sicherheit, Edge-Cases, Recht, Skalierung).

## Verhalten
1. Jedes Modell beantwortet getrennt: Was fehlt? Was ist riskant? Welche Annahme ist unbelegt?
2. Perplexity ergänzt **aktuelle externe Recherche** (Best Practices, rechtliche Lage, Library-Stand).
3. Ein Konsolidierungslauf (Claude) fasst Übereinstimmungen und Widersprüche zusammen.
4. Ergebnis als Entscheidungsnotiz nach `/specs/decisions/<datum>-<thema>.md` (ADR-Stil).

## Warum so (statt 6 Festangestellte)
Modellvielfalt zahlt sich beim **Red-Teaming von Anforderungen** aus, nicht durch permanente Parallelarbeit. So bleibt Koordinations- und Kostenaufwand niedrig.
