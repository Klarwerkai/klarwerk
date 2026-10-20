import { describe, expect, it } from "vitest";
import {
  FRISTEN_PRUEFSTAND,
  type FristenStand,
  fristManuell,
  fristVerwerfen,
  fristenRegelAus,
  verarbeiteFristenQuelle,
} from "../../services/app/src/klara-fristen";
import { type FristenQuelle, erkenneFristen } from "../../services/app/src/klara-fristen-erkennung";

const AM = "2026-10-20T09:00:00.000Z";
function quelle(
  text = "Lizenz L-17: Ablaufdatum 2027-04-30.",
  id = "original",
  fassung = "1",
  belegId = id,
): FristenQuelle {
  return { art: "wissensobjekt", id, fassung, belegId, text, verantwortlich: null };
}
function start(): FristenStand {
  return {
    kontoId: "meins",
    fassung: 1,
    fristen: [],
    regel: fristenRegelAus({
      aktiv: true,
      quellen: ["original", "kopie", "unabhaengig"].map((id) => ({ art: "wissensobjekt", id })),
      arten: ["ablauf", "erneuerung"],
      bereich: "persoenlich",
      zeitzone: "Europe/Berlin",
      aenderung: "aktualisieren",
      widerruf: "unzuverlaessig_ohne_vorlauf",
      wiederpruefung: "relevante_aenderung_klaeren",
      pruefstand: FRISTEN_PRUEFSTAND,
    }),
  };
}
function lesen(s: FristenStand, q: FristenQuelle): FristenStand {
  return verarbeiteFristenQuelle(s, q, erkenneFristen(q), AM);
}
function erste(s: FristenStand) {
  const f = s.fristen[0];
  if (!f) throw new Error("Frist fehlt");
  return f;
}

describe("AW19 · Fristvorgang, Belege und Ablehnung getrennt", () => {
  it("braucht die ausdrückliche Regel, lässt Vorschau/ungewählte Quelle wirkungslos", () => {
    const s = start();
    expect(() => lesen({ ...s, regel: null }, quelle())).toThrow(/nicht.*ausgewählt/);
    expect(() => lesen(s, quelle(undefined, "fremd"))).toThrow(/nicht.*ausgewählt/);
    expect(() => fristenRegelAus({ ...s.regel, pruefstand: "modell-ist-sicher" })).toThrow(
      /Prüfstand/,
    );
    expect(() =>
      verarbeiteFristenQuelle(s, quelle(), erkenneFristen(quelle(undefined, "kopie")), AM),
    ).toThrow(/Quellenstand/);
    expect(s.fristen).toEqual([]);
  });

  it("wiederholt wirkungslos, ergänzt unabhängige Herkunft und hält Objekt und Anlass auseinander", () => {
    const s = lesen(start(), quelle());
    expect(lesen(s, quelle())).toBe(s);
    const kopie = lesen(s, quelle(undefined, "kopie", "7", "original"));
    expect(kopie.fristen).toHaveLength(1);
    expect(erste(kopie).herkunft).toHaveLength(2);
    const mehrere = lesen(kopie, quelle(undefined, "unabhaengig"));
    expect(mehrere.fristen).toHaveLength(1);
    expect(erste(mehrere).herkunft).toHaveLength(3);
    const andere = lesen(
      mehrere,
      quelle("Lizenz L-18: Ablaufdatum 2027-04-30.\nLizenz L-17: Erneuerungstermin 2027-04-30."),
    );
    expect(andere.fristen).toHaveLength(3);
    expect(new Set(andere.fristen.map((f) => f.id)).size).toBe(3);
  });

  it("behält Ablehnung über Neuabruf, Kopie und nicht relevante neue Fassung", () => {
    let s = lesen(start(), quelle());
    s = { ...s, fristen: [fristVerwerfen(erste(s), AM)] };
    const abgelehnt = erste(s);
    s = lesen(s, quelle());
    expect(erste(s)).toEqual(abgelehnt);
    s = lesen(s, quelle(undefined, "kopie", "1", "original"));
    expect(erste(s).stand).toBe("verworfen");
    s = lesen(s, quelle(undefined, "original", "2"));
    expect(erste(s).stand).toBe("verworfen");
    expect(erste(s).ablehnungen).toHaveLength(1);
    s = lesen(s, quelle("Lizenz L-17: Ablaufdatum 2027-05-30.", "original", "3"));
    expect(erste(s).stand).toBe("klaerung");
    expect(erste(s).klaerung).toContain("relevante_quellaenderung");
  });

  it("aktualisiert denselben Vorgang nach Regel, führt den früheren Beleg samt Datum weiter", () => {
    const s = lesen(start(), quelle());
    const neu = lesen(s, quelle("Lizenz L-17: Ablaufdatum 2027-05-30.", "original", "2"));
    expect(neu.fristen).toHaveLength(1);
    expect(erste(neu)).toMatchObject({
      id: erste(s).id,
      stand: "erkannt",
      datum: { datum: "2027-05-30" },
    });
    expect(erste(neu).verlauf.map((v) => [v.grund, v.datum?.datum])).toEqual([
      ["erkannt", "2027-04-30"],
      ["quelle_geaendert", "2027-05-30"],
    ]);
    expect(erste(neu).herkunft.map((h) => h.aktuell)).toEqual([false, true]);
  });

  it("bewahrt manuelle Korrektur und kennzeichnet abweichende neue Quellenfassung", () => {
    let s = lesen(start(), quelle());
    s = {
      ...s,
      fristen: [fristManuell(erste(s), { art: "datum", datum: "2027-06-30" }, false, AM)],
    };
    s = lesen(s, quelle("Lizenz L-17: Ablaufdatum 2027-05-30.", "original", "2"));
    expect(erste(s)).toMatchObject({
      manuell: true,
      stand: "klaerung",
      datum: { datum: "2027-06-30" },
    });
    expect(erste(s).klaerung).toContain("relevante_quellaenderung");
  });

  it("klassifiziert eine manuell in die Zukunft korrigierte historische Frist nach dem manuellen Datum", () => {
    let s = lesen(start(), quelle("Lizenz L-17: Ablaufdatum 2025-04-30."));
    s = {
      ...s,
      fristen: [fristManuell(erste(s), { art: "datum", datum: "2027-06-30" }, false, AM)],
    };
    s = lesen(s, quelle("Lizenz L-17: Ablaufdatum 2025-04-30.", "original", "2"));
    expect(erste(s)).toMatchObject({
      stand: "erkannt",
      datum: { datum: "2027-06-30" },
      manuell: true,
    });
  });

  it("behandelt widersprüchliche unabhängige Belege als Klärung, unabhängig von Lesereihenfolge", () => {
    const a = quelle();
    const b = quelle("Lizenz L-17: Ablaufdatum 2027-05-30.", "unabhaengig");
    for (const [zuerst, dann] of [
      [a, b],
      [b, a],
    ]) {
      const s = lesen(lesen(start(), zuerst!), dann!);
      expect(s.fristen).toHaveLength(1);
      expect(erste(s).stand).toBe("klaerung");
      expect(erste(s).datum).toBeNull();
      expect(erste(s).klaerung).toContain("widerspruch");
    }
  });

  it("wertet ein ganztägiges Datum an der ausdrücklich gewählten Tagesgrenze aus", () => {
    const s = start();
    const q = quelle("Lizenz L-17: Ablaufdatum 2026-10-20.");
    const am = "2026-10-20T22:30:00.000Z";
    const berlin = verarbeiteFristenQuelle(s, q, erkenneFristen(q), am);
    expect(erste(berlin).stand).toBe("historisch");
    const utc = verarbeiteFristenQuelle(
      { ...s, regel: s.regel ? { ...s.regel, zeitzone: "UTC" } : null },
      q,
      erkenneFristen(q),
      am,
    );
    expect(erste(utc).stand).toBe("erkannt");
    expect(erste(berlin).datum?.datum).toBe("2026-10-20");
  });

  it("verliert beim Quellenrückzug weder Historie noch erledigte Arbeit und erfindet keine Zukunft", () => {
    let s = lesen(start(), quelle("Lizenz L-17: Ablaufdatum 2025-04-30."));
    expect(erste(s)).toMatchObject({
      stand: "historisch",
      datum: { datum: "2025-04-30" },
      verantwortlich: null,
    });
    const weg = lesen(s, quelle("Lizenz L-17 wurde zurückgezogen.", "original", "2"));
    expect(erste(weg).stand).toBe("nicht_verlaesslich");
    expect(erste(weg).herkunft[0]?.beleg.datum?.datum).toBe("2025-04-30");
    s = {
      ...s,
      fristen: [fristManuell(erste(s), { art: "datum", datum: "2025-04-30" }, true, AM)],
    };
    s = lesen(s, quelle("Lizenz L-17: Ablaufdatum 2027-05-30.", "original", "2"));
    expect(erste(s)).toMatchObject({ stand: "erledigt", datum: { datum: "2025-04-30" } });
  });
});
