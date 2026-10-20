import { describe, expect, it } from "vitest";
import { InMemoryEigenerKalenderRepo } from "../../services/app/src/eigener-kalender";
import type { SessionUser } from "../../services/app/src/http";
import {
  FRISTEN_PRUEFSTAND,
  type FristStand,
  type FristenStand,
  fristManuell,
  fristZeitstand,
  fristenRegelAus,
  verarbeiteFristenQuelle,
} from "../../services/app/src/klara-fristen";
import { InMemoryKlaraFristenRepo } from "../../services/app/src/klara-fristen-ablage";
import { KlaraFristenDienst } from "../../services/app/src/klara-fristen-dienst";
import { type FristenQuelle, erkenneFristen } from "../../services/app/src/klara-fristen-erkennung";
import { FristenKalenderRepo } from "../../services/app/src/klara-fristen-kalender";

const tag = {
  text: "Lizenz L-17: Ablaufdatum 2026-10-20.",
  vor: "2026-10-20T21:59:59.000Z",
  grenze: "2026-10-20T22:00:00.000Z",
  nach: "2026-10-20T22:30:00.000Z",
};
const zeitpunkt = {
  text: "Lizenz L-17: Ablaufdatum 2026-10-20 um 12:00 Europe/Berlin.",
  vor: "2026-10-20T09:59:59.000Z",
  grenze: "2026-10-20T10:00:00.000Z",
  nach: "2026-10-20T10:00:00.001Z",
};
function aufbau(text: string) {
  const q: FristenQuelle = {
    art: "wissensobjekt",
    id: "original",
    fassung: "1",
    belegId: "original",
    text,
    verantwortlich: null,
  };
  const regel = fristenRegelAus({
    aktiv: true,
    quellen: [{ art: q.art, id: q.id }],
    arten: ["ablauf"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "aktualisieren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: FRISTEN_PRUEFSTAND,
  });
  const leer: FristenStand = { kontoId: "meins", fassung: 0, regel, fristen: [] };
  return {
    q,
    leer,
    lesen: (s: FristenStand, am: string) => verarbeiteFristenQuelle(s, q, erkenneFristen(q), am),
  };
}

describe("F7-1 · Zeitstatus ohne geänderte Quelle", () => {
  it.each([tag, zeitpunkt])("aktualisiert nur beim wirklichen Grenzwechsel: $text", (fall) => {
    const a = aufbau(fall.text);
    const vorher = a.lesen(a.leer, fall.vor);
    const f = vorher.fristen[0]!;
    expect(f.stand).toBe("erkannt");
    expect(a.lesen(vorher, fall.vor)).toBe(vorher);
    const anGrenze = a.lesen(vorher, fall.grenze);
    expect(anGrenze.fristen[0]!.stand).toBe(fall === tag ? "historisch" : "erkannt");
    const nachher = a.lesen(vorher, fall.nach);
    expect(nachher.fristen[0]).toMatchObject({
      id: f.id,
      datum: f.datum,
      stand: "historisch",
      fassung: f.fassung + 1,
      herkunft: f.herkunft,
    });
    expect(nachher.fristen[0]!.verlauf.at(-1)?.grund).toBe("zeitgrenze");
    expect(a.lesen(nachher, fall.nach)).toBe(nachher);
  });

  it.each([tag, zeitpunkt])(
    "verwendet die manuelle Fälligkeit beim späteren Neuabruf: $text",
    (fall) => {
      const a = aufbau("Lizenz L-17: Ablaufdatum 2027-04-30.");
      const b = aufbau(fall.text);
      const datum = b.lesen(b.leer, fall.vor).fristen[0]!.datum!;
      const s = a.lesen(a.leer, fall.vor);
      const manuell = { ...s, fristen: [fristManuell(s.fristen[0]!, datum, false, fall.vor)] };
      expect(a.lesen(manuell, fall.vor)).toBe(manuell);
      const neu = a.lesen(manuell, fall.nach);
      expect(neu.fristen[0]).toMatchObject({ datum, manuell: true, stand: "historisch" });
      expect(a.lesen(neu, fall.nach)).toBe(neu);
    },
  );

  it("verändert weder terminale noch ungeklärte Zustände durch bloßen Zeitablauf", () => {
    const a = aufbau(tag.text);
    const s = a.lesen(a.leer, tag.vor);
    for (const stand of [
      "erledigt",
      "verworfen",
      "klaerung",
      "nicht_verlaesslich",
    ] as FristStand[]) {
      const f = { ...s.fristen[0]!, stand, manuell: true, klaerung: ["widerspruch"] };
      expect(fristZeitstand(f, tag.nach, "Europe/Berlin")).toBe(f);
      expect(a.lesen({ ...s, fristen: [f] }, tag.nach).fristen[0]).toEqual(f);
    }
  });

  it.each([tag, zeitpunkt])(
    "Dienst und dieselbe Kalenderprojektion lesen aktuell, Refresh speichert einmal: $text",
    async (fall) => {
      const a = aufbau(fall.text);
      let jetzt = Date.parse(fall.vor);
      const repo = new InMemoryKlaraFristenRepo();
      const user: SessionUser = { id: "meins", role: "experte" };
      const dienst = new KlaraFristenDienst({
        repo,
        jetzt: () => jetzt,
        lies: async () => ({
          quelle: a.q,
          nochAktuell: async () => true,
          bedingung: { gilt: () => true },
        }),
      });
      const kalender = new FristenKalenderRepo(
        new InMemoryEigenerKalenderRepo(),
        repo,
        () => jetzt,
      );
      const start = await dienst.konfigurieren(user, a.leer.regel, 0);
      const fassung = start.fristen[0]!.fassung;
      const event = (await kalender.persoenliche(user.id))[0]!;
      expect(event.erkennung?.stand).toBe("erkannt");
      jetzt = Date.parse(fall.nach);
      const gelesen = await dienst.sicht(user);
      expect(gelesen.fristen[0]).toMatchObject({ stand: "historisch", fassung });
      expect((await kalender.hole(event.id))?.erkennung?.stand).toBe("historisch");
      expect((await kalender.persoenliche(user.id))[0]!.erkennung?.stand).toBe("historisch");
      expect((await repo.hole(user.id))!.fristen[0]!.stand).toBe("erkannt");
      const gespeichert = await dienst.aktualisieren(user);
      expect(gespeichert.fristen[0]).toMatchObject({ stand: "historisch", fassung: fassung + 1 });
      expect(gespeichert.fassung).toBe(start.fassung + 1);
      expect(await dienst.aktualisieren(user)).toEqual(gespeichert);
      expect((await kalender.hole(event.id))?.id).toBe(event.id);
    },
  );
});
