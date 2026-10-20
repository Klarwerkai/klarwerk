import { describe, expect, it } from "vitest";
import type { FristenQuelle } from "../../services/app/src/klara-fristen-erkennung";
import {
  erkenneNormBekanntmachung,
  normHatWiderspruch,
  normKlaerung,
  normQuellstand,
  vereinigeNormgeschichten,
} from "../../services/app/src/klara-normereignisse";

const AM = "2026-10-20T12:00:00.000Z";
const q = (text: string, id = "synthetische-bekanntmachung", fassung = "1"): FristenQuelle => ({
  art: "notiz",
  id,
  fassung,
  belegId: `notiz:${id}`,
  text,
  verantwortlich: null,
});
const lesen = (text: string) => erkenneNormBekanntmachung(q(text), true, AM);
describe("AW21 · getrennte belegte Normereignisse", () => {
  it("S10 N-17 v2 beginnt ausschließlich angekündigt und erfindet weder Inkrafttreten noch fachliche Ablösung", () => {
    const r = lesen("Norm N-17 v2: Ankündigung am 2026-11-01; Geltung: Werk A.");
    expect(r.geschichten).toHaveLength(1);
    const n = r.geschichten[0];
    expect(n?.ereignisse.map((e) => e.art)).toEqual(["angekuendigt"]);
    expect(n?.annahmen).toEqual([]);
    expect(n && normKlaerung(n)).toContain("inkrafttreten: eigener Beleg fehlt.");
  });
  it("vier Ereignisse tragen gesonderte Datumsbelege mit exakten Originaloffsets", () => {
    const quelle = q(
      "Norm N-17 v2: Ankündigung am 2026-10-01; Veröffentlichung am 2026-11-01; Inkrafttreten am 2027-01-01; Übergangsfrist bis 2027-06-30; Geltung: Werk A.",
    );
    const n = erkenneNormBekanntmachung(quelle, true, AM).geschichten[0];
    expect(n?.ereignisse.map((e) => e.datum)).toEqual([
      "2026-10-01",
      "2026-11-01",
      "2027-01-01",
      "2027-06-30",
    ]);
    expect(n && normKlaerung(n)).toEqual([]);
    for (const e of n?.ereignisse ?? [])
      for (const b of e.belege) {
        for (const f of [b.norm, b.ereignis, b.geltung])
          if (f) expect(quelle.text.slice(f.von, f.bis)).toBe(f.wortlaut);
      }
    expect(new Set(n?.ereignisse.flatMap((e) => e.belege.map((b) => b.id))).size).toBe(4);
  });
  it("Kopie und Wiederholung behalten dieselbe Norm-, Ereignis- und Prüfkennung; neue Veröffentlichung ergänzt ihre Geschichte", () => {
    const text = "Norm N-17 v2: angekündigt am 2026-11-01; Geltung: Werk A.";
    const a = lesen(text).geschichten;
    const kopie = erkenneNormBekanntmachung(q(text, "kopie"), true, AM).geschichten;
    const b = vereinigeNormgeschichten(vereinigeNormgeschichten(a, a), kopie);
    expect(b).toHaveLength(1);
    expect(b[0]?.ereignisse).toHaveLength(1);
    expect(b[0]?.ereignisse[0]?.belege).toHaveLength(2);
    expect(b[0]?.ereignisse[0]?.pruefVorgang).toBe(a[0]?.ereignisse[0]?.pruefVorgang);
    const c = vereinigeNormgeschichten(
      b,
      lesen("Norm N-17 v2: veröffentlicht am 2026-12-01; Geltung: Werk A.").geschichten,
    );
    expect(c[0]?.id).toBe(a[0]?.id);
    expect(c[0]?.ereignisse).toHaveLength(2);
  });
  it("ein jüngerer gegensätzlicher Termin oder Geltungsbereich gewinnt nicht automatisch", () => {
    const a = lesen("Norm N-17 v2: Inkrafttreten am 2027-01-01; Geltung: Werk A.").geschichten;
    const b = lesen("Norm N-17 v2: Inkrafttreten am 2027-02-01; Geltung: Werk B.").geschichten;
    const n = vereinigeNormgeschichten(a, b)[0];
    expect(n?.ereignisse).toHaveLength(2);
    expect(n && normKlaerung(n)).toContain(
      "inkrafttreten: Termine widersprechen sich; fachlich klären.",
    );
    expect(n && normKlaerung(n)).toContain(
      "inkrafttreten: unterschiedliche Geltungsbereiche; Zuordnung klären.",
    );
  });
  it.each([
    "Veröffentlichung noch nicht bekannt",
    "nicht veröffentlicht am 2026-11-01",
    "Veröffentlichung voraussichtlich am 2026-11-01",
    "Veröffentlichung am 2026-02-30",
  ])("%s bleibt offen", (s) => {
    const n = lesen(`Norm N-17 v2: ${s}; Geltung: Werk A.`).geschichten[0];
    expect(n?.ereignisse[0]?.datum).toBeNull();
    expect(n?.ereignisse[0]?.belege[0]?.klaerung.length).toBeGreaterThan(0);
  });
  it("fehlendes Recht und zu großer möglicher Volltext werden vor jeder Erkennung abgewiesen", () => {
    const quelle = q("Norm N-17 v2: veröffentlicht am 2026-11-01; Geltung: Werk A.");
    expect(erkenneNormBekanntmachung(quelle, false, AM).geschichten).toEqual([]);
    const gross = erkenneNormBekanntmachung(q(quelle.text + "x".repeat(4000)), true, AM);
    expect(gross.geschichten).toEqual([]);
    expect(gross.ungeprueft.join()).toContain("kein Volltext verarbeitet");
  });
  it("geänderter Quellstand erhält frühere Belege historisch, statt sie still weiter als aktuell auszugeben", () => {
    const n = lesen("Norm N-17 v2: angekündigt am 2026-11-01; Geltung: Werk A.").geschichten;
    const neu = normQuellstand(n, q("Geänderter Text", "synthetische-bekanntmachung", "2"));
    expect(neu[0]?.ereignisse[0]?.belege[0]?.aktuell).toBe(false);
    expect(n[0]?.ereignisse[0]?.belege[0]?.aktuell).toBe(true);
  });
  it("zwei Geltungsangaben bleiben ungeklärt und eine vorangestellte eindeutige Geltung ist belegt", () => {
    const unklar = lesen(
      "Norm N-17 v2: veröffentlicht am 2026-11-01; Geltung: Werk A; Geltung: Werk B.",
    ).geschichten[0];
    expect(unklar?.ereignisse[0]?.geltung).toBeNull();
    expect(unklar?.ereignisse[0]?.belege[0]?.klaerung.join()).toContain("Mehrere Geltungsangaben");
    const klar = lesen("Norm N-17 v2; Geltung: Werk A; Inkrafttreten am 01.02.2027.")
      .geschichten[0];
    expect(klar?.ereignisse[0]).toMatchObject({
      art: "inkrafttreten",
      datum: "2027-02-01",
      geltung: "Werk A",
    });
  });
  it("eine zurückgezogene Veröffentlichung wird nicht als bestätigtes Ereignis ausgegeben", () => {
    const n = lesen("Norm N-17 v2: Veröffentlichung am 2026-11-01 zurückgezogen; Geltung: Werk A.")
      .geschichten[0];
    expect(n?.ereignisse[0]?.datum).toBeNull();
    expect(n?.ereignisse[0]?.belege[0]?.klaerung.join()).toContain("unbestätigt");
  });
  it("zwei Termine innerhalb eines einzelnen Ereignisbelegs sperren ebenfalls die fachliche Annahme", () => {
    const n = lesen("Norm N-17 v2: Inkrafttreten am 2027-01-01 oder 2027-02-01; Geltung: Werk A.")
      .geschichten[0];
    expect(n?.ereignisse[0]?.datum).toBeNull();
    expect(n && normHatWiderspruch(n)).toBe(true);
  });
  it("ein geänderter Termin derselben Quelle gewinnt nicht allein durch die neuere Quellfassung", () => {
    const a = q("Norm N-17 v2: Inkrafttreten am 2027-01-01; Geltung: Werk A.");
    const b = q("Norm N-17 v2: Inkrafttreten am 2027-02-01; Geltung: Werk A.", a.id, "2");
    const alt = erkenneNormBekanntmachung(a, true, AM).geschichten;
    const n = vereinigeNormgeschichten(
      normQuellstand(alt, b),
      erkenneNormBekanntmachung(b, true, AM).geschichten,
    )[0];
    expect(n?.ereignisse).toHaveLength(2);
    expect(n && normHatWiderspruch(n)).toBe(true);
    expect(n && normKlaerung(n)).toContain(
      "inkrafttreten: Termine widersprechen sich; fachlich klären.",
    );
  });
});
