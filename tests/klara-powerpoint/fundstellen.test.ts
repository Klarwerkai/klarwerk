// ================================================================================================
// produkt:20261015:klara-powerpoint-bestand (PP-01) · BESTAND UND PLAN HALTEN IHRE FUNDSTELLEN.
// ================================================================================================
//
//   F1  Jede Fundstelle existiert im Arbeitsbaum und enthält ihren wörtlichen Anker, auch die,
//       die eine Grenze belegen (stand=fehlt). Hosts, Wege, Regeln, Datenquellen und Setup sind
//       alle erfasst (K1).
//   F2  Native PowerPoint-App, PowerPoint-Web und importierte Datei stehen getrennt und sind nicht
//       gleichwertig: das Manifest kennt nur Word, das Add-in-Bundle bricht außerhalb von Word ab,
//       der Dateiimport ist geliefert. Der Plan nennt je Host Fähigkeit und konkrete Lücke (K2, K4).
//   F3  Grenzen, die der Bestand behauptet, stimmen mit dem Code: der PPTX-Eintragsfilter liest
//       Notizen, Diagramme, SmartArt, Layouts nicht ein (L03), der eingebettete Editor gibt keine
//       Auswahl an Klara (W09, L12) (K1, K2).
//   F4  Die verknüpften Host-/OCR-Originale stehen mit Revision und Stand im Abgleich; der
//       PowerPoint-Host bleibt beim Auftrag excel-erster-weg (K1, K3).
//   F5  Der Plan setzt nur erfasste IDs voraus, baut nur auf gelieferten Wegen auf, nutzt den
//       vorhandenen Setup-Ort und führt je PP-ID Original, Stand, Implementierung, Belege und
//       Rest; PP-02 bis PP-09 sind nicht als geliefert ausgegeben (K3, K4).
//   F6  Nacharbeit 1 (Bens Befunde): native Folientabellen sind ein vorhandener Leseweg (W12) am
//       echten Leser, getrennt von fehlenden Diagrammdaten (L03) und fehlender Datenbindung (L17);
//       der Auftragsabgleich nennt Überschneidungen und Zuständigkeiten je Datei (K1, K2).
//   F7  Nacharbeit 4: der Abgleich A01–A12 folgt der kandidatgebundenen Zulieferung der Führung:
//       Zentralstand, Revision, eingerichteter Job, Auftragsordner und Lieferung je Auftrag stehen
//       gleich in fundstellen.json und BESTAND.md 7.2; nur A02 ist offen mit Job und wird
//       geschützt; nicht Belegtes (Sitzungsstatus A02) bleibt als Grenze benannt (K1, K3).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { type EditorNachricht, auswahlVomEditor } from "../../apps/web/src/lib/officeEditor";
import { PPTX_NEEDED_ENTRY_RE, slideToHtml } from "../../apps/web/src/lib/pptx";
import { repoPfad } from "../support/repoPfad";

interface Fundstelle {
  pfad: string;
  anker: string;
}

interface Eintrag {
  id: string;
  art: "host" | "weg" | "regel" | "datenquelle" | "setup" | "auftrag";
  name: string;
  stand?: "geliefert" | "fehlt";
  fundstellen?: Fundstelle[];
  grenze?: string;
  auftrag_id?: string;
  revision?: number;
  auftragsstand?: string;
  herkunft?: string;
  abgleich?: {
    job_eingerichtet: boolean;
    auftragsordner: string;
    ordner_vorhanden: boolean;
    lieferung?: { commit: string; version: string; abgeschlossen_am: string };
  };
}

const ORDNER = "docs/klara-powerpoint";
const lies = (datei: string): string => readFileSync(repoPfad(`${ORDNER}/${datei}`), "utf8");
const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");

const liste = JSON.parse(lies("fundstellen.json")) as {
  auftrag: string;
  revision: number;
  eintraege: Eintrag[];
  luecken: { id: string; name: string }[];
  auftragsabgleich?: { quelle?: string; gebunden_an?: string; erhoben_am?: string };
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
const zeile = (text: string, id: string): string =>
  text.split("\n").find((z) => z.startsWith(`| ${id} | `)) ?? "";
const spalten = (z: string): string[] => {
  const innen = z.replace(/^\|/, "").replace(/\|$/, "");
  return innen.split(" | ").map((s) => s.trim());
};

describe("F1 · jede Fundstelle ist im Quellcode belegt", () => {
  it("Auftrag, eindeutige IDs, alle Bestandsarten vorhanden", () => {
    expect(liste.auftrag).toBe("produkt:20261015:klara-powerpoint-bestand");
    expect(liste.revision).toBe(1);
    expect(ids.size).toBe(eintraege.length);
    expect(lueckenIds.size).toBe(liste.luecken.length);
    for (const art of ["host", "weg", "regel", "datenquelle", "setup", "auftrag"] as const) {
      expect(
        eintraege.some((e) => e.art === art),
        art,
      ).toBe(true);
    }
  });

  for (const e of eintraege.filter((x) => x.art !== "auftrag")) {
    it(`${e.id} · ${e.name}`, () => {
      expect(["geliefert", "fehlt"], e.id).toContain(e.stand);
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

  it("jede ID und jede Lücke steht als Tabellenzeile in BESTAND.md", () => {
    const bestand = lies("BESTAND.md");
    const fehlend = [...alleIds].filter((id) => zeile(bestand, id) === "");
    expect(fehlend).toEqual([]);
  });
});

describe("F2 · native App, Web und importierte Datei getrennt und nicht gleichwertig", () => {
  const bestand = lies("BESTAND.md");
  const plan = lies("INTEGRATIONSPLAN.md");

  it("drei getrennte Hosts mit unterschiedlichem Stand", () => {
    expect(eintrag("H01").name).toContain("Native PowerPoint-App");
    expect(eintrag("H02").name).toContain("PowerPoint für das Web");
    expect(eintrag("H03").name).toContain("Importierte Präsentationsdatei");
    expect(eintrag("H01").stand).toBe("fehlt");
    expect(eintrag("H02").stand).toBe("fehlt");
    expect(eintrag("H03").stand).toBe("geliefert");
    expect(zeile(bestand, "H01")).toContain("| **Native PowerPoint-App**");
    expect(zeile(bestand, "H02")).toContain("| **PowerPoint für das Web**");
    expect(zeile(bestand, "H03")).toContain("| **Importierte Präsentationsdatei**");
    expect(bestand).toContain("Sie sind **nicht gleichwertig**.");
  });

  it("das Office-Manifest kennt nur Word; das Add-in-Bundle bricht außerhalb von Word ab", () => {
    const manifest = quelle("docs/word-addin/klara-manifest.xml");
    const hosts = [...manifest.matchAll(/<Host Name="([^"]+)"/g)].map((m) => m[1]);
    expect(new Set(hosts)).toEqual(new Set(["Document"]));
    expect(quelle("services/app/addin-static/taskpane.js")).toContain(
      'setStatus("Dieses Add-in ist für Word gedacht.");',
    );
  });

  it("der Plan nennt je Host eine echte Fähigkeit oder „keine“ und bekannte Lücken", () => {
    const hosts = eintraege.filter((e) => e.art === "host");
    for (const h of hosts) {
      const z = plan.split("\n").find((x) => x.startsWith(`| ${h.id} `)) ?? "";
      expect(z, `${h.id} fehlt in der Hosttabelle des Plans`).not.toBe("");
      const [, faehigkeit, luecken] = spalten(z);
      const genannt = [...(luecken ?? "").matchAll(/\bL\d{2}\b/g)].map((m) => m[0]);
      expect(genannt.length, h.id).toBeGreaterThan(0);
      expect(
        genannt.filter((l) => !lueckenIds.has(l)),
        h.id,
      ).toEqual([]);
      if (h.stand === "fehlt") {
        expect(faehigkeit, h.id).toBe("keine");
      } else {
        expect(faehigkeit, h.id).toMatch(/\bW\d{2}\b/);
      }
    }
    expect(plan).toMatch(/^\| H01 Native App \| keine \|.*\*\*nicht angeboten\*\*/m);
    expect(plan).toMatch(/^\| H02 Web \| keine \|.*\*\*nicht angeboten\*\*/m);
  });
});

describe("F3 · behauptete Grenzen stimmen mit dem Code", () => {
  it("der PPTX-Eintragsfilter liest Notizen, Diagramme, SmartArt und Layouts nicht ein (L03)", () => {
    for (const gelesen of [
      "ppt/presentation.xml",
      "ppt/slides/slide1.xml",
      "ppt/media/image1.png",
    ]) {
      expect(PPTX_NEEDED_ENTRY_RE.test(gelesen), gelesen).toBe(true);
    }
    for (const nie of [
      "ppt/notesSlides/notesSlide1.xml",
      "ppt/charts/chart1.xml",
      "ppt/diagrams/data1.xml",
      "ppt/slideLayouts/slideLayout1.xml",
      "ppt/slideMasters/slideMaster1.xml",
    ]) {
      expect(PPTX_NEEDED_ENTRY_RE.test(nie), nie).toBe(false);
    }
    expect(liste.luecken.find((l) => l.id === "L03")?.name).toContain("keine Sprechernotizen");
  });

  it("der eingebettete Editor gibt keine Auswahl an Klara (W09, L12)", () => {
    const nachricht: EditorNachricht = {
      id: "Text_Selection_Change",
      werte: { text: "Umsatz 1.500 €" },
    };
    expect(auswahlVomEditor(nachricht)).toBe(null);
    expect(lueckenIds.has("L12")).toBe(true);
  });
});

describe("F4 · Abgleich laufender Host-/OCR-/Setup-/Office-Aufträge", () => {
  const bestand = lies("BESTAND.md");
  const auftraege = eintraege.filter((e) => e.art === "auftrag");

  it("die sechs verknüpften Originale stehen mit Revision und Stand „offen“", () => {
    const verknuepft: [string, number][] = [
      ["aufnahme:20260922:excel-erster-weg", 4],
      ["produkt:20261012:klara-ocr-fundstellen-korrekturen", 1],
      ["produkt:20261012:klara-ocr-tabellen", 1],
      ["produkt:20261012:klara-ocr-mehrseitige-scans", 1],
      ["produkt:20261012:klara-ocr-widersprueche", 1],
      ["produkt:20261012:klara-ocr-bereichsfrage", 1],
    ];
    for (const [id, revision] of verknuepft) {
      const a = auftraege.find((x) => x.auftrag_id === id);
      expect(a, id).toBeDefined();
      expect(a?.revision, id).toBe(revision);
      expect(a?.auftragsstand, id).toBe("offen");
      expect(zeile(bestand, a?.id ?? "")).toContain(`| \`${id}\` | ${revision} | offen |`);
    }
  });

  it("jeder Auftrag im Hauptstand ist an seiner Herkunft im Repository belegt", () => {
    for (const a of auftraege.filter((x) => x.auftragsstand !== "offen")) {
      expect(a.herkunft ?? "", a.id).not.toBe("");
      expect(quelle(a.herkunft ?? ""), a.id).toContain(a.auftrag_id ?? "");
      expect(zeile(bestand, a.id)).toContain(`\`${a.auftrag_id}\``);
    }
  });

  it("der PowerPoint-Host bleibt beim Auftrag excel-erster-weg; PP-01 startet nichts", () => {
    expect(zeile(bestand, "A01")).toContain("baut **nur** A01");
    expect(lies("INTEGRATIONSPLAN.md")).toContain("2. **Hosts nur über A01.**");
    expect(bestand).toContain(
      "PP-01 hat keinen dieser Aufträge gestartet, geändert oder übernommen.",
    );
  });
});

describe("F5 · der Plan baut auf dem Bestand auf und führt den Stand je PP-ID", () => {
  const plan = lies("INTEGRATIONSPLAN.md");

  it("der Plan setzt nur erfasste IDs voraus", () => {
    const genannt = [...plan.matchAll(/\b[HWVDSAL]\d{2}\b/g)].map((m) => m[0]);
    expect(genannt.length).toBeGreaterThan(0);
    expect(genannt.filter((id) => !alleIds.has(id))).toEqual([]);
  });

  it("der Plan baut nur auf gelieferten Wegen auf", () => {
    const wege = new Set([...plan.matchAll(/\bW\d{2}\b/g)].map((m) => m[0]));
    for (const w of wege) {
      expect(eintrag(w).stand, w).toBe("geliefert");
    }
  });

  it("je Paket PP-02 bis PP-09 ein Abschnitt; Setup nur im vorhandenen Bereich", () => {
    for (const pp of ["PP-02", "PP-03", "PP-04", "PP-05", "PP-06", "PP-07", "PP-08", "PP-09"]) {
      expect(plan, pp).toMatch(new RegExp(`^## \\d+\\. ${pp} · `, "m"));
    }
    expect(plan).toContain("## 10. Setup › Klara");
    expect(plan).toContain("Neue Einstellungen kommen in S01");
  });

  it("der Stand je PP-ID trennt Original, Stand, Implementierung, Belege und Rest", () => {
    for (let n = 1; n <= 9; n += 1) {
      const pp = `PP-0${n}`;
      const z = zeile(plan, pp);
      expect(z, `${pp} fehlt`).not.toBe("");
      const s = spalten(z);
      expect(s.length, pp).toBe(6);
      if (n === 1) {
        expect(s[1], pp).toContain("`produkt:20261015:klara-powerpoint-bestand` · 1");
        expect(s[2], pp).not.toMatch(/geliefert|geprüft/);
      } else {
        expect(s[2], pp).toBe("vorbereitet");
        expect(s[5], pp).not.toBe("—");
      }
    }
  });
});

describe("F6 · Nacharbeit 1: Folientabellen und Auftragsabgleich", () => {
  const bestand = lies("BESTAND.md");
  const plan = lies("INTEGRATIONSPLAN.md");
  const luecke = (id: string): string => liste.luecken.find((l) => l.id === id)?.name ?? "";

  it("der echte Leser übernimmt eine native Folientabelle als Tabelle und Klartext (W12)", () => {
    const zelle = (t: string): string =>
      `<a:tc><a:txBody><a:p><a:r><a:t>${t}</a:t></a:r></a:p></a:txBody></a:tc>`;
    const tabellenzeile = `<a:tr>${zelle("Umsatz")}${zelle("1.500 €")}</a:tr>`;
    const tabelle = `<p:graphicFrame><a:graphic><a:graphicData><a:tbl>${tabellenzeile}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
    const folie = `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree>${tabelle}</p:spTree></p:cSld></p:sld>`;
    const { html, text, tableCount } = slideToHtml(folie, { slideNumber: 1, slideLabel: "Folie" });
    expect(tableCount).toBe(1);
    expect(html).toContain("<table><tr><td>Umsatz</td><td>1.500 €</td></tr></table>");
    expect(text).toContain("Umsatz | 1.500 €");
    // Zellentext, keine Datenstruktur: keine Kopfzeile, keine Zell- oder Tabellenkennung (L17).
    expect(html).not.toMatch(/<th\b|data-/);
  });

  it("W12 steht als gelieferter Weg an W01 und H03; Lücken sind getrennt", () => {
    expect(eintrag("W12").stand).toBe("geliefert");
    expect(eintrag("W01").name).toContain("native Tabellen (W12)");
    expect(zeile(bestand, "W12")).toContain("`tableCount`");
    expect(zeile(bestand, "H03")).toContain(
      "native Folientabellen als HTML-Tabelle und Klartext (W12)",
    );
    expect(plan).toMatch(/^\| H03 Importierte Datei \| [^|]*W12[^|]* \| [^|]*L17/m);
    // L03 behauptet keine fehlenden Tabellen mehr, nur fehlende Diagrammdaten.
    expect(luecke("L03")).not.toMatch(/Tabellen und Diagramme einer Folie sind deshalb keine/);
    expect(luecke("L03")).toContain("Diagrammwerte");
    expect(luecke("L17")).toContain("keine Bindung an Quelle und Folienelement");
    expect(zeile(plan, "PP-02")).toContain("L17");
  });

  it("der Abgleich nennt Überschneidungen und Zuständigkeiten je Datei", () => {
    expect(bestand).toContain("### 7.1 Überschneidungen und Zuständigkeiten");
    for (const datei of [
      "`docs/word-addin/klara-manifest.xml`",
      "`apps/web/src/lib/bildAutomatik.ts`",
      "`apps/web/src/lib/pptx.ts`",
      "`apps/web/src/components/klara-setup/KlaraSetup.tsx`",
      "`services/app/src/office-nachbearbeitung.ts`",
      "`services/app/src/meeting-dokumentbezug.ts`",
    ]) {
      const z = bestand.split("\n").find((x) => x.startsWith(`| ${datei}`)) ?? "";
      expect(z, datei).not.toBe("");
      expect(spalten(z).length, datei).toBe(5);
      expect(z, datei).toMatch(/\bA\d{2}\b/);
    }
  });
});

describe("F7 · Nacharbeit 4: Abgleich A01–A12 aus der Zulieferung der Führung", () => {
  const bestand = lies("BESTAND.md");
  const ab72 = bestand.slice(bestand.indexOf("### 7.2 Sitzungen, Kandidaten und Arbeitsbäume"));
  const zeile72 = (id: string): string => zeile(ab72, id);
  const auftraege = eintraege.filter((e) => e.art === "auftrag");
  const quelleDerZulieferung = liste.auftragsabgleich;

  it("die Zulieferung ist benannt und an einen Kandidaten gebunden", () => {
    expect(quelleDerZulieferung?.quelle ?? "").toContain(
      "QUELLEN-FUEHRUNG-PP01-ANSCHLUSSBESTAND-20261015.json",
    );
    expect(quelleDerZulieferung?.gebunden_an ?? "").toMatch(/^[0-9a-f]{40}$/);
    expect(quelleDerZulieferung?.erhoben_am ?? "").toMatch(/^2026-10-15T/);
    expect(bestand).toContain("`QUELLEN-FUEHRUNG-PP01-ANSCHLUSSBESTAND-20261015.json`");
    // Die frühere offene Lücke ist geschlossen, nicht still gelöscht: 7.2 trägt jetzt die Werte.
    expect(bestand).not.toContain("**Nicht erhoben:**");
  });

  it("je Auftrag Job, Ordner und Zentralstand; 7.2 gibt genau diese Werte wieder", () => {
    expect(auftraege.map((a) => a.id)).toEqual(
      Array.from({ length: 12 }, (_, i) => `A${String(i + 1).padStart(2, "0")}`),
    );
    for (const a of auftraege) {
      const g = a.abgleich;
      expect(g, a.id).toBeDefined();
      expect(g?.auftragsordner ?? "", a.id).toMatch(/^auftrag-[0-9a-f]{20}$/);
      expect(typeof a.revision, a.id).toBe("number");
      const z = zeile72(a.id);
      expect(z, `${a.id} fehlt in 7.2`).not.toBe("");
      const s = spalten(z);
      expect(s.length, a.id).toBe(6);
      expect(s[1], a.id).toBe(`${a.auftragsstand}, Rev. ${a.revision}`);
      expect(s[2], a.id).toMatch(g?.job_eingerichtet ? /^\*\*ja\*\*$|^ja$/ : /^nein$/);
      const ordner = `\`${g?.auftragsordner}\` ${g?.ordner_vorhanden ? "vorhanden" : "fehlt"}`;
      expect(s[3], a.id).toBe(ordner);
      if (a.auftragsstand === "abgeschlossen") {
        const l = g?.lieferung;
        expect(l?.commit ?? "", a.id).toMatch(/^[0-9a-f]{40}$/);
        expect(l?.version ?? "", a.id).toMatch(/^1\.0\.0-beta\.1\.\d+$/);
        expect(s[4], a.id).toContain(`\`${l?.commit.slice(0, 8)}\` · ${l?.version}`);
      } else {
        expect(a.auftragsstand, a.id).toBe("offen");
        expect(g?.lieferung, a.id).toBeUndefined();
        expect(s[4], a.id).toBe("—");
      }
    }
  });

  it("A07–A12 sind abgeschlossen, A01–A06 offen; A09 trägt die zentrale Revision 4", () => {
    for (const id of ["A07", "A08", "A09", "A10", "A11", "A12"]) {
      expect(eintrag(id).auftragsstand, id).toBe("abgeschlossen");
      expect(zeile(bestand, id), id).toContain("| abgeschlossen |");
    }
    for (const id of ["A01", "A02", "A03", "A04", "A05", "A06"]) {
      expect(eintrag(id).auftragsstand, id).toBe("offen");
    }
    expect(eintrag("A09").revision).toBe(4);
  });

  it("nur A02 ist ein offener Auftrag mit eingerichtetem Job und wird geschützt", () => {
    const offenMitJob = auftraege
      .filter((a) => a.auftragsstand === "offen" && a.abgleich?.job_eingerichtet)
      .map((a) => a.id);
    expect(offenMitJob).toEqual(["A02"]);
    expect(zeile72("A02")).toContain("**einziger eingerichteter offener Fremdauftrag**");
    expect(ab72).toContain("Damit entsteht kein Doppelstart.");
    // Was die Zulieferung nicht trägt, bleibt als Grenze benannt.
    expect(ab72).toContain("Ob dort gerade eine Sitzung läuft, ist nicht belegt");
  });
});
