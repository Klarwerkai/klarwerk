# Klarwerk — Cloud-Provider & GPU-Instanz: Decision-Readiness-Notiz

> Qualitative Entscheidungsgrundlage für einen **späteren** selbst gehosteten Inferenz-Server.
> **Keine Cloud-Konten, keine GPU-Buchung, keine Provisionierung, keine Modell-Downloads, keine
> Live-Preise als verbindlich.** Preisangaben sind **grobe, nicht verbindliche** Größenordnungen —
> zum Entscheidungszeitpunkt **aktuell zu prüfen**. Verwandt: `inference-server-readiness.md`,
> `scaling-cost-control-readiness.md`, `server-hardening-readiness.md`, `fine-tuning-decision.md`,
> `rag-readiness-decision.md`, `docs/compliance/gdpr-compliance-runbook.md`, `secrets-management.md`.

---

## 1. Einordnung / Abhängigkeit

Eine GPU-/Provider-Wahl ist **downstream** von Entscheidungen, die **noch nicht getroffen** sind:
- **Inferenz-Server:** Partial/Blocked — kein vLLM/TGI/Ollama, kein Adapter (`inference-server-readiness.md`).
- **Fine-Tuning:** „jetzt nicht" (`fine-tuning-decision.md`).
- **RAG:** „jetzt nicht" (`rag-readiness-decision.md`).

→ Solange **kein** self-hosted Modell gebraucht wird (heute: Anthropic-API **oder** deterministischer Fallback, **keine** GPU-Last), ist eine **verbindliche** GPU-Buchung **verfrüht**. Diese Notiz hält die **Auswahlkriterien + Shortlist** fest, damit die Entscheidung schnell getroffen werden kann, **sobald** der Bedarf real ist.

---

## 2. Anforderungen aus Klarwerk

| Anforderung | Konsequenz |
| --- | --- |
| **EU/DSGVO** | Region **EU/Deutschland**; AVV/DPA mit Provider; Datenfluss im Haus/EU (`gdpr-compliance-runbook.md`). Bestehender Stack ist bereits **Hetzner DE + Cloudflare**. |
| **Modellgröße/VRAM** | erstes self-hosted Modell voraussichtlich **klein–mittel** (≈7B–13B, quantisiert) → **~16–24 GB VRAM** genügen. |
| **Betriebsaufwand** | schlankes Ops-Team → Same-Vendor/Managed bevorzugt; wenig bewegliche Teile. |
| **Kostenkontrolle** | Budget-/Idle-Disziplin nötig (`scaling-cost-control-readiness.md`): kein 24/7-GPU ohne Bedarf; Scale-to-Zero/On-Demand für PoC. |
| **Datenfluss** | self-hosted hält Daten im Haus (Vorteil ggü. externem API-Modell); dennoch VVT/DSFA aktualisieren. |
| **Rollback/Fallback** | Provider per Env zurück auf Anthropic **oder** deterministischen Fallback (bereits vorhanden) — nie ohne Rückweg. |

---

## 3. Vergleichsmatrix Provider (qualitativ)

| Provider | DSGVO/EU-Fit | GPU-Auswahl | Betriebsaufwand | Kosten (grob, **nicht verbindlich**) | Eignung für Klarwerk |
| --- | --- | --- | --- | --- | --- |
| **Hetzner (DE)** | **sehr gut** (DE, bereits App-Host, AVV vorhanden) | begrenzt (dedizierte GPU-Server, weniger Varianten/Verfügbarkeit) | **niedrig** (Same-Vendor, ein Dashboard/Coolify) | i. d. R. **günstig** | **Erste Wahl**, wenn passende GPU verfügbar — minimaler neuer Vendor/Compliance-Aufwand |
| **AWS/GCP/Azure (EU-Region, z. B. Frankfurt)** | gut (EU-Region + DPA wählbar) | **sehr breit** (L4/A10G/A100/H100) | höher (IAM/Netz/Kostenmodell komplex) | mittel–hoch | wenn breite GPU-Auswahl/Skalierung/Managed-Services nötig |
| **RunPod / Lambda Labs (GPU-Spezialisten)** | **prüfen** (EU-Region + AVV je Anbieter verifizieren) | breit, oft günstig | mittel | **oft am günstigsten** | schneller, billiger **PoC/Experiment**; Compliance-Posture genau prüfen |
| **Lokaler Mac/Workstation (Apple Silicon)** | n/a (intern) | Ollama/llama.cpp lokal | sehr niedrig | ~0 (vorhandene HW) | **nur Dev/PoC**, **nicht** Produktion |

---

## 4. Instanzklassen (grobe Zuordnung)

| Klasse | VRAM (grob) | Passend für | Klarwerk-Bedarf |
| --- | --- | --- | --- |
| **L4 / A10(G)** | ~24 GB | kleine–mittlere Modelle (7B–13B, quantisiert) | **wahrscheinlich ausreichend** für ersten self-hosted Einsatz |
| **A100** | 40/80 GB | große Modelle / hoher Durchsatz | **vorerst Overkill** |
| **H100** | 80 GB | sehr große Modelle / Training | **nicht nötig** in absehbarer Zeit |

**VRAM-Faustregel:** Parameter × Bytes/Param + KV-Cache. Beispiel 7B: 4-bit ≈ ~5–6 GB, fp16 ≈ ~14 GB (+ Cache) → **L4/A10 genügt**.

---

## 5. On-Demand vs. Reserviert vs. Spot

| Modell | Vorteil | Nachteil | Einsatz |
| --- | --- | --- | --- |
| **On-Demand** | flexibel, kein Commitment | höchster Stundenpreis | **PoC / variable Last** (empfohlener Start) |
| **Reserviert** | günstiger bei Dauerbetrieb | Commitment-/Auslastungsrisiko | erst bei **stabiler 24/7-Last** |
| **Spot/Preemptible** | am günstigsten | jederzeit kündbar | **Batch/Eval**, **nicht** für Always-On-Inferenz |

---

## 6. Shortlist & empfohlener erster Schritt

**Shortlist (Reihenfolge):**
1. **Hetzner DE** (passende GPU verfügbar?) — bester DSGVO-/Ops-Fit (Same-Vendor).
2. **RunPod/Lambda (EU-Region, AVV geprüft)** — günstigster PoC, wenn Hetzner-GPU nicht passt.
3. **EU-Hyperscaler (AWS/GCP/Azure, Frankfurt)** — wenn breite GPU-Auswahl/Skalierung nötig.
4. **Lokaler Apple-Silicon-Mac** — **nur** Dev/PoC (Ollama), keine Produktion.

**Empfohlener erster Schritt (sobald Inferenz-Bedarf bestätigt):** **on-demand L4/A10 in EU-Region** für einen **zeitlich begrenzten PoC** (kleines quantisiertes Modell, vLLM/TGI/Ollama), **mit Idle-Abschaltung** und Budget-Limit — **kein** Dauerbetrieb, **keine** Reservierung vor gemessenem Bedarf.

---

## 7. Offene Entscheidungen (Budget / DSGVO / Ops — durch Pedi)

- **Bedarf bestätigt?** (self-hosted Modell überhaupt nötig vs. weiter Anthropic-API) — Voraussetzung.
- **Budget freigegeben?** (GPU-Stundensatz × erwartete Laufzeit; PoC vs. Produktion).
- **Provider/Region/Instanztyp verbindlich gewählt?** — heute **nein**.
- **AVV/DPA** mit gewähltem Provider; VVT/DSFA-Update (`gdpr-compliance-runbook.md`).

---

## 8. Kriterien für „Done"

1. Inferenz-Bedarf real bestätigt (`inference-server-readiness.md`-Trigger).
2. **Verbindliche** Wahl von **Provider + Region + Instanztyp** durch Pedi.
3. **Budget** freigegeben (inkl. Idle-/Kostenkontrolle).
4. **AVV/DPA + DSGVO-Region** geklärt; VVT/DSFA aktualisiert.
5. Rollback-Pfad (Env zurück auf Anthropic/Fallback) dokumentiert.

---

## 9. Nicht-Ziele

- Keine Cloud-Konten, keine GPU-Buchung, keine Provisionierung, keine Live-Infra-Änderung, keine Modell-Downloads.
- Keine verbindlichen Live-Preise; keine Produktentscheidung anstelle von Pedi.
- Kein Produktcode geändert; reine **Decision-Readiness-Dokumentation**.

---

## 10. Empfehlung

**PARTIAL.** Anforderungen (EU/DSGVO, ~16–24 GB VRAM, schlanker Betrieb, Kostenkontrolle, Rollback) und eine **qualitative Shortlist** (Hetzner DE zuerst; RunPod/Lambda für PoC; EU-Hyperscaler bei Skalierungsbedarf; lokaler Mac nur Dev) sind dokumentiert, inkl. Instanzklassen (L4/A10 reicht) und Beschaffungsmodell (On-Demand-PoC). **Aber:** es gibt **keine** verbindliche Wahl von Provider/Region/Instanztyp, **kein** freigegebenes Budget und **keinen** bestätigten Inferenz-Bedarf — und eine GPU-Buchung wäre vor diesen Entscheidungen verfrüht. Das Kriterium „Cloud-Provider & GPU-Instanz **ausgewählt**" ist daher **nicht** erfüllt → **Partial**; die verbindliche Auswahl ist eine **Pedi-/Budget-/DSGVO-Entscheidung** (Kriterien §8).

---

*Read-only Decision-Readiness-Notiz. Kein Produktcode geändert; keine Konten/GPU/Infra erzeugt; Preise grob und nicht verbindlich (zum Entscheidungszeitpunkt zu prüfen).*
