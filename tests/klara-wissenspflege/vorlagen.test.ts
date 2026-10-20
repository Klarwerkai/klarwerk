import { describe, expect, it } from "vitest";
import {
  type PflegeLeser,
  type PflegeQuelle,
  bereiteWissenspflegeVor,
  pflegeAus,
  pflegeAusgangsstand,
  pflegeVorgang,
} from "../../services/app/src/klara-wissenspflege";

const AM = "2026-10-20T09:00:00.000Z";
const SPAETER = "2026-10-27T09:00:00.000Z";
function quelle(fassung = 1): PflegeQuelle {
  return {
    id: "ko-1",
    fassung,
    titel: "Synthetische Anleitung A-4",
    aussage: "Nur fiktive Prüfunterlage.",
    offenePruefung: { stand: 3, seit: AM },
    frische: { stufe: "faellig", bezugAm: AM, haltbarBis: AM, konflikt: "nicht_erhoben" },
  };
}
function leser(q: PflegeQuelle | null): PflegeLeser {
  return {
    lies: async () => (q ? { quelle: q, bedingung: {}, nochAktuell: async () => true } : null),
  };
}

describe("AW20 · ausdrückliche begrenzte Wissenspflegevorlagen", () => {
  it("erweitert weder Empfänger noch Quelle oder operative Befugnis und übernimmt keinen behaupteten Vorstand", () => {
    for (const extra of [
      { empfaenger: "fremdes-konto" },
      { erlaubteArbeit: "wartung_durchfuehren" },
      { webhookUrl: "https://example.invalid" },
    ])
      expect(() => pflegeAus({ vorlage: "quellaenderung", quellen: ["ko-1"], ...extra })).toThrow();
    const p = pflegeAus({
      vorlage: "quellaenderung",
      quellen: ["ko-1"],
      ausgangsstand: [{ id: "ko-1", fassung: 999 }],
    });
    expect(p.ausgangsstand).toEqual([]);
    expect(p.ausloeser).toBe("quellstand_polling");
  });

  it("Zeitablauf alleine ist keine neue Quellfassung oder Quelle von Doppelmeldungen", async () => {
    const p = await pflegeAusgangsstand(
      pflegeAus({ vorlage: "quellaenderung", quellen: ["ko-1"] }),
      "ich",
      leser(quelle()),
    );
    const erst = await bereiteWissenspflegeVor(p, "ich", leser(quelle()), AM, null);
    const wieder = await bereiteWissenspflegeVor(p, "ich", leser(quelle()), SPAETER, erst.ergebnis);
    expect(erst.ergebnis.stand).toBe("ohne_quellaenderung");
    expect(wieder.ergebnis).toMatchObject({ stand: "ohne_quellaenderung", aenderung: null });
    expect(wieder.ergebnis.quellen[0]?.letzteErfolgreichePruefung).toBe(SPAETER);
    const neu = await bereiteWissenspflegeVor(p, "ich", leser(quelle(2)), SPAETER, wieder.ergebnis);
    const doppelt = await bereiteWissenspflegeVor(
      p,
      "ich",
      leser(quelle(2)),
      SPAETER,
      neu.ergebnis,
    );
    expect(neu.ergebnis.aenderung).toBeTruthy();
    expect(pflegeVorgang("auftrag", 1, "termin-1", neu.ergebnis)).toBe(
      pflegeVorgang("auftrag", 1, "termin-2", doppelt.ergebnis),
    );
    const andererStand = await bereiteWissenspflegeVor(
      p,
      "ich",
      leser(quelle(3)),
      SPAETER,
      neu.ergebnis,
    );
    expect(andererStand.ergebnis.aenderung).not.toBe(neu.ergebnis.aenderung);
  });

  it("unlesbar bleibt ungeprüft und erhält nur den letzten tatsächlichen erfolgreichen Prüfzeitpunkt", async () => {
    const p = pflegeAus({ vorlage: "aktualitaet", quellen: ["ko-1"] });
    const gut = await bereiteWissenspflegeVor(p, "ich", leser(quelle()), AM, null);
    const fehlt = await bereiteWissenspflegeVor(p, "ich", leser(null), SPAETER, gut.ergebnis);
    expect(fehlt.ergebnis).toMatchObject({
      stand: "ungeprueft",
      geprueftAm: SPAETER,
      aenderung: null,
    });
    expect(fehlt.ergebnis.quellen[0]).toEqual({
      id: "ko-1",
      fassung: null,
      stand: "ungeprueft",
      letzteErfolgreichePruefung: AM,
    });
    expect(fehlt.inhalt).toContain("Kein Nullbefund");
    expect(fehlt.inhalt).not.toContain("Synthetische Anleitung A-4");
  });

  it.each(["offene_pruefungen", "aktualitaet", "quellaenderung"] as const)(
    "%s erzeugt begrenzte belegte Unterlagen, keine fachliche Ausführung",
    async (vorlage) => {
      const p = await pflegeAusgangsstand(
        pflegeAus({ vorlage, quellen: ["ko-1"] }),
        "ich",
        leser(quelle()),
      );
      const e = await bereiteWissenspflegeVor(p, "ich", leser(quelle(2)), AM, null);
      expect(e.ergebnis.stand).toBe("vorbereitet");
      expect(e.inhalt).toContain("[wissensobjekt ko-1, Fassung 2]");
      expect(e.inhalt).toContain("Dies bestätigt keine fachliche Gültigkeit");
      expect(e.inhalt).toContain("Konflikte und vollständige Dokumenttexte wurden");
      if (vorlage === "offene_pruefungen")
        expect(e.inhalt).toContain("Offene Folgeprüfung, Stand 3");
      if (vorlage === "aktualitaet") expect(e.inhalt).toContain("Klarwerk-Frische: faellig");
      if (vorlage === "quellaenderung") expect(e.inhalt).toContain("Ausgangsstand 1");
    },
  );

  it("zwanzig große Originalquellen bleiben als ausdrücklich begrenzte Auszüge speicherbar", async () => {
    const ids = Array.from({ length: 20 }, (_, i) => `ko-${i}-${"x".repeat(190)}`);
    const gross: PflegeLeser = {
      lies: async (_konto, id) => ({
        quelle: { ...quelle(), id, titel: "😀".repeat(1000), aussage: "😀".repeat(10000) },
        bedingung: {},
        nochAktuell: async () => true,
      }),
    };
    const e = await bereiteWissenspflegeVor(
      pflegeAus({ vorlage: "aktualitaet", quellen: ids }),
      "ich",
      gross,
      AM,
      null,
    );
    expect(e.inhalt.length).toBeLessThanOrEqual(20000);
    expect(e.inhalt).toContain("begrenzte Auszüge");
    expect(e.inhalt.match(/Auszug aus der gelesenen Kernaussage:/g)).toHaveLength(20);
    expect(e.inhalt).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    for (const id of ids) expect(e.inhalt).toContain(`[wissensobjekt ${id}, Fassung 1]`);
  });
});
