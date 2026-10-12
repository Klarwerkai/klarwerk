// ================================================================================================
// produkt:20261012:klara-bildanalyse-ocr-bestand (OCR-01) · DIE MATRIX HÄLT IHRE FUNDSTELLEN.
// ================================================================================================
//
//   F1  Jede Fundstelle existiert im Arbeitsbaum und enthält ihren wörtlichen Anker — auch die,
//       die eine Grenze belegen (stand=fehlt). Die Liste behauptet nichts, was der Code nicht trägt (K1).
//   F2  Die Matrix enthält einzeln bereitgestellte Bilder (Q01) und PowerPoint (Q02) ausdrücklich;
//       jede Quelle nennt Host, Erfassungsweg und konkrete Lücken, die im Bestand stehen (K1).
//   F3  Der Abgleich nennt den bestehenden OCR-Auftrag mit Revision, Kandidat und dessen Tests; der
//       Integrationsplan behandelt OCR-02 bis OCR-04 (K2).
//   F4  Plan und Abgleich setzen nur erfasste IDs voraus; fehlende Hosts sind als fehlend geführt
//       und das Office-Manifest kennt tatsächlich nur Word; die Erkennung ist im Code weiterhin
//       klickgebunden, wie die Matrix es sagt (K3).
//   F5  Nacharbeit 1 (Bens Befunde): der Abgleich führt alle sieben Kriterien von gesamt-ocr
//       Revision 2 mit dem aktuellen Kandidaten 64e1768c und seinem Urteil (K2); gezählte PPTX-
//       Verluste (L05) sind von nie eingelesenen Teilen (L16) getrennt — gegen den echten
//       Eintragsfilter des Imports geprüft (K1); Office-Anhänge im Artikel (H06) sind ein Eingang
//       von OCR-02 mit offener Lücke L17, kein Ausschluss (K2, K3).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PPTX_NEEDED_ENTRY_RE } from "../../apps/web/src/lib/pptx";
import { repoPfad } from "../support/repoPfad";

interface Fundstelle {
  pfad: string;
  anker: string;
}

interface Eintrag {
  id: string;
  art: "host" | "quelle" | "weg" | "kandidat";
  name: string;
  stand: "geliefert" | "kandidat" | "fehlt";
  fundstellen?: Fundstelle[];
  grenze?: string;
  host?: string[];
  wege?: string[];
  luecken?: string[];
  fundstelle?: string;
  auftrag_id?: string;
  revision?: number;
  zweig?: string;
  commit?: string;
  ben_urteil?: string;
  anforderungen?: string[];
  kriterien?: { k: string; anforderung: string; bezug: string }[];
}

const ORDNER = "docs/klara-bildanalyse-ocr";
const lies = (datei: string): string => readFileSync(repoPfad(`${ORDNER}/${datei}`), "utf8");
const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");

const liste = JSON.parse(lies("fundstellen.json")) as {
  eintraege: Eintrag[];
  luecken: { id: string; name: string }[];
};
const eintraege = liste.eintraege;
const ids = new Set(eintraege.map((e) => e.id));
const lueckenIds = new Set(liste.luecken.map((l) => l.id));
const alleIds = new Set([...ids, ...lueckenIds]);
const eintrag = (id: string): Eintrag => {
  const e = eintraege.find((x) => x.id === id);
  if (!e) {
    throw new Error(`${id} fehlt in fundstellen.json`);
  }
  return e;
};

describe("F1 · jede Fundstelle ist im Quellcode belegt", () => {
  it("IDs sind eindeutig, Stände sind getrennt", () => {
    expect(ids.size).toBe(eintraege.length);
    expect(lueckenIds.size).toBe(liste.luecken.length);
    for (const e of eintraege) {
      expect(["geliefert", "kandidat", "fehlt"], e.id).toContain(e.stand);
    }
  });

  for (const e of eintraege.filter((x) => x.stand !== "kandidat")) {
    it(`${e.id} · ${e.name}`, () => {
      expect(e.fundstellen?.length ?? 0, `${e.id} ohne Fundstelle`).toBeGreaterThan(0);
      if (e.stand === "fehlt") {
        expect(e.grenze ?? "", `${e.id} fehlt ohne benannte Grenze`).not.toBe("");
      }
      for (const f of e.fundstellen ?? []) {
        const pfad = repoPfad(f.pfad);
        expect(existsSync(pfad), `${e.id}: ${f.pfad} fehlt`).toBe(true);
        expect(readFileSync(pfad, "utf8"), `${e.id}: Anker fehlt in ${f.pfad}`).toContain(f.anker);
      }
    });
  }

  it("der Kandidat nennt Zweig, Commit, Originalauftrag und Revision, keine Fundstelle", () => {
    const kandidaten = eintraege.filter((e) => e.stand === "kandidat");
    expect(kandidaten.map((e) => e.id)).toEqual(["C01"]);
    for (const e of kandidaten) {
      expect(e.zweig ?? "", e.id).toMatch(/^codex\/auftrag-[0-9a-f]{20}$/);
      expect(e.commit ?? "", e.id).toMatch(/^[0-9a-f]{40}$/);
      expect(e.auftrag_id, e.id).toBe("aufnahme:20260922:gesamt-ocr");
      expect(e.revision, e.id).toBe(2);
      expect(e.fundstellen, e.id).toBeUndefined();
    }
  });
});

describe("F2 · die Quellen-/Hostmatrix", () => {
  const bestand = lies("BESTAND.md");
  const quellen = eintraege.filter((e) => e.art === "quelle");

  it("einzeln bereitgestellte Bilder und PowerPoint sind ausdrücklich enthalten", () => {
    expect(eintrag("Q01").name).toContain("Einzeln bereitgestelltes Bild");
    expect(eintrag("Q02").name).toContain("PowerPoint");
    expect(bestand).toContain("| Q01 | **Einzeln bereitgestelltes Bild**");
    expect(bestand).toContain("| Q02 | **PowerPoint-Datei (.pptx)**");
    // Dateiimport und Add-in sind getrennt: PowerPoint als Datei geliefert, als Host fehlend.
    expect(eintrag("Q02").stand).toBe("geliefert");
    expect(eintrag("H03").stand).toBe("fehlt");
  });

  for (const q of quellen.filter((x) => x.stand === "geliefert")) {
    it(`${q.id} nennt Host, Erfassungsweg, Fundstelle und Lücken aus dem Bestand`, () => {
      expect(q.host?.length ?? 0, q.id).toBeGreaterThan(0);
      expect(q.wege?.length ?? 0, q.id).toBeGreaterThan(0);
      expect(q.luecken?.length ?? 0, q.id).toBeGreaterThan(0);
      expect(q.fundstelle ?? "", q.id).not.toBe("");
      for (const h of q.host ?? []) {
        expect(eintrag(h).art, `${q.id} → ${h}`).toBe("host");
      }
      for (const w of q.wege ?? []) {
        expect(eintrag(w).art, `${q.id} → ${w}`).toBe("weg");
      }
      for (const l of q.luecken ?? []) {
        expect(lueckenIds.has(l), `${q.id} → ${l}`).toBe(true);
      }
    });
  }

  it("jede ID und jede Lücke steht in BESTAND.md", () => {
    const fehlend = [...alleIds].filter((id) => !new RegExp(`\\b${id}\\b`).test(bestand));
    expect(fehlend).toEqual([]);
    for (const l of liste.luecken) {
      expect(bestand, l.id).toMatch(new RegExp(`^\\| ${l.id} \\| `, "m"));
    }
  });
});

describe("F3 · Abgleich mit dem OCR-Auftrag und Integrationsplan", () => {
  const abgleich = lies("ABGLEICH-OCR-AUFTRAG.md");
  const plan = lies("INTEGRATIONSPLAN.md");
  const c01 = eintrag("C01");

  it("der Abgleich nennt Auftrag, Revision, Kandidat und dessen Anforderungen", () => {
    expect(abgleich).toContain("`aufnahme:20260922:gesamt-ocr`, **Revision 2**");
    expect(abgleich).toContain(`\`${c01.zweig}\``);
    expect(abgleich).toContain(`\`${c01.commit}\``);
    for (const r of c01.anforderungen ?? []) {
      expect(abgleich, r).toContain(r);
    }
  });

  it("der Abgleich trennt erfüllt, fehlend und neu und nennt die Kandidatentests", () => {
    for (const teil of [
      "**Erfüllt durch Bestand oder C01.",
      "**Fehlt im Bestand und in C01:**",
      "**Neu gegenüber dem bestehenden Auftrag",
    ]) {
      expect(abgleich, teil).toContain(teil);
    }
    for (const test of [
      "tests/capture/ocr-engine-gleiche-herkunft.test.ts",
      "tests-smoke/ocr-technische-probe-browser.spec.ts",
      "tests/capture/gesamt-ocr-interview-kontext.test.ts",
      "tests/media-lokal/r0181-lokale-transkription.test.ts",
    ]) {
      expect(abgleich, test).toContain(test);
    }
    expect(abgleich).toContain("zählen **nicht** als Lieferung der Automatik");
  });

  it("der Plan behandelt Reihenfolge, OCR-02, OCR-03, OCR-04 und Hostzugänge", () => {
    for (const kopf of [
      "## 0. Reihenfolge und Abhängigkeiten",
      "## 1. OCR-02 ",
      "## 2. OCR-03 ",
      "## 3. OCR-04 ",
      "## 4. Hostzugänge, wahrheitsgemäß",
    ]) {
      expect(plan, kopf).toContain(kopf);
    }
    expect(plan).toContain("**C01 zuerst regulär abschließen.**");
  });
});

describe("F4 · vorhandene Architektur, fehlende Hosts wahrheitsgemäß", () => {
  for (const datei of ["INTEGRATIONSPLAN.md", "ABGLEICH-OCR-AUFTRAG.md"]) {
    it(`${datei} setzt nur erfasste IDs voraus`, () => {
      const genannt = [...lies(datei).matchAll(/\b[HQWCL]\d{2}\b/g)].map((m) => m[0]);
      expect(genannt.length).toBeGreaterThan(0);
      expect(genannt.filter((id) => !alleIds.has(id))).toEqual([]);
    });
  }

  it("der Plan baut auf gelieferten Wegen auf, nicht auf fehlenden", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    const wege = new Set([...plan.matchAll(/\bW\d{2}\b/g)].map((m) => m[0]));
    for (const w of wege) {
      expect(eintrag(w).stand, w).toBe("geliefert");
    }
  });

  it("das Office-Manifest kennt nur Word; PowerPoint- und Mac-Host fehlen", () => {
    const manifest = quelle("docs/word-addin/klara-manifest.xml");
    const hosts = [...manifest.matchAll(/<Host Name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(hosts)).toEqual(new Set(["Document"]));
    for (const id of ["H03", "H05"]) {
      expect(eintrag(id).stand, id).toBe("fehlt");
    }
    const plan = lies("INTEGRATIONSPLAN.md");
    expect(plan).toMatch(/^\| H03 \| nein, \*\*fehlt\*\* \|/m);
    expect(plan).toMatch(/^\| H05 \| nein, \*\*fehlt\*\* \|/m);
  });

  it("die Erkennung ist im Code weiterhin klickgebunden; L01 bleibt offen", () => {
    expect(quelle("apps/web/src/lib/files.ts")).toContain(
      "Nur auf explizite Nutzeraktion aufrufen.",
    );
    expect(lueckenIds.has("L01")).toBe(true);
    expect(lies("BESTAND.md")).toContain("Eine automatische Auslösung gibt es nirgends (L01).");
  });
});

describe("F5 · Nacharbeit 1: Originalabgleich, PPTX-Grenzen, Artikelanhänge", () => {
  const abgleich = lies("ABGLEICH-OCR-AUFTRAG.md");
  const bestand = lies("BESTAND.md");
  const plan = lies("INTEGRATIONSPLAN.md");
  const zeile = (text: string, id: string): string =>
    text.split("\n").find((z) => z.startsWith(`| ${id} | `)) ?? "";

  it("C01 ist der aktuelle Kandidat 64e1768c mit Bens Urteil", () => {
    const c01 = eintrag("C01");
    expect(c01.commit).toBe("64e1768c1aa48ffb70f509dc0f0181de97db95bc");
    expect(c01.ben_urteil).toBe("erfuellt");
    expect(c01.anforderungen).toContain("R-2098");
    expect(abgleich).toContain("Urteil **„erfuellt“**");
    expect(abgleich).toContain("Er löst den früher genannten Stand `842d2f63` ab");
    expect(abgleich).not.toContain("lag diesem Lauf **nicht** vor");
  });

  it("alle sieben Kriterien stehen mit Wortlaut, Lieferstand und Bezug im Abgleich", () => {
    const soll: [string, string, string][] = [
      ["K1", "R-0121", "Eine Sprach- oder Videoaufnahme wird automatisch in Text umgewandelt"],
      ["K2", "R-0138", "Bei einer eingescannten PDF ueber 50 MB"],
      ["K3", "R-0151", "Die Erkennung startet nur auf ausdruecklichen Klick, nie von selbst."],
      ["K4", "R-0181", "Aufnahmen sollen auf dem eigenen Rechner ohne Cloud"],
      ["K5", "R-2098", "Dokumentanhang + OCR (SOLL)"],
      ["K6", "FR-CAP-05", "mit Auto-OCR als Kontext"],
      ["K7", "Nachweis", "Konkrete Quellenwidersprüche und fehlende Belege benennen."],
    ];
    const kriterien = eintrag("C01").kriterien ?? [];
    expect(kriterien.map((k) => k.k)).toEqual(soll.map(([k]) => k));
    for (const [k, anforderung, wortlaut] of soll) {
      const z = zeile(abgleich, k);
      expect(z, `${k} fehlt im Abgleich`).not.toBe("");
      expect(z, k).toContain(wortlaut);
      if (anforderung !== "Nachweis") {
        expect(z, k).toContain(anforderung);
      }
      // Wortlaut | Lieferstand | Bezug: jede Zeile hat fünf befüllte Spalten.
      const spalten = z.split(" | ").map((s) => s.replace(/^\| |\|$/g, "").trim());
      expect(spalten.filter((s) => s.length > 0).length, k).toBeGreaterThanOrEqual(4);
      expect(kriterien.find((x) => x.k === k)?.anforderung, k).toBe(anforderung);
    }
    expect(abgleich).toContain("**Quellenwiderspruch");
  });

  it("der PPTX-Eintragsfilter liest Layout, Master, Diagramme nicht ein (L16)", () => {
    for (const gelesen of [
      "ppt/presentation.xml",
      "ppt/slides/slide1.xml",
      "ppt/slides/_rels/slide1.xml.rels",
      "ppt/media/image1.png",
    ]) {
      expect(PPTX_NEEDED_ENTRY_RE.test(gelesen), gelesen).toBe(true);
    }
    for (const nieGelesen of [
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      "ppt/slideMasters/slideMaster1.xml",
      "ppt/charts/chart1.xml",
      "ppt/diagrams/data1.xml",
      "ppt/notesSlides/notesSlide1.xml",
    ]) {
      expect(PPTX_NEEDED_ENTRY_RE.test(nieGelesen), nieGelesen).toBe(false);
    }
  });

  it("gezählte Verluste (L05) und nie erfasste Teile (L16) sind überall getrennt", () => {
    expect(zeile(bestand, "L05")).toContain("**gezählt, aber nicht gelesen**");
    expect(zeile(bestand, "L05")).not.toMatch(/Layout|Master|Diagramme|SmartArt/);
    expect(zeile(bestand, "L16")).toContain("**überhaupt nicht erfasst und nicht gezählt**");
    expect(zeile(bestand, "L16")).toContain("`PPTX_NEEDED_ENTRY_RE`");
    const l05 = liste.luecken.find((l) => l.id === "L05")?.name ?? "";
    const l16 = liste.luecken.find((l) => l.id === "L16")?.name ?? "";
    expect(l05).toContain("gezählt, aber nicht gelesen");
    expect(l05).not.toMatch(/Layout|Master|Diagramme|SmartArt/);
    expect(l16).toContain("überhaupt nicht erfasst und nicht gezählt");
    expect(eintrag("Q02").luecken).toEqual(expect.arrayContaining(["L05", "L16"]));
    expect(plan).toContain("- **Gezählt, aber nicht gelesen (L05).**");
    expect(plan).toContain("- **Gar nicht erfasst (L16).**");
    expect(plan).toContain("nie „alle Bilder gelesen“ melden");
  });

  it("Office-Anhänge im Artikel (H06) sind Eingang von OCR-02 mit offener Lücke L17", () => {
    expect(eintrag("W18").stand).toBe("geliefert");
    for (const q of ["Q02", "Q03"]) {
      expect(eintrag(q).wege, q).toContain("W18");
      expect(eintrag(q).luecken, q).toContain("L17");
      expect(eintrag(q).host, q).toContain("H06");
    }
    expect(zeile(bestand, "L17")).not.toBe("");
    expect(plan).toMatch(/^\| Office-Anhang im Artikel \(H06\).*\| Q02, Q03 \|.*W03.*W05.*W01/m);
    expect(plan).toContain("**Offene technische Schritte für Artikelanhänge (H06, L17).**");
    expect(plan).toMatch(/^\| H06 \| ja, als Eingang von OCR-02 \|/m);
    expect(plan).not.toContain("nicht Teil von OCR-02");
  });
});
