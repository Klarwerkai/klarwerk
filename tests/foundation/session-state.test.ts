import { describe, expect, it } from "vitest";
import { SESSION_REFRESH_MS, resolveSessionUser } from "../../apps/web/src/lib/sessionState";

// SCRUM-152 / FE-FND-08: sicherer Session-Zustand, kein stale User bei Fehler.
// Lokaler Minimal-Typ statt Import aus `api/auth` (vermeidet API-Client im Node-Typecheck).
type SessionUserLike = { id: string; role: string };
const user: SessionUserLike = { id: "u1", role: "admin" };

describe("SCRUM-152: Session-State", () => {
  it("liefert den User bei erfolgreicher Abfrage", () => {
    expect(resolveSessionUser<SessionUserLike>({ data: user, isError: false })).toEqual(user);
  });

  it("ohne Daten → null", () => {
    expect(resolveSessionUser<SessionUserLike>({ data: null, isError: false })).toBeNull();
    expect(resolveSessionUser<SessionUserLike>({ isError: false })).toBeNull();
  });

  it("bei Abfragefehler (abgelaufene Session/401) → null, keine stale Daten", () => {
    // Selbst wenn React Query noch alte Daten hält, gilt der Nutzer als abgemeldet.
    expect(resolveSessionUser<SessionUserLike>({ data: user, isError: true })).toBeNull();
  });

  it("konservatives Auto-Refresh-Intervall ist gesetzt (> 0)", () => {
    expect(SESSION_REFRESH_MS).toBeGreaterThan(0);
  });
});
