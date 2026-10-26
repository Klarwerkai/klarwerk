// @vitest-environment jsdom
// ================================================================================================
// OCR-03 · ERKANNTES AUS BILDERN IN KLARAS KONTEXT — der DOM-freie Kern (`lib/klaraBildKontext.ts`)
// an einer ECHTEN PowerPoint-Importkette (`deck.ts`: zwei Folien, drei eingebettete Bilder, ein
// nicht übernommenes BMP). Ersetzt ist nur die Texterkennung (liest die Marke aus den Bildbytes).
// ================================================================================================
//
//   C1  K1 — Text, der NUR in einem eingebetteten Bild steht, kommt mit Quelle und Folie/Bild in den
//       Kontext; die Fundstellen einer Frage nennen genau dieses Bild auf seiner Folie.
//   C2  K2 — Zusammenfassung: Folientext UND alle gelesenen Bildtexte im Kontext; die Anweisung
//       verlangt beides und die Fundstellen; die berücksichtigten Bilder sind benannt.
//   C3  Laufende Analyse: nicht gelesene Bilder stehen als „nicht gelesen“ im Kontext, nie mit
//       Text; die Anweisung verbietet, Vollständigkeit zu behaupten.
//   C4  K6 — Befunde einer anderen Quelle oder eines anderen Bildes fallen aus dem Kontext.
//   C5  K4 — Automatik aus: nichts wird neu erkannt; vorhandene Ergebnisse derselben Bildbytes
//       bleiben nutzbar; ein neues Bild bleibt „Automatik aus“; ein überholter Lauf bricht ab.
//   C6  K4 — die Lage der Einstellung aus dem bestätigten Profilstand (Voreinstellung an).
//   C7  K5 — Lesen und Kontextbau verändern weder Datei noch Bilddaten noch Befund.
//   C8  K4 — Nacharbeit 4: Ausschalten während des Laufs startet kein weiteres Bild.
import { describe, expect, it } from "vitest";
import { fundstelleBaustein } from "../../apps/web/src/components/BildBefundListe";
import i18n from "../../apps/web/src/i18n";
import {
  type BildFundstelle,
  type QuellenBefund,
  createBildAnalyse,
  pptxBildEingang,
  rumpfBildEingang,
} from "../../apps/web/src/lib/bildAutomatik";
import { bildAutomatikLage } from "../../apps/web/src/lib/bildAutomatikEinstellung";
import {
  type Uebersetze,
  belegstellen,
  beruecksichtigteBilder,
  klaraAnweisung,
  klaraBildKontext,
} from "../../apps/web/src/lib/klaraBildKontext";
import {
  FOLIENTEXT,
  TEXT_JE_MARKE,
  bildMit,
  dataUrl,
  deck,
  lesePptx,
  markeAus,
  markenEngine,
} from "./deck";

const t: Uebersetze = (k, w) => String(i18n.t(k, w ?? {}));
const ortVon = (f: BildFundstelle, quelle: string): string => {
  const b = fundstelleBaustein(f, quelle);
  return String(i18n.t(b.key, b.params));
};
const DOKUMENT = FOLIENTEXT.join("\n");

async function gelesenesDeck(name = "wartung.pptx") {
  await i18n.changeLanguage("de");
  const bytes = deck();
  const pptx = await lesePptx(bytes);
  const eingang = pptxBildEingang(name, pptx.html, pptx);
  const erkenne = markenEngine();
  const analyse = createBildAnalyse({ erkenne });
  const befund = await analyse.analysiereQuelle(eingang, { automatik: true });
  return { bytes, pptx, eingang, befund, erkenne, analyse };
}

describe("C1 · K1 — Text nur im eingebetteten Bild, mit Folie und Bild", () => {
  it("der Kontext trägt den Bildtext mit Fundstelle; die Fundstelle der Frage ist dieses Bild", async () => {
    const { eingang, befund } = await gelesenesDeck();
    // Voraussetzung: der Text steht NICHT im editierbaren Folientext.
    expect(DOKUMENT).not.toContain("LAGER");

    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    expect(quelltext(k.kontext)).toContain("Wartungsplan");
    expect(quelltext(k.kontext)).toContain(
      `[wartung.pptx · Folie 1, Bild 1] Bildtext: ${TEXT_JE_MARKE.A}`,
    );
    expect(quelltext(k.kontext)).toContain(
      `[wartung.pptx · Folie 2, Bild 1] Bildtext: ${TEXT_JE_MARKE.B}`,
    );
    expect(quelltext(k.kontext)).toContain(
      `[wartung.pptx · Folie 2, Bild 2] Bildtext: ${TEXT_JE_MARKE.C}`,
    );

    const belege = belegstellen("Welche Nummer hat das Lager?", DOKUMENT, k);
    expect(belege[0]).toMatchObject({
      art: "bild",
      quelle: "wartung.pptx",
      ort: "Folie 2, Bild 2",
    });
    expect(belege[0]?.auszug).toContain("LAGER 29");
    // Kein Treffer im Folientext — die Antwort hängt allein am Bild.
    expect(belege.some((b) => b.art === "dokument")).toBe(false);

    const anweisung = klaraAnweisung("frage", "Welche Nummer hat das Lager?", k, t);
    expect(anweisung).toContain("Welche Nummer hat das Lager?");
    expect(anweisung).toContain(i18n.t("klarabildkontext.anweisung.beispiel"));
    expect(anweisung).toContain("erfinde keinen Text");
  });
});

describe("C2 · K2 — Zusammenfassung mit Dokumenttext UND Bildtext", () => {
  it("beides im Kontext, beides in der Anweisung, alle gelesenen Bilder benannt", async () => {
    const { eingang, befund } = await gelesenesDeck();
    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    for (const zeile of FOLIENTEXT) {
      expect(quelltext(k.kontext)).toContain(zeile);
    }
    for (const marke of ["A", "B", "C"]) {
      expect(quelltext(k.kontext)).toContain(TEXT_JE_MARKE[marke] as string);
    }
    const anweisung = klaraAnweisung("zusammenfassung", "", k, t);
    expect(anweisung).toContain(i18n.t("klarabildkontext.anweisung.zusammenfassung"));
    expect(beruecksichtigteBilder(k).map((e) => e.ort)).toEqual([
      "Folie 1, Bild 1",
      "Folie 2, Bild 1",
      "Folie 2, Bild 2",
    ]);
    // PowerPoint ist nie „vollständig“ (BMP nicht übernommen, Layout/Master nicht erfasst) — die
    // Anweisung sagt das, statt Vollständigkeit zu behaupten.
    expect(k.vollstaendig).toBe(false);
    expect(k).toMatchObject({ gesamt: 4, gelesen: 3, offen: 1 });
    expect(anweisung).toContain(
      i18n.t("klarabildkontext.anweisung.unvollstaendig", { offen: 1, gesamt: 4 }),
    );
    expect(quelltext(k.kontext)).toContain(i18n.t("bildautomatik.hinweis.pptxLayout"));
  });
});

describe("C3 · laufende Analyse — kein Anschein von Vollständigkeit", () => {
  it("nicht gelesene Bilder stehen als „nicht gelesen“ da, ohne Text", async () => {
    await i18n.changeLanguage("de");
    const pptx = await lesePptx(deck());
    const eingang = pptxBildEingang("wartung.pptx", pptx.html, pptx);
    const staende: QuellenBefund[] = [];
    await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(eingang, {
      automatik: true,
      onFortschritt: (s) => staende.push(s),
    });
    // Der Stand, als das erste Bild fertig und das zweite in Arbeit war.
    const mitten = staende.find(
      (s) => s.befunde[0]?.status === "gelesen" && s.befunde[1]?.status === "laeuft",
    );
    expect(mitten).toBeDefined();
    const k = klaraBildKontext(DOKUMENT, [mitten as QuellenBefund], t, ortVon, [eingang]);
    expect(k.laeuft).toBe(true);
    expect(k.vollstaendig).toBe(false);
    expect(quelltext(k.kontext)).toContain(TEXT_JE_MARKE.A as string);
    expect(quelltext(k.kontext)).not.toContain(TEXT_JE_MARKE.B as string);
    expect(quelltext(k.kontext)).not.toContain(TEXT_JE_MARKE.C as string);
    const laeuft = i18n.t("klarabildkontext.kontext.offen", {
      status: i18n.t("bildautomatik.status.laeuft"),
    });
    expect(quelltext(k.kontext)).toContain(`[wartung.pptx · Folie 2, Bild 1] ${laeuft}`);
    const anweisung = klaraAnweisung("frage", "Was steht auf Folie 2?", k, t);
    expect(anweisung).toContain(i18n.t("klarabildkontext.anweisung.laeuft"));
    expect(anweisung).toContain("behaupte keine Vollständigkeit");
  });
});

describe("C4 · K6 — nur Befunde der aktuellen Quelle", () => {
  it("eine andere Quelle und ein anderes Bild fallen aus dem Kontext", async () => {
    const { befund, pptx } = await gelesenesDeck("alt.pptx");
    const neu = pptxBildEingang("neu.pptx", pptx.html, pptx);
    const fremd = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [neu]);
    expect(fremd.eintraege).toEqual([]);
    expect(quelltext(fremd.kontext)).not.toContain(TEXT_JE_MARKE.A as string);

    // Rumpf: derselbe Quellname, aber das Bild an Position 1 trägt einen anderen Anker.
    const bild = dataUrl(bildMit("A"));
    const html = `<p>x</p><figure><img data-image-id="kw-1" src="${bild}"></figure>`;
    const alt = rumpfBildEingang("diesem Text", html);
    const gelesen = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(alt, {
      automatik: true,
    });
    const jetzt = rumpfBildEingang("diesem Text", html.replace("kw-1", "kw-9"));
    const k = klaraBildKontext("x", [gelesen], t, ortVon, [jetzt]);
    expect(k.eintraege).toEqual([]);
    expect(quelltext(k.kontext)).not.toContain(TEXT_JE_MARKE.A as string);
  });
});

describe("C5 · K4 — Automatik aus wertet nichts neu aus", () => {
  it("aus: vorhandene Ergebnisse bleiben, neue Bilder nicht gelesen; Abbruch eines Laufs", async () => {
    const erkenne = markenEngine();
    const analyse = createBildAnalyse({ erkenne });
    const html = (zusatz = "") =>
      `<figure><img data-image-id="kw-1" src="${dataUrl(bildMit("A"))}"></figure>${zusatz}`;
    await analyse.analysiereQuelle(rumpfBildEingang("diesem Text", html()), { automatik: true });
    expect(erkenne).toHaveBeenCalledTimes(1);

    const mitNeuem = rumpfBildEingang(
      "diesem Text",
      html(`<figure><img data-image-id="kw-2" src="${dataUrl(bildMit("E"))}"></figure>`),
    );
    const aus = await analyse.analysiereQuelle(mitNeuem, { automatik: false });
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(aus.befunde[0]).toMatchObject({
      status: "gelesen",
      text: TEXT_JE_MARKE.A,
      wiederverwendet: true,
    });
    expect(aus.befunde[1]).toMatchObject({ status: "nicht-analysiert", grund: "automatik-aus" });
    expect(aus.status).toBe("teilweise");

    // Wieder an: jetzt wird das neue Bild gelesen, das vorhandene nicht noch einmal.
    const an = await analyse.analysiereQuelle(mitNeuem, { automatik: true });
    expect(erkenne).toHaveBeenCalledTimes(2);
    expect(an.befunde.map((b) => b.text)).toEqual([TEXT_JE_MARKE.A, TEXT_JE_MARKE.E]);

    // Ein überholter Lauf startet kein weiteres Bild.
    const zaehlerVorher = erkenne.mock.calls.length;
    let erster = true;
    await createBildAnalyse({ erkenne }).analysiereQuelle(mitNeuem, {
      automatik: true,
      abbrechen: () => {
        const ende = !erster;
        erster = false;
        return ende;
      },
    });
    expect(erkenne.mock.calls.length - zaehlerVorher).toBe(1);
    const letzter = erkenne.mock.calls[erkenne.mock.calls.length - 1];
    expect(markeAus(String(letzter?.[0]))).toBe("A");
  });
});

describe("C6 · K4 — Lage der Einstellung (Voreinstellung an)", () => {
  const profil = (bildAutomatik?: boolean) => ({
    name: null,
    avatar: null,
    bewegung: "standard" as const,
    eingerichtetAm: null,
    fassung: 1,
    geaendertAm: "2026-10-12T10:00:00.000Z",
    ...(bildAutomatik === undefined ? {} : { bildAutomatik }),
  });
  it("leer/ohne Wahl → an; aus → aus; lädt → warten; nicht lesbar → unbekannt", () => {
    expect(bildAutomatikLage({ kontoId: null, status: "leer", antwort: null })).toBe("an");
    expect(bildAutomatikLage({ kontoId: "k", status: "laedt", antwort: null })).toBe("laedt");
    expect(bildAutomatikLage({ kontoId: "k", status: "fehler", antwort: null })).toBe("unbekannt");
    expect(
      bildAutomatikLage({
        kontoId: "k",
        status: "bereit",
        antwort: { profil: null, einrichtungOffen: true },
      }),
    ).toBe("an");
    expect(
      bildAutomatikLage({
        kontoId: "k",
        status: "bereit",
        antwort: { profil: profil(), einrichtungOffen: true },
      }),
    ).toBe("an");
    expect(
      bildAutomatikLage({
        kontoId: "k",
        status: "bereit",
        antwort: { profil: profil(false), einrichtungOffen: true },
      }),
    ).toBe("aus");
    expect(
      bildAutomatikLage({
        kontoId: "k",
        status: "bereit",
        antwort: { profil: profil(true), einrichtungOffen: true },
      }),
    ).toBe("an");
  });
});

describe("C7 · K5 — Original unverändert", () => {
  it("Datei, Bilddaten im Rumpf und Befund sind nach Lesen und Kontextbau unverändert", async () => {
    await i18n.changeLanguage("de");
    const bytes = deck();
    const dateiVorher = Array.from(bytes);
    const pptx = await lesePptx(bytes);
    const eingang = pptxBildEingang("wartung.pptx", pptx.html, pptx);
    const befund = await createBildAnalyse({ erkenne: markenEngine() }).analysiereQuelle(eingang, {
      automatik: true,
    });
    expect(Array.from(bytes)).toEqual(dateiVorher);
    const htmlVorher = pptx.html;
    const quellenVorher = eingang.vorkommen.map((v) => v.src);
    const befundVorher = structuredClone(befund);
    const k = klaraBildKontext(DOKUMENT, [befund], t, ortVon, [eingang]);
    belegstellen("Lager", DOKUMENT, k);
    klaraAnweisung("zusammenfassung", "", k, t);
    expect(pptx.html).toBe(htmlVorher);
    expect(eingang.vorkommen.map((v) => v.src)).toEqual(quellenVorher);
    expect(befund).toEqual(befundVorher);
    // Die Bilddaten, die erkannt wurden, sind die Bytes der Datei.
    expect(pptx.html).toContain(dataUrl(bildMit("A")));
  });
});

describe("C8 · K4 — Nacharbeit 4: Ausschalten WÄHREND des Laufs", () => {
  it("nach dem Ausschalten startet kein weiteres Bild; Fertiges bleibt, der Rest heißt „aus“", async () => {
    await i18n.changeLanguage("de");
    const pptx = await lesePptx(deck());
    const eingang = pptxBildEingang("wartung.pptx", pptx.html, pptx);
    const erkenne = markenEngine();
    let aus = false;
    const staende: QuellenBefund[] = [];
    const ende = await createBildAnalyse({ erkenne }).analysiereQuelle(eingang, {
      automatik: true,
      // Der Mensch schaltet aus, sobald das erste Bild gelesen ist.
      onFortschritt: (s) => {
        staende.push(s);
        if (s.befunde[0]?.status === "gelesen") {
          aus = true;
        }
      },
      automatikAus: () => aus,
    });
    expect(erkenne).toHaveBeenCalledTimes(1);
    expect(ende.befunde.map((b) => [b.status, b.grund ?? null])).toEqual([
      ["gelesen", null],
      ["nicht-analysiert", "automatik-aus"],
      ["nicht-analysiert", "automatik-aus"],
    ]);
    expect(ende.befunde[0]?.text).toBe(TEXT_JE_MARKE.A);
    // Kein Anschein eines laufenden oder vollständigen Laufs — und der Endstand wurde gemeldet.
    expect(ende.status).toBe("teilweise");
    expect(staende[staende.length - 1]?.befunde.map((b) => b.status)).toEqual([
      "gelesen",
      "nicht-analysiert",
      "nicht-analysiert",
    ]);
  });
});

// OCR3: derselbe legitime Text und dieselben Fundstellen liegen jetzt in begrenzten JSON-Daten.
function quelltext(kontext: string): string {
  const daten = JSON.parse(kontext.split("\n")[1] ?? "null") as {
    dokument: string;
    hinweise: string[];
  };
  return [daten.dokument, ...daten.hinweise].join("\n\n");
}
