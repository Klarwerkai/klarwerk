# Klarwerk — Lokale Hardware-Eignung (GPU/RAM/Storage): Readiness-Notiz

> Ehrliche Prüfung der Hardware-Eignung für lokale LLM-Inferenz, plus Selbst-Verifikation
> und Eignungsmatrix für später.
> **Keine Treiber-/OS-/CUDA-/Metal-Updates, keine Runtime-/Modell-/Docker-/GPU-Installation.**
> Verwandt: `gpu-provider-decision.md`, `local-runtime-readiness.md`,
> `local-function-performance-baseline.md`, `scaling-cost-control-readiness.md`,
> `inference-server-readiness.md`.

---

## 1. Prüfumgebungsgrenze (Ehrlichkeit)

Die ausführende Shell ist eine **isolierte Linux-Sandbox** — **nicht** der Mac des Betreibers. Real beobachtet (Sandbox, **irrelevant** für die Zielhardware):

| Check | Sandbox-Ergebnis | Bedeutung |
| --- | --- | --- |
| `uname -a` / `arch` | **Linux … aarch64** | kein macOS |
| `sw_vers`, `sysctl hw.memsize`, `system_profiler` | **nicht vorhanden** | macOS-Tools fehlen → Zielrechner nicht prüfbar |
| `nvidia-smi` | **nicht vorhanden** | keine NVIDIA/CUDA hier (sagt nichts über den Mac) |
| RAM / Disk (Sandbox) | ~4 GB RAM / ~9,6 GB Disk | **Sandbox-Container**, **nicht** die Mac-Werte |

→ **Mac-GPU/Metal, RAM und freier Speicher sind aus dieser Umgebung NICHT belegbar.** Es werden **keine** Mac-Hardware-Befunde erfunden.

---

## 2. Was belegbar ist (Repo / Deploy)

- **Klarwerk-App braucht keine GPU:** Node + Postgres; lokaler Betrieb heute **deterministisch** (kein Modell) — Funktions-/Latenz-Baseline in `local-function-performance-baseline.md`.
- **Keine lokale Runtime verdrahtet** (`local-runtime-readiness.md`); GPU/CUDA nur für einen **separaten** Inferenz-Server relevant (`inference-server-readiness.md`, `gpu-provider-decision.md`).
- → Hardware-Eignung betrifft **ausschließlich** einen späteren lokalen LLM-PoC, **nicht** den App-Betrieb.

---

## 3. Selbst-Verifikation auf dem Mac (durch Pedi)

```bash
sw_vers                                             # macOS-Version
uname -m                                            # arm64 (Apple Silicon) erwartet
system_profiler SPHardwareDataType                  # Chip, Kerne, RAM
system_profiler SPDisplaysDataType                  # GPU/Metal
sysctl -n hw.memsize                                # RAM in Bytes
df -h /                                              # freier Speicher
system_profiler SPStorageDataType                   # Datenträger-Details
```
→ Werte (Chip, RAM, freier Speicher, GPU/Metal) zurückmelden; dann lässt sich Done sauber bewerten und die passende Modellklasse (§4) festlegen.

---

## 4. Hardware-Eignungsmatrix (Beispiel — gültig erst mit echten Werten)

> Apple Silicon = **Unified Memory** (GPU teilt sich RAM). Richtwerte für **quantisierte (Q4)** Modelle inkl. etwas Kontext-/KV-Cache; konservativ.

| RAM | realistisch lokal | Hinweis |
| --- | --- | --- |
| **16 GB** | **3B–8B Q4 (vorsichtig)** | OK für kleine Modelle; wenig Spielraum für großen Kontext/Parallelität |
| **24/32 GB** | **7B–13B Q4 (realistischer)** | guter PoC-Bereich, mehr Kontext möglich |
| **64 GB+** | **größere Modelle / mehr Kontext** | 30B+ Q4 bzw. längere Kontexte realistischer |

**Faustregel VRAM/RAM:** Parameter × Bytes/Param + KV-Cache. Q4 ≈ ~0,5–0,6 GB pro Mrd. Parameter (7B ≈ ~5–6 GB; 13B ≈ ~8–10 GB) **plus** Headroom fürs OS/andere Apps.

---

## 5. Storage-Bedarf pro Modellklasse (grob, Q4 GGUF)

| Modellklasse | Download/Disk (grob) |
| --- | --- |
| 3B Q4 | ~2–3 GB |
| 7–8B Q4 | ~4–6 GB |
| 13B Q4 | ~7–10 GB |
| 30B+ Q4 | ~18–25 GB+ |

→ **Freien Speicher vor jedem Pull prüfen** (`df -h`); mehrere Modelle summieren sich. Ollama legt Modelle unter `~/.ollama/models` ab (`local-runtime-readiness.md`).

---

## 6. Metal / GPU-Verifikation (Konzept)

- Apple Silicon nutzt **Metal automatisch** (Ollama/llama.cpp mit Metal-Build). Verifikation über `system_profiler SPDisplaysDataType` (GPU/Metal sichtbar) und über Antwortgeschwindigkeit (Tokens/sec — in `local-function-performance-baseline.md` heute **blocked**, weil keine lokale Runtime).
- CUDA/`nvidia-smi` ist **nur** für Nicht-Apple-/Cloud-GPU relevant (`gpu-provider-decision.md`).

---

## 7. Done-Kriterien

1. Mac-Hardware **real verifiziert** (Chip, RAM, freier Speicher, GPU/Metal) via §3.
2. RAM/Storage **ausreichend** für eine konkrete Modellklasse (§4/§5).
3. Metal/GPU-Nutzung plausibel (sichtbar/Geschwindigkeit).
4. (Für PoC zusätzlich) lokale Runtime installiert (`local-runtime-readiness.md`).

---

## 8. Blocker / Nicht-Ziele

- **Blocker:** Zielhardware aus dieser Umgebung **nicht prüfbar** (Linux-Sandbox; Mac-Tools fehlen; kein Terminal-Zugriff auf den Mac).
- **Nicht-Ziele:** keine Treiber-/OS-/CUDA-/Metal-Updates, keine Runtime-/Modell-/Docker-/GPU-Installation, kein Produktcode.

---

## 9. Empfehlung

**PARTIAL / Blocked-on-local-hardware-verification.** Die reale Mac-Hardware (GPU/Metal, RAM, freier Speicher, Treiber/OS) ist **aus dieser Linux-Sandbox nicht belegbar** — es werden **keine** Werte erfunden. Belegbar ist nur: die **App** braucht **keine** GPU, und GPU-Eignung betrifft **ausschließlich** einen späteren lokalen LLM-PoC. Selbst-Verifikationsbefehle, Eignungs- und Storage-Matrix sowie Done-Kriterien sind dokumentiert. **Empfehlung: Partial**; die Hardware-Verifikation ist von **Pedi lokal** auszuführen (§3), danach lässt sich die passende Modellklasse verbindlich festlegen.

---

*Read-only Readiness-Notiz. Kein Produktcode geändert; keine Hardware-/Treiber-Änderung; Sandbox-Werte sind nicht die Zielhardware — Mac-Befunde bewusst nicht erfunden.*
