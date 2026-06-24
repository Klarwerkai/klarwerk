import { describe, expect, it } from "vitest";
import { displayStatus } from "./display-status";

describe("displayStatus", () => {
  it("leitet die Anzeigestufen aus Status, Zuweisungen und Flags ab", () => {
    expect(displayStatus({ status: "offen", assignments: [] })).toBe("offen");
    expect(displayStatus({ status: "offen", assignments: ["u1"] })).toBe("pruefung");
    expect(displayStatus({ status: "validiert", assignments: [] })).toBe("validiert");
    expect(displayStatus({ status: "validiert", assignments: [] }, { revalidation: true })).toBe(
      "revalidierung",
    );
    expect(displayStatus({ status: "offen", assignments: [] }, { conflict: true })).toBe("konflikt");
    expect(displayStatus({ status: "offen", assignments: [] }, { rejected: true })).toBe("abgelehnt");
  });
});
