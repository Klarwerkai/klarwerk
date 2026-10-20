import { describe, expect, it } from "vitest";
import {
  isoZuProfilzeit,
  profilzeitProblem,
  profilzeitZuIso,
} from "../../apps/web/src/lib/kalenderProfilzeit";
import {
  AssistenzProfilDienst,
  InMemoryAssistenzProfilRepo,
} from "../../services/app/src/assistenz-profil";
const einrichtung = {
  schritt: 2,
  begleitung: "ausfuehrlich",
  zeitzone: "America/New_York",
  abgeschlossen: false,
};
describe("Klara16 · bestehendes Profil und vorhandener DST-Löser", () => {
  it("speichert Fortsetzung am bestehenden Profil, bewahrt Gestaltung/andere Einstellungen und Kontoabgrenzung", async () => {
    const repo = new InMemoryAssistenzProfilRepo();
    const d = new AssistenzProfilDienst({ repo });
    const p = await d.aendere("anna", {
      fassung: 0,
      name: "Ada",
      avatar: "eule",
      bildAutomatik: false,
      einfuehrung: einrichtung,
    });
    const weiter = await d.aendere("anna", { fassung: p.fassung, bewegung: "reduziert" });
    expect(weiter).toMatchObject({
      name: "Ada",
      avatar: "eule",
      bildAutomatik: false,
      bewegung: "reduziert",
      einfuehrung: einrichtung,
    });
    expect(await new AssistenzProfilDienst({ repo }).hole("bert")).toBe(null);
    expect((await d.hole("anna"))?.einfuehrung).toEqual(einrichtung);
    await expect(
      d.aendere("anna", { fassung: p.fassung, einfuehrung: { ...einrichtung, schritt: 3 } }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("weist unbekannte Zonen und inkonsistente Abschluss-/Schrittwerte ab, ohne den Bestand zu ändern", async () => {
    const d = new AssistenzProfilDienst({ repo: new InMemoryAssistenzProfilRepo() });
    for (const e of [
      { ...einrichtung, zeitzone: "falsche/Zone" },
      { ...einrichtung, schritt: 99 },
      { ...einrichtung, schritt: 1, abgeschlossen: true },
      { ...einrichtung, begleitung: "automatisch" },
    ])
      await expect(d.aendere("anna", { fassung: 0, einfuehrung: e })).rejects.toMatchObject({
        status: 400,
        grund: "einfuehrung",
      });
    expect(await d.hole("anna")).toBe(null);
  });
  it("rechnet die gewählte Profilzone auf beiden Seiten der Berliner und New Yorker DST-Wechsel", () => {
    expect(profilzeitZuIso("2026-10-24T09:00", "Europe/Berlin")).toBe("2026-10-24T07:00:00.000Z");
    expect(profilzeitZuIso("2026-10-26T09:00", "Europe/Berlin")).toBe("2026-10-26T08:00:00.000Z");
    expect(profilzeitZuIso("2026-10-26T09:00", "America/New_York")).toBe(
      "2026-10-26T13:00:00.000Z",
    );
    expect(profilzeitZuIso("2026-11-02T09:00", "America/New_York")).toBe(
      "2026-11-02T14:00:00.000Z",
    );
    expect(isoZuProfilzeit("2026-11-02T14:00:00.000Z", "America/New_York")).toBe(
      "2026-11-02T09:00",
    );
    expect(isoZuProfilzeit("2026-11-02T14:00:00.000Z", "Europe/Berlin")).toBe("2026-11-02T15:00");
  });
  it("löst fehlende/doppelte Ortszeit nicht still auf und erhält die ganztägige Datumsabgrenzung", () => {
    expect(profilzeitProblem("2026-03-29T02:30", "Europe/Berlin")).toBe("luecke");
    expect(profilzeitZuIso("2026-03-29T02:30", "Europe/Berlin")).toBe(null);
    expect(profilzeitProblem("2026-10-25T02:30", "Europe/Berlin")).toBe("doppelt");
    expect(profilzeitZuIso("2026-10-25T02:30", "Europe/Berlin")).toBe(null);
    expect(profilzeitZuIso("2026-10-25", "Europe/Berlin")).toBe(null);
  });
});
