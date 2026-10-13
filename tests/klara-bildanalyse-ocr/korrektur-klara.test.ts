// ================================================================================================
// OCR-E02 · DIE BERICHTIGUNG WIRKT IN KLARAS KONTEXT — gebunden an Quelle und Bildfassung.
// ================================================================================================
//
// Auftrag produkt:20261012:klara-ocr-fundstellen-korrekturen, Kriterien K5, K6, K7, K8 (mit K10/K11).
//
// Kontrollierte Fixtures: ein Bild mit ABSICHTLICHEM Erkennungsfehler („Mül1er“, „LAGFR“), eine
// echte PPTX-Importkette mit zwei Folien. Die Analyse (`createBildAnalyse`), die Berichtigung
// (`lib/bildKorrektur.ts`) und Klaras Kontext (`lib/klaraBildKontext.ts`) sind echt; ersetzt ist nur
// die Engine. Der gemountete Weg bis zur Anfrage an Klara steht in
// `fundstelle-korrektur-mounted.test.tsx`, der Server in `korrekturen-am-server.test.ts`.
//
//   B1  K5 — die berichtigte Fassung steht in Klaras Kontext (Frage UND Zusammenfassung), als
//       berichtigt gekennzeichnet; der Rohbefund nicht. Die Fundstellen einer Frage tragen sie.
//   B2  K6 — erneutes Lesen derselben Bildfassung (auch ausdrücklich „neu“) überschreibt nichts.
//   B3  K7 — ohne Berichtigung (zurückgesetzt) gilt wieder der Rohbefund; er war nie verändert.
//   B4  K8 — andere Quelle, anderes Bild, verändertes Bild: keine Übertragung; ein verändertes
//       Bild an derselben Stelle wird als solches erkannt.
import { describe, expect, it } from "vitest";
import {
  type BildBefund,
  type QuellenBefund,
  createBildAnalyse,
  einzelbildEingang,
  pptxBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import {
  type BildKorrekturDaten,
  andereFassungBerichtigt,
  befundMitKorrektur,
  korrekturFingerabdruck,
  korrekturQuelleFuer,
  ortKennung,
  quellenMitKorrekturen,
} from "../../apps/web/src/lib/bildKorrektur";
import {
  belegstellen,
  klaraAnweisung,
  klaraBildKontext,
} from "../../apps/web/src/lib/klaraBildKontext";
import type { OcrResult } from "../../apps/web/src/lib/ocr";
import { bildMitMassen, dataUrl, deck, lesePptx, markeAus } from "./deck";

/** Übersetzung als Schlüssel (mit Werten) — so ist im Kontext sichtbar, welcher Satz steht. */
const t = (k: string, w?: Record<string, string | number>): string =>
  w && Object.keys(w).length > 0 ? `${k}${JSON.stringify(w)}` : k;
const ortVon = (f: BildBefund["fundstelle"]): string =>
  f.folie !== undefined ? `Folie ${f.folie}, Bild ${f.bildAufFolie ?? 1}` : `Bild ${f.bild}`;

/** Die Engine liest „falsch“: so steht es im kontrollierten Bild (absichtlicher Fehler). */
const ROH: Record<string, string> = {
  M: "Herr Mül1er zahlt 4.250 EUR",
  L: "LAGFR 29",
  W: "WARTUNG 12.10.2026",
  N: "LAGFR 30",
};
const engine = async (src: string): Promise<OcrResult> => ({
  status: "success",
  text: ROH[markeAus(src) ?? ""] ?? "",
});

function korrektur(quelle: string, b: BildBefund, text: string): BildKorrekturDaten {
  return {
    quelle,
    inhaltskennung: b.inhaltskennung ?? "",
    ort: ortKennung(b.fundstelle),
    text,
    schritte: 0,
    geaendertAm: "2026-10-12T12:00:00.000Z",
  };
}

async function einzelbild(): Promise<QuellenBefund> {
  const eingang = einzelbildEingang("rechnung.png", dataUrl(bildMitMassen("M", 900, 300)));
  return createBildAnalyse({ erkenne: engine }).analysiereQuelle(eingang, { automatik: true });
}

describe("B1 · K5 — Klara verwendet die berichtigte Fassung für Frage und Zusammenfassung", () => {
  it("Kontext, Anweisung und Fundstellen tragen „Müller“, nicht „Mül1er“", async () => {
    const roh = await einzelbild();
    const bild = roh.befunde[0];
    if (!bild) {
      throw new Error("kein Befund");
    }
    const praefix = "datei:rechnung.png";
    const quelle = korrekturQuelleFuer(praefix, bild.fundstelle);
    expect(quelle).toBe("datei:rechnung.png|rechnung.png");
    const liste = [korrektur(quelle, bild, "Herr Müller zahlt 4.250 EUR")];

    const [wirksam] = quellenMitKorrekturen([roh], praefix, liste);
    if (!wirksam) {
      throw new Error("keine Quelle");
    }
    const b = wirksam.befunde[0];
    expect(b?.textGekennzeichnet).toBe("Herr Müller zahlt 4.250 EUR");
    expect(b?.korrektur?.rohText).toBe("Herr Mül1er zahlt 4.250 EUR");

    const k = klaraBildKontext("Begleittext der Datei.", [wirksam], t, ortVon);
    expect(k.kontext).toContain(
      "[rechnung.png · Bild 1] bildfundstelle.kontext.textBerichtigt: Herr Müller zahlt 4.250 EUR",
    );
    expect(k.kontext).not.toContain("Mül1er");
    // Frage UND Zusammenfassung bekommen denselben (berichtigten) Kontext — die Anweisung ändert nur
    // den Auftrag.
    expect(klaraAnweisung("frage", "Wer zahlt?", k, t)).toContain("Wer zahlt?");
    expect(klaraAnweisung("zusammenfassung", "", k, t)).toContain(
      "klarabildkontext.anweisung.zusammenfassung",
    );
    const belege = belegstellen("Was zahlt Herr Müller?", "Begleittext der Datei.", k);
    expect(belege[0]).toMatchObject({ art: "bild", quelle: "rechnung.png", ort: "Bild 1" });
    expect(belege[0]?.auszug).toContain("Müller");

    // Ohne Berichtigung: derselbe Weg mit dem Rohbefund (Gegenprobe).
    const ohne = klaraBildKontext("", [roh], t, ortVon);
    expect(ohne.kontext).toContain("klarabildkontext.kontext.text: Herr Mül1er zahlt 4.250 EUR");
    // Der Fingerabdruck unterscheidet beide Stände (eine Antwort zum Rohbefund gilt danach nicht).
    expect(korrekturFingerabdruck([wirksam])).not.toBe(korrekturFingerabdruck([roh]));
  });
});

describe("B2 · K6 — erneutes Lesen derselben Bildfassung überschreibt die Berichtigung nicht", () => {
  it("automatisch wieder gelesen und ausdrücklich neu erkannt: die Berichtigung gilt weiter", async () => {
    const src = dataUrl(bildMitMassen("L", 600, 200));
    const eingang = einzelbildEingang("lager.png", src);
    const analyse = createBildAnalyse({ erkenne: engine });
    const erst = (await analyse.analysiereQuelle(eingang, { automatik: true })).befunde[0];
    if (!erst) {
      throw new Error("kein Befund");
    }
    const quelle = korrekturQuelleFuer("anhang", erst.fundstelle);
    const liste = [korrektur(quelle, erst, "LAGER 29")];

    // Neuer Eingang derselben Bytes (Wiederverwendung) …
    const wieder = (await analyse.analysiereQuelle(eingang, { automatik: true })).befunde[0];
    // … und ein ausdrücklicher neuer Lauf der Engine.
    const vorkommen = eingang.vorkommen[0] ?? { fundstelle: erst.fundstelle, src };
    const neu = await analyse.befundFuerBild(vorkommen, { neu: true });
    expect(analyse.anzahlAnalysen()).toBe(2);
    for (const b of [wieder, neu]) {
      expect(b?.text).toBe("LAGFR 29");
      expect(b?.inhaltskennung).toBe(erst.inhaltskennung);
      const wirksam = befundMitKorrektur(b as BildBefund, liste[0] ?? null);
      expect(wirksam.textGekennzeichnet).toBe("LAGER 29");
    }
  });
});

describe("B3 · K7 — zurückgesetzt gilt der Rohbefund; das Original war nie verändert", () => {
  it("ohne Berichtigung derselbe Befund wie vorher; die Bildbytes sind unverändert", async () => {
    const src = dataUrl(bildMitMassen("L", 600, 200));
    const vorher = src.slice();
    const eingang = einzelbildEingang("lager.png", src);
    const roh = await createBildAnalyse({ erkenne: engine }).analysiereQuelle(eingang, {
      automatik: true,
    });
    const bild = roh.befunde[0];
    if (!bild) {
      throw new Error("kein Befund");
    }
    const quelle = korrekturQuelleFuer("anhang", bild.fundstelle);
    const berichtigt = befundMitKorrektur(bild, korrektur(quelle, bild, "LAGER 29"));
    expect(berichtigt.korrektur?.rohGekennzeichnet).toBe("LAGFR 29");
    // Zurückgesetzt = keine Berichtigung mehr in der Liste: es gilt genau der Rohbefund.
    const [zurueck] = quellenMitKorrekturen([roh], "anhang", []);
    expect(zurueck?.befunde[0]).toBe(bild);
    expect(zurueck?.befunde[0]?.textGekennzeichnet).toBe("LAGFR 29");
    // Weder Analyse noch Berichtigung haben die Bilddaten angefasst.
    expect(eingang.vorkommen[0]?.src).toBe(vorher);
  });
});

describe("B4 · K8 — keine Übertragung auf eine fremde Quelle oder ein verändertes Bild", () => {
  it("PowerPoint: Folie 1 berichtigt — Folie 2, andere Datei, neue Fassung bleiben unberührt", async () => {
    const analyse = createBildAnalyse({ erkenne: engine });
    const lies = async (bytes: Uint8Array, name: string) => {
      const pptx = await lesePptx(bytes);
      return analyse.analysiereQuelle(pptxBildEingang(name, pptx.html, pptx), { automatik: true });
    };
    const fassung1 = await lies(
      deck(bildMitMassen("W", 800, 400), { a: bildMitMassen("L", 600, 200) }),
      "plan.pptx",
    );
    const folie1 = fassung1.befunde[0];
    if (!folie1) {
      throw new Error("kein Befund");
    }
    const praefix = "datei:plan.pptx";
    const liste = [korrektur(korrekturQuelleFuer(praefix, folie1.fundstelle), folie1, "LAGER 29")];

    const [wirksam] = quellenMitKorrekturen([fassung1], praefix, liste);
    expect(wirksam?.befunde.map((b) => b.textGekennzeichnet)).toEqual([
      "LAGER 29",
      "WARTUNG 12.10.2026",
      "",
    ]);
    expect(wirksam?.befunde.map((b) => Boolean(b.korrektur))).toEqual([true, false, false]);

    // Dieselbe Datei unter anderem Namen (andere Quelle): keine Übertragung.
    const [fremd] = quellenMitKorrekturen([fassung1], "datei:anderer-plan.pptx", liste);
    expect(fremd?.befunde[0]?.textGekennzeichnet).toBe("LAGFR 29");

    // Neue Fassung: das Bild auf Folie 1 ist verändert (andere Bytes) — keine Übertragung, aber
    // sichtbar erkannt; das unveränderte Bild auf Folie 2 ist dasselbe wie vorher.
    const fassung2 = await lies(
      deck(bildMitMassen("W", 800, 400), { a: bildMitMassen("N", 600, 200) }),
      "plan.pptx",
    );
    const [neu] = quellenMitKorrekturen([fassung2], praefix, liste);
    const neuFolie1 = neu?.befunde[0];
    expect(neuFolie1?.textGekennzeichnet).toBe("LAGFR 30");
    expect(neuFolie1?.korrektur).toBeUndefined();
    expect(neuFolie1?.inhaltskennung).not.toBe(folie1.inhaltskennung);
    if (!neuFolie1) {
      throw new Error("kein Befund");
    }
    const quelleNeu = korrekturQuelleFuer(praefix, neuFolie1.fundstelle);
    expect(andereFassungBerichtigt(liste, quelleNeu, neuFolie1)).toBe(true);
    expect(neu?.befunde[1]?.inhaltskennung).toBe(fassung1.befunde[1]?.inhaltskennung);
  });
});
