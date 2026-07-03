## [Cloud-Worker] FREEZE v1.0.0-beta.1 — Versionssprung (Generalprobe + VIP-Termin) (03.07.2026)

Stand einfrieren für die Generalprobe und den VIP-Termin am 05.07. Kein neuer Code, keine neuen
Features — nur der Versionsstempel wird gesetzt; ab dem Tag `v1.0.0-beta.1` gilt: nur noch Fixes.

### Geändert
- `apps/web/src/version.ts` — APP_VERSION `0.9.47-beta` → `1.0.0-beta.1`.
- `docs/team2-austausch/VIP-VORTEST-LEITFADEN-0507.md` — Versionsangaben auf den Freeze-Stand.
- `docs/team2-austausch/paul-runner.sh` — Runner v24 (Freeze), Commit- + Tag-Empfehlung.

### Im Freeze enthalten (alles In Review, gegatet)
Kern (Erfassen · Validieren · Fragen · Audit) plus die VIP-Vorbereitung dieser Session:
- SCRUM-443 RBAC-Härtung (Last-Admin-Schutz, canChangeRole serverseitig durchgesetzt) — **Backend**.
- SCRUM-444 Evidenz-Kennzeichnung (Markenkern „Vertrauen ist Evidenz") auf dem Druckauszug + Leitfaden.
- SCRUM-437/440/441 VIP-Bereitschaft, druckbarer Vertrauen-&-Sicherheit-Auszug, Erststart-Häkchen.
- SCRUM-429/432 Onboarding-Politur + Vertrauen-&-Sicherheit-Bereich.
- SCRUM-433/434 Auffindbarkeit (Erkenntnisse verbinden, Public-KI) + PMO-Automatik.
- Gesamtbestand 395/414/416/413/417–428 (u. a. zwei KI-Backends, Upload-Grenzen, robuste Extraktion).

### Nach dem Freeze-Sync (Pedi)
1. Boss committet den Versionssprung und setzt `git tag v1.0.0-beta.1`.
2. KLARWERK Sync.
3. **Einmalig** noch ein voller Server-Neustart (aktiviert den SCRUM-443-Backend-Stand);
   danach genügt bei reinen Frontend-Ständen ein Browser-Reload.

### Nach dem Termin (bereit, ticketisiert)
Backend-/PMO-Bündel SCRUM-439/438/436/442 sowie der reguläre Backlog 435/431/430/415/423/393.

**Version:** 0.9.47-beta → **1.0.0-beta.1** (Freeze).
**Gates:** Paul-Runner v24 (gesamter Freeze-Kandidat).
