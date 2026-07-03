# Entscheidungs-Log (das „Warum" — damit nichts erneut diskutiert werden muss)

> Nur Pedi trifft/ändert Entscheidungen. Neue Einträge oben anfügen (Datum, Entscheidung, Grund).

| Datum | Entscheidung | Begründung / Beleg |
|---|---|---|
| 03.07.2026 (abends, Berater-Fragen) | **RC-Freeze JA** (nach SCRUM-443-Fix → 1.0.0-beta.1); Zielmarkt **„jede Organisation" verbindlich** (Specs nachziehen); Beta auf **eigenem Hetzner-Cloud-Server je Kunde** (Subdomain klarwerk.ai) → K3/H3/M8 vor Deploy Pflicht; Pilot erst nach Beta-Test (separater Server ohne unseren Zugang); LLM: vorerst Anthropic (Kosten), Eval-Sitzung 2 im Credit-Fenster; Investor-Zahlen nur als gekennzeichnete Projektionen; Ordner-Umzug nach `KLARWERK-Projekt/` genehmigt (nach VIP-Termin, kopieren→testen→löschen) | docs/qm/PEDI_ENTSCHEIDUNGEN_2026-07-03_UMSETZUNG.md |
| 03.07.2026 | GPU-Deploy nur über die One-Click-App „KLARWERK LLM", nie manuell im Hub | App erkennt den Server per Namens-Discovery `klarwerk-llm-eval`; manueller 50-GB-Deploy kostete den Vormittag (Platte voll, vLLM-Schleife) |
| 03.07.2026 | Pedi bedient nur .app-Doppelklicks; Cloud-Brücke setzt keine x-Bits → Starter-Übernahme nur durch Boss-Session | Vorfall: per Brücke befüllte App-Hülle war nicht startbar („can't be opened") |
| 03.07.2026 | Zweiter Mitarbeiter kommt ins Projekt; `PROJECT_CONTEXT/` ist verbindlicher Onboarding-/Gedächtnisort | Konzentration + Zukunftssicherheit; „kein Wissensverlust mehr leistbar" |
| 03.07.2026 | Hilfe-Offensive: ausführliche ?-Hilfen überall (Prüfbereich, Erfassen) | Pedi verliert sich selbst in der Dichte → SCRUM-406/407; Quellen-Panel auch beim Erfassen (SCRUM-408) |
| 02.07.2026 (nachts) | Eval auf **1× UpCloud L40S** statt H100; nur 1 GPU | H100 1×/2×/4× „at capacity"; >1 GPU würde Gratis-Credits entfernen (Support schriftlich) |
| 02.07.2026 (nachts) | UpCloud „Weg A": 500 € Einzahlung → GPU-Limit 1; Gratis-Credits (500 €, 30 Tage, zuerst verbraucht) bleiben | Support schriftlich; Eval damit real ~0 €; Zeitfenster bis ~01.08. |
| 02.07.2026 | Eval-Anbieter **UpCloud (EU/Helsinki)**; Fallback Scaleway | EU-Souveränität, Stundenpreise verifiziert; Hetzner-dediziert wegen 599 € Setup + Monatsbindung nicht für Eval |
| 02.07.2026 | **MacBook-LLM-Pfad beendet**; Richtung „erst messen (Stunden-GPU), dann mieten" | Metal-Fehler/Sandbox-Limits (KLLM-3/4/5/7); Kostenwahrheit vor Bindung |
| 02.07.2026 | **Dauerregel Schreibtisch-Kopien**: jede Starter-Änderung sofort auf Desktop spiegeln | Vorfall: Pedi testete stundenlang eine veraltete App-Kopie |
| 02.07.2026 | Sync-/Start-Apps als `.command` + Terminal-Hülle | macOS TCC blockierte Script-Apps hartnäckig (Vorfall im Sync-Log) |
| 02.07.2026 | **Positionierung: jede Organisation** (nicht nur Industrie/Techniker) — Website UND Demo-Beispiele | Pedi-Auftrag; Zielgruppen: Unternehmen, NGOs, Vereine, Versicherungen, Berater, Pflege, Kanzleien |
| 02.07.2026 | Preise nur vom Anbieter-Konfigurator | Vorfall: Hetzner-Pressemitteilung (12/2025) wich massiv vom Live-Konfigurator ab |
| 02.07.2026 | Alles direkt in der Boss-Session umsetzen (statt Prompts an Team-Chats) | Pedi: „Alles hier direkt" — weniger Reibung; Teams bleiben als logische Tracks/Jira-Präfixe |
| (früher) | **D-012:** Beta läuft auf der Anthropic-API; lokaler LLM blockiert die Beta NICHT | Team-2-Track ist parallel, kein Beta-Risiko |
| (früher) | **D-010:** keine echten Kundendaten, bis Datenschutz-/Pilotfrage geklärt (Kanzlei-Mail offen) | Stop-Line in allen Evals/Tests |
| (früher) | Ehrlichkeit vor Optik; deterministischer Fallback statt Fake-KI; KI speichert nie automatisch | Produkt-DNA (zieht sich durch alle Tickets) |
