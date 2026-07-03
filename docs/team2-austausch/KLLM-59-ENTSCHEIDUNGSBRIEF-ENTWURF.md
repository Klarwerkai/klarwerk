# KLLM-59 · Entscheidungs-Brief „Eigener LLM-Server" — ENTWURF nach Eval-Sitzung 1

> Für Pedi, eine Seite. [Paul / Cloud-Worker], 03.07.2026. Status: **Entwurf** — Sitzung 2
> (kleinere Modelle) steht noch aus, die Kernaussage trägt aber schon.

## Das Ergebnis in einem Satz

**Qwen3-32B-AWQ auf einer gemieteten L40S-GPU erreicht auf unserem Prüfstand Referenzniveau
(22/24 Punkte — exakt wie claude-sonnet-4-6), antwortet doppelt so schnell (Ø 1,7 s vs. 3,3 s)
und kostet dabei rechnerisch ~0,52 € pro 1.000 Aufgaben.**

## Der Ehrlichkeits-Check (unser K.-o.-Kriterium)

Bestanden — alle drei „ehrlich passen"-Fälle: sagt „keine Punkte gefunden", wenn ein Dokument
nichts hergibt; erfindet keine Kandidaten; G-2-Belegstellen wörtlich. **Eine Bedingung:** Das gilt
nur mit ABGESCHALTETEM Qwen3-Denkmodus. Mit Denkmodus fiel das Modell auf 16/24 und riss
zwei von drei Ehrlichkeits-Fällen. → Harte Auflage für den App-Anschluss (KLLM-61):
`enable_thinking=false` + Denkblock-Filter im Client (Vorlage: Prüfstand-Runner v2).

## Ehrliche Grenzen der Messung

12 erfundene Fälle, automatische Oberflächen-Checks (kein menschliches Qualitätsurteil),
Latenz ohne App-/Netz-Overhead. Schwächste Fälle: Interview-Nachbohren (1 P) und eine
Detail-Auslassung beim Umformulieren (1 P — denselben Fehler machte auch die Referenz).

## Kosten der Eval-Sitzung 1

~2 Betriebsstunden L40S ≈ 2,22 € + marginaler Storage — vollständig aus den Gratis-Credits.
(Inkl. Lehrgeld: manueller 50-GB-Deploy kostete ~1 h Fehlersuche; Regeln nachgezogen.)

## Die drei Betriebsoptionen (Zahlen am Entscheidungstag im Konfigurator verifizieren!)

- **A · UpCloud on-demand / monatlich:** 1,11 €/h. Dauerbetrieb 24/7 ≈ 800 €/Monat (rechnerisch);
  realistischer Betriebsstunden-Ansatz (Bürozeiten, Auto-Stop) deutlich darunter. Sofort machbar,
  EU/Helsinki, kein Setup. Credits (~500 €, Verfall ~01.08.) würden den ersten Monat tragen.
- **B · Hetzner dediziert:** Kandidat für echten Dauerbetrieb — Preis NUR aus dem Live-Konfigurator
  übernehmen (Vorfall dokumentiert); Setup-Gebühr + Monatsbindung gegen niedrigeren Stundensatz.
- **C · „Lohnt (noch) nicht":** Anthropic bleibt Betriebsweg. Nach diesem Ergebnis fachlich NICHT
  mehr die naheliegende Option — bleibt aber gültig, falls Betriebsaufwand/Härtung (Phase 3) den
  Nutzen frisst. D-012 unverändert: Beta hängt nicht am eigenen Server.

## Empfehlung

1. **KLLM-61 jetzt einplanen** (nach RC-Freeze): openAiCompatibleClient + `KLARWERK_LOCAL_LLM_URL`
   + Denkmodus-Auflage — dann kann die App den Server real nutzen, sobald einer läuft.
2. **Sitzung 2 (günstig, im Credit-Fenster bis ~01.08.):** Qwen3-14B + Mistral Small vergleichen —
   reine Kostenoptimierung; dafür vorher Skript-Erweiterung „Modellwahl" (.NEU → Boss-Übernahme).
   Optional L40S-Gegencheck H100, falls Kapazität zurückkommt (nicht entscheidungskritisch).
3. **Dauerbetriebs-Entscheidung (Phase 3) erst nach Sitzung 2** — dann A vs. B mit echten
   Konfigurator-Zahlen und gemessenem Bedarf. Nur nach Pedi-Go.

## Offene Punkte bis zum finalen Brief

Sitzung-2-Zahlen (14B/Mistral) · Konfigurator-Preise A/B am Entscheidungstag · Interview-Qualität
(INT-2) einmal menschlich beurteilen — der Prüfstand misst hier nur Oberfläche.
