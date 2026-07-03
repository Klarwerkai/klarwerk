import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KI_STATE_KEY,
  type StorageLike,
  isAdminFirstRun,
  kiConnectionState,
  kiStateTone,
  markAdminFirstRunSeen,
} from "../../apps/web/src/lib/adminFirstRun";

// SCRUM-429 (Pedi 03.07., VIP): Erststart-Führung — Persistenz + ehrlicher KI-Zustand testbar.
describe("SCRUM-429: Admin-Erststart", () => {
  function fakeStorage(initial: Record<string, string> = {}): StorageLike & {
    dump: () => Record<string, string>;
  } {
    const map = new Map<string, string>(Object.entries(initial));
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => {
        map.set(k, v);
      },
      dump: () => Object.fromEntries(map),
    };
  }

  it("ist Erststart, solange der Merker fehlt — danach dauerhaft still", () => {
    const s = fakeStorage();
    expect(isAdminFirstRun(s)).toBe(true);
    markAdminFirstRunSeen(s, "2026-07-03T20:00:00.000Z");
    expect(isAdminFirstRun(s)).toBe(false);
    expect(Object.values(s.dump())[0]).toBe("2026-07-03T20:00:00.000Z");
  });

  it("leitet den KI-Zustand ehrlich aus der echten Config ab", () => {
    expect(kiConnectionState(true, true)).toBe("both");
    expect(kiConnectionState(true, false)).toBe("cloudOnly");
    expect(kiConnectionState(false, true)).toBe("localOnly");
    expect(kiConnectionState(false, false)).toBe("none");
  });

  it("Ampel: both=ok, none=crit, Teilzustände=warn", () => {
    expect(kiStateTone("both")).toBe("ok");
    expect(kiStateTone("none")).toBe("crit");
    expect(kiStateTone("cloudOnly")).toBe("warn");
    expect(kiStateTone("localOnly")).toBe("warn");
  });

  it("jeder KI-Zustand hat ein aufgelöstes DE- und EN-Label", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of Object.values(KI_STATE_KEY)) {
        const label = i18n.t(key);
        expect(label).not.toBe(key);
        expect(label.length).toBeGreaterThan(0);
      }
    }
  });
});
