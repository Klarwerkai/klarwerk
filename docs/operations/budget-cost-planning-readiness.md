# Klarwerk — Budget- & Kostenplanung (Hardware + Cloud): Readiness-Notiz

> Kostenrahmen und Entscheidungsmodell für lokale Hardware und Cloud-/GPU-Betrieb — **ohne
> verbindliche Preise und ohne Budgetfreigabe zu erfinden.** Preise stehen als **Formeln/
> Platzhalter/Prüfliste**; konkrete Zahlen sind zum Entscheidungszeitpunkt **live zu prüfen**.
> Verwandt: `gpu-provider-decision.md`, `local-hardware-readiness.md`, `local-runtime-readiness.md`,
> `local-function-performance-baseline.md`, `scaling-cost-control-readiness.md`,
> `inference-server-readiness.md`, `backup-disaster-recovery.md`, `monitoring-logging.md`.

---

## 1. Heutiger Stand

- **Betrieb heute:** deterministischer Reasoner (**0 € Modellkosten**) **oder** optional **Anthropic-API** (extern, pro Token; intern **nicht** erfasst — `scaling-cost-control-readiness.md` §3).
- **Keine GPU, keine Cloud-GPU, keine lokale Runtime** (`inference-server-readiness.md`, `local-runtime-readiness.md`).
- **Hosting heute:** Hetzner-Server + Postgres + Backups + Cloudflare (`deploy-hetzner.md`, `backup-disaster-recovery.md`) — laufende Basis-Hostingkosten bestehen bereits.
- **Budgetfreigabe für Hardware/Cloud-GPU:** **liegt nicht vor** (keine in den Docs/Repo).

---

## 2. Kostenkategorien

| # | Kategorie | Typ | Quelle/Notiz |
| --- | --- | --- | --- |
| K1 | **Vorhandene lokale Hardware** (Mac) | einmalig (bereits da) | 0 € zusätzlich, sofern ausreichend (`local-hardware-readiness.md`) |
| K2 | **Zusatzhardware** (RAM/Storage/neuer Mac) | einmalig | nur falls Hardware-Verifikation Defizit zeigt |
| K3 | **Lokale Modellruntime/Modelle/Storage** | einmalig + gering laufend | Ollama/llama.cpp kostenlos; Storage pro Modell (`local-hardware-readiness.md` §5) |
| K4 | **Cloud-GPU on-demand** | laufend (nutzungsabhängig) | €/h × Stunden; nur bei Bedarf (`gpu-provider-decision.md` §5) |
| K5 | **Cloud-GPU 24/7** | laufend (fix) | €/h × 730 h/Monat; teuerste Dauerform |
| K6 | **API-Modellkosten** (Anthropic o. Ä.) | laufend (nutzungsabhängig) | €/1M Tokens × Tokens; extern abgerechnet |
| K7 | **Hosting/Postgres/Backups/Monitoring** | laufend | bestehende Basis; steigt mit Last (`scaling-cost-control-readiness.md`) |
| K8 | **Datenschutz/AVV/Ops-Aufwand** | einmalig + laufend | DSFA/AVV (`gdpr-compliance-runbook.md`), Betriebszeit (Personenstunden) |

---

## 3. Kostenformeln (statt erfundener Preise)

> Variablen zum Entscheidungszeitpunkt **live einsetzen**; hier bewusst **keine** Zahlen.

- **Cloud-GPU on-demand (Monat):** `Kosten = preis_pro_h × stunden_pro_monat` (+ Storage/Egress).
- **Cloud-GPU 24/7 (Monat):** `Kosten = preis_pro_h × 730` (+ Storage/Egress); reserviert oft günstiger (`preis_reserved < preis_ondemand`).
- **API-Modell (Monat):** `Kosten = (input_tokens × preis_in + output_tokens × preis_out) / 1e6`; `tokens ≈ anfragen_pro_monat × (tokens_in + tokens_out)_pro_anfrage`.
- **Lokaler PoC:** `Einmalig = zusatzhardware + 0(runtime)`; `laufend ≈ strom + ops_stunden` (kein €/h-GPU-Mietpreis).
- **Break-even Cloud vs. Kauf:** `monate_bis_breakeven = hardware_kaufpreis / (cloud_monatskosten − lokale_monatskosten)`.

---

## 4. Szenario-Matrix

| Szenario | Einmalig | Laufend | DSGVO/Datenfluss | Wann sinnvoll |
| --- | --- | --- | --- | --- |
| **S0 Status quo** (deterministisch / Anthropic optional) | 0 € | Hosting (K7) + ggf. API (K6) | API = externer Datenfluss | **heute** — kein neuer Bedarf |
| **S1 Lokaler PoC, vorhandene HW** | 0 € (K1/K3) | ~Strom/Ops | **lokal, kein Abfluss** | Hardware reicht (`local-hardware-readiness.md`) |
| **S2 Lokaler PoC + Zusatzhardware** | K2/K3 | ~Strom/Ops | lokal | RAM/Storage zu knapp |
| **S3 Cloud-GPU on-demand PoC** | ~0 € | K4 (stundenweise) | EU-Region + AVV nötig | kurzer Test, keine lokale HW |
| **S4 Cloud-GPU 24/7 Betrieb** | Setup | **K5 (höchste)** | EU-Region + AVV | produktive Dauerlast bestätigt |

**Reihenfolge-Empfehlung:** **S0 → S1** (billigster echter PoC, datenschutzfreundlich) → S3 (kurzer Cloud-Test) → S4 **nur** bei gemessener Dauerlast. (Konsistent mit `gpu-provider-decision.md`: On-Demand zuerst, 24/7 zuletzt.)

---

## 5. Einmalig vs. laufend (Übersicht)

- **Einmalig:** Zusatzhardware (K2), Modell-Download/Storage-Anschaffung (K3), Setup/DSFA (K8).
- **Laufend:** Cloud-GPU (K4/K5), API (K6), Hosting/Backups/Monitoring (K7), Ops-Stunden (K8).
- **Faustregel:** lokal = **hohe Einmal-, niedrige Laufkosten**; Cloud = **niedrige Einmal-, laufende (potenziell hohe) Kosten** → Auswahl hängt an erwarteter **Auslastung** (Break-even §3).

---

## 6. Budgetfreigabe-Checkliste (durch Pedi)

- [ ] **Bedarf bestätigt?** (self-hosted/Cloud-GPU überhaupt nötig vs. weiter S0)
- [ ] **Szenario gewählt** (S0–S4) + erwartete Auslastung geschätzt.
- [ ] **Live-Preise geprüft** (Provider-Stundensatz, API-Tokenpreis, Storage) — nicht aus dieser Notiz.
- [ ] **Monatsbudget + Obergrenze** festgelegt (inkl. Budget-Alerts, `scaling-cost-control-readiness.md` §6).
- [ ] **Einmalbudget** für Zusatzhardware (falls S2) freigegeben.
- [ ] **DSGVO/AVV** für gewählten Datenfluss geklärt (`gdpr-compliance-runbook.md`).
- [ ] **Freigabe dokumentiert** (Betrag, Laufzeit, Verantwortlicher).

---

## 7. Entscheidungspunkte für Pedi

1. **Bleiben bei S0** (kostenneutral) oder lokalen PoC (S1/S2) starten?
2. Falls Cloud: **on-demand (S3)** zuerst — **kein** 24/7 (S4) vor Lastnachweis.
3. **Budgethöhe + Obergrenze** je gewähltem Szenario.
4. **Hardware-Nachverifikation** (`local-hardware-readiness.md`) als Voraussetzung für S1/S2.

---

## 8. Nicht-Ziele

- Keine Cloud-/GPU-/Hardware-Buchung; keine verbindlichen Live-Preise; keine vorgetäuschte Budgetfreigabe.
- Keine Infrastruktur-/Runtime-/Modellinstallation; kein Produktcode.
- Reine **Kosten-/Budget-Readiness-Dokumentation**.

---

## 9. Done-Kriterien

1. **Szenario gewählt** (S0–S4) + **Auslastung** geschätzt.
2. **Live-Preise verifiziert** und in die Formeln (§3) eingesetzt → konkrete Monats-/Einmalkosten.
3. **Budget + Obergrenze** durch Pedi **freigegeben und dokumentiert**.
4. **DSGVO/AVV** für den Datenfluss geklärt.

---

## 10. Empfehlung

**PARTIAL.** Kostenkategorien (K1–K8), eine **Szenario-Matrix** (S0–S4 mit einmalig/laufend/DSGVO), **Kostenformeln statt erfundener Preise**, eine **Budgetfreigabe-Checkliste** und klare Entscheidungspunkte sind dokumentiert. **Aber:** es liegen **keine** verifizierten Live-Preise und **keine** Budgetfreigabe vor, und der Bedarf (self-hosted/Cloud-GPU) ist nicht bestätigt — heute trägt **S0** (deterministisch/optional Anthropic) **keine** neuen Kosten. Das Kriterium „Budget- & Kostenplanung **abgeschlossen/freigegeben**" ist daher **nicht** erfüllt → **Partial**; verbindliche Planung = **Pedi-/Budget-Entscheidung** (Checkliste §6, Done-Kriterien §9).

---

*Read-only Kosten-/Budget-Readiness. Kein Produktcode geändert; keine Buchung/Installation; Preise als Formeln/Platzhalter, nicht verbindlich; keine Budgetfreigabe vorgetäuscht.*
