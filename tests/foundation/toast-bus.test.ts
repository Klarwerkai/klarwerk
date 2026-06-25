import { describe, expect, it } from "vitest";
import {
  EMPTY_TOASTS,
  MAX_TOASTS,
  type Toast,
  addToast,
  removeToast,
} from "../../apps/web/src/lib/toastBus";

const mk = (id: string): Toast => ({ id, kind: "info", message: `m-${id}` });

describe("SCRUM-151: Toast-Bus", () => {
  it("fügt Toasts an", () => {
    const s = addToast(EMPTY_TOASTS, mk("1"));
    expect(s.toasts).toHaveLength(1);
    expect(s.toasts[0]?.id).toBe("1");
  });

  it("entfernt Toasts per id", () => {
    let s = addToast(EMPTY_TOASTS, mk("1"));
    s = addToast(s, mk("2"));
    s = removeToast(s, "1");
    expect(s.toasts.map((t) => t.id)).toEqual(["2"]);
  });

  it("kappt auf MAX_TOASTS (älteste fallen raus)", () => {
    let s = EMPTY_TOASTS;
    for (let i = 0; i < MAX_TOASTS + 3; i++) {
      s = addToast(s, mk(String(i)));
    }
    expect(s.toasts).toHaveLength(MAX_TOASTS);
    expect(s.toasts[0]?.id).toBe(String(3)); // 0..2 herausgefallen
  });

  it("behält Kind/Message korrekt", () => {
    const s = addToast(EMPTY_TOASTS, { id: "x", kind: "error", message: "Fehler" });
    expect(s.toasts[0]).toEqual({ id: "x", kind: "error", message: "Fehler" });
  });
});
