// aufnahme:20260922:gesamt-wissen-frische — was der Reiter „Erneut" aus der Server-Frische auswählt.
//   R-0206: fällige/veraltete geprüfte Objekte stehen neben den Merkern, ohne Doppel.
//   R-0266: die ältesten geprüften Beiträge der angemeldeten Person, ältester zuerst.
import { describe, expect, it } from "vitest";
import type { FrischeStufe, KnowledgeObject } from "../../apps/web/src/api/types";
import { aeltesteVorlage, faelligeKennungen } from "../../apps/web/src/lib/frische";

function ko(
  id: string,
  status: "offen" | "validiert",
  stufe: FrischeStufe | null,
  verantwortlich = "anna",
  bezugAm: string | null = "2026-05-01T00:00:00.000Z",
): KnowledgeObject {
  return {
    id,
    title: `Objekt ${id}`,
    status,
    ...(stufe
      ? {
          frische: {
            stufe,
            halbwertszeitTage: 365,
            bezugAm,
            letztesSignal: null,
            haltbarBis: null,
            erinnerungAb: null,
            erinnern: false,
            verantwortlich,
            verantwortlichArt: "owner",
            gesichert: stufe === "frisch" || stufe === "altert",
            aktuellerStand: stufe === "frisch" || stufe === "altert",
            schutz: "intern",
            betriebsmodell: "freigegebene_ki",
            inDokumente: false,
            naechsterSchritt: "keiner",
            ungeprueft: {},
          },
        }
      : {}),
  } as unknown as KnowledgeObject;
}

describe("R-0206 · fällige Kennungen", () => {
  it("Merker zuerst, dann fällige und veraltete geprüfte Objekte — keine doppelt", () => {
    const kos = [
      ko("a", "validiert", "faellig"),
      ko("b", "validiert", "veraltet"),
      ko("c", "validiert", "frisch"),
      ko("d", "offen", "veraltet"),
      ko("e", "validiert", null),
    ];
    expect(faelligeKennungen(["a", "x"], kos)).toEqual(["a", "x", "b"]);
  });

  it("GEGENPROBE: ohne fällige Objekte bleiben genau die Merker", () => {
    expect(faelligeKennungen(["x"], [ko("c", "validiert", "altert")])).toEqual(["x"]);
  });
});

describe("R-0266 · älteste Vorlage", () => {
  it("nur geprüfte Beiträge der Person, ältester Bezug zuerst, gedeckelt", () => {
    const kos = [
      ko("neu", "validiert", "frisch", "anna", "2026-09-01T00:00:00.000Z"),
      ko("alt", "validiert", "altert", "anna", "2026-01-01T00:00:00.000Z"),
      ko("fremd", "validiert", "veraltet", "bert", "2025-01-01T00:00:00.000Z"),
      ko("offen", "offen", "frisch", "anna", "2025-01-01T00:00:00.000Z"),
      ko("mitte", "validiert", "frisch", "anna", "2026-05-01T00:00:00.000Z"),
    ];
    expect(aeltesteVorlage(kos, "anna").map((k) => k.id)).toEqual(["alt", "mitte", "neu"]);
    expect(aeltesteVorlage(kos, "anna", 1).map((k) => k.id)).toEqual(["alt"]);
    expect(aeltesteVorlage(kos, "carla")).toEqual([]);
  });
});
