## [Cloud-Worker] SCRUM-424 — Zwei KI-Backends (Cloud + eigener lokaler LLM) (03.07.2026, v0.9.36-beta)

**Anlass:** Pedi 03.07. (VIP-Vorbereitung): Beim VIP-Vortest soll die Erstanmeldung = Admin
sein, das System aber schon mit BEIDEN KIs verbunden — Claude-Cloud UND dem eigenen lokalen
LLM (Qwen3-32B-AWQ).

**Kern:** Die KI-Anbindung ist serverseitig (Env beim Start), NICHT an den Login gebunden —
damit sind beide KIs verbunden, sobald der Server mit beiden Backends hochfährt. Kein Key in
der Oberfläche; lokaler LLM nur über SSH-Tunnel auf localhost.

**Umsetzung.**
- Generischer OpenAI-kompatibler Client (`openAiCompatibleClient`, /v1/chat/completions) —
  deckt vLLM/Qwen, Ollama, llama.cpp, LM Studio ab (universal). `createLocalClientFromEnv`
  liest KLARWERK_LOCAL_LLM_URL/_MODEL/_KEY.
- Reasoner mit zweitem Provider (`secondary`) + Provider-Kette je Aufgabe. Standard „auto" =
  Cloud → lokal → deterministisch (der erste, der ohne Fehler antwortet, gewinnt; der
  deterministische Ersatz ist immer das letzte Glied). Neue Task-Wahl „cloud"/„local" neben
  „auto"/„deterministic". Der ehrliche Extract-Fehlerweg (SCRUM-411) bleibt erhalten und merkt
  sich jetzt den letzten Modellfehler über beide Modell-Tiers.
- status()/configStatus() melden „aktiv", sobald IRGENDEIN Modell verfügbar ist; neu:
  `localConfigured`, `localProvider`, `effectiveProvider` (welche KI je Aufgabe zuerst läuft).
- Admin → KI: global + je Aufgabe zwischen „Cloud (Claude)", „Lokaler LLM" (nur wenn
  verdrahtet) und „Deterministisch" umschaltbar; die Aufgaben-Badge zeigt ehrlich cloud/lokal/
  deterministisch. „Verfügbare KIs" zeigt den lokalen LLM als „bereit" (mit Modell-Label)
  statt „geplant", sobald er verdrahtet ist.
- Provisionierung: siehe docs/team2-austausch/SCRUM-424-KI-PROVISIONIERUNG.md (Env aus dem
  Schlüsselbund im Launcher; Werte NIE im Repo).

**Tests:** tests/reasoner/dual-provider.test.ts (Auto-Routing Cloud→lokal→deterministisch,
je-Aufgabe „local", configStatus, OpenAI-kompatibler Client inkl. maxTokens/Fehlerstatus,
createLocalClientFromEnv). tests/app/ai-overview.test.ts um die „bereit"-Zeile ergänzt.

**Version:** 0.9.35-beta → 0.9.36-beta. **Gates:** Paul-Runner v11 (Gesamtbestand).

> Betrieb: Nach Setzen der Env-Variablen den KLARWERK-Backend-Server NEU STARTEN.
