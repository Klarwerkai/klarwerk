## [Cloud-Worker] SCRUM-443 — RBAC-Härtung (canChangeRole + Last-Admin-Schutz) (03.07.2026, v0.9.46-beta)

Berater-Audit-Befund (docs/qm/BERATER_AUDIT_2026-07-03.md), am Code verifiziert: `canChangeRole`
(FR-RBAC-03) war definiert, wurde aber NIRGENDS aufgerufen — `changeRole` setzte Rollen ungeprüft,
und es gab keinen Last-Admin-Schutz. Ein Admin konnte sich selbst entrechten, der letzte Admin
konnte herabgestuft/gelöscht werden → System ausgesperrt. Kritisch, weil der VIP per Erstanmeldung
Admin wird.

### Fix (Backend)
1. **`changeRole` erzwingt jetzt serverseitig FR-RBAC-03.** Die echte `rbac.canChangeRole` wird in
   den `AuthService` **injiziert** (build-app), weil `auth` `rbac` nicht direkt importieren darf
   (`rbac` hängt von `auth` ab → Zyklus). Ohne Wiring greift ein Default, der denselben
   Selbst-Entzug-Schutz durchsetzt — die Regel ist damit nie mehr umgehbar.
2. **Last-Admin-Schutz:** der letzte freigegebene Admin kann weder herabgestuft (`changeRole`) noch
   gelöscht (`deleteUser`, beide Routen) werden — ehrlicher `403 FORBIDDEN` mit klarer Meldung.
   Der Text erscheint dem Admin als Fehler-Toast (kein stilles Scheitern).
3. **Normale Rollenwechsel bleiben unberührt** (anderer Nutzer, oder Admin-Herabstufung solange ein
   zweiter aktiver Admin existiert).

### Tests
- `services/auth/src/service.test.ts` (Unit): letzter Admin Selbst-Herabstufung → FORBIDDEN;
  letzter Admin Löschen → FORBIDDEN; normaler Rollenwechsel möglich; mit zweitem Admin ist die
  Herabstufung eines (nicht letzten) Admins möglich; Selbst-Entzug bleibt auch mit zweitem Admin blockiert.
- `tests/app/rbac-last-admin-e2e.test.ts` (verdrahtet, echte Routen + injizierte canChangeRole):
  Selbst-Herabstufung 403; Löschen letzter Admin 403; Guard-Matrix (Experte 403); Rollenwechsel
  für andere Nutzer 200.

### Geändert
- `services/auth/src/service.ts` — `RoleChangePolicy` (injizierbar) + Default; `changeRole`/`deleteUser`
  mit Durchsetzung + Last-Admin-Prüfung (`isLastApprovedAdmin`).
- `services/app/src/build-app.ts` — `rbac.canChangeRole` in den AuthService injiziert.
- `services/auth/src/service.test.ts`, `tests/app/rbac-last-admin-e2e.test.ts` — Tests.
- `apps/web/src/version.ts` — 0.9.45 → 0.9.46-beta (Build-Marker).

**Version:** 0.9.45-beta → 0.9.46-beta.
**ACHTUNG:** Backend-Änderung — nach dem Sync **voller Server-Neustart** nötig (Browser-Reload genügt NICHT).
**Gates:** Paul-Runner v22 (Gesamtbestand).
