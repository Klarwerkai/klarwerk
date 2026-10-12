// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-bestand (AA-01) · DER BESTAND HÄLT SEINE FUNDSTELLEN.
// ================================================================================================
//
//   F1  Jede Fundstelle eines gelieferten Eintrags existiert im Arbeitsbaum und enthält ihren
//       wörtlichen Anker — die Liste behauptet nichts, was der Quellcode nicht trägt (K1).
//   F2  Stände sind sauber getrennt: geliefert mit Fundstellen, Kandidat nur mit Zweig und Commit,
//       beauftragt nur mit AA-ID und ohne Code (K1).
//   F3  Jede ID der Liste steht in BESTAND.md; Integrationsplan und Entscheidungsvorlage liegen vor
//       und nennen den offenen Status der systemweiten Frage (K2).
//   F4  Integrationsplan und Entscheidungsvorlage setzen nur IDs voraus, die im Bestand stehen —
//       keine zusätzlichen Einstellungen oder Aktionen (K3).
//   F5  Nacharbeit 1 (Bens Befunde): jeder Schalter der Word-Einstellungsfläche und die im
//       Word-Dokument gespeicherte Kennung sind inventarisiert und von Anmeldung und Panelzustand
//       getrennt; der Plan führt E06 über den vorhandenen Hinweisweg; „Klara“ ist feste Vorgabe;
//       der Abgleich laufender Aufträge nennt den Kalender-Kandidaten (K1, K2, K3).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

interface Fundstelle {
  pfad: string;
  anker: string;
}

interface Eintrag {
  id: string;
  art: string;
  name: string;
  stand: "geliefert" | "kandidat" | "beauftragt";
  fundstellen?: Fundstelle[];
  zweig?: string;
  commit?: string;
  aa?: string;
  host?: string[];
  speicher?: string;
  geltung?: string;
  auftrag_id?: string;
  revision?: number;
}

const ORDNER = "docs/klara-setup-shortcuts";
const lies = (datei: string): string => readFileSync(repoPfad(`${ORDNER}/${datei}`), "utf8");

const liste = JSON.parse(lies("fundstellen.json")) as { eintraege: Eintrag[] };
const eintraege = liste.eintraege;
const ids = new Set(eintraege.map((e) => e.id));

describe("F1 · gelieferte Einträge sind im Quellcode belegt", () => {
  const geliefert = eintraege.filter((e) => e.stand === "geliefert");

  it("es gibt gelieferte Einstellungen, Aktionen, Kürzel und Hosts", () => {
    for (const art of ["einstellung", "aktion", "kuerzel", "host"]) {
      expect(
        geliefert.some((e) => e.art === art),
        art,
      ).toBe(true);
    }
  });

  for (const e of geliefert) {
    it(`${e.id} · ${e.name}`, () => {
      expect(e.fundstellen?.length ?? 0, `${e.id} ohne Fundstelle`).toBeGreaterThan(0);
      expect(e.host?.length ?? 0, `${e.id} ohne Hostkontext`).toBeGreaterThan(0);
      expect(e.speicher ?? "", `${e.id} ohne Speicherzuständigkeit`).not.toBe("");
      for (const f of e.fundstellen ?? []) {
        const pfad = repoPfad(f.pfad);
        expect(existsSync(pfad), `${e.id}: ${f.pfad} fehlt`).toBe(true);
        const inhalt = readFileSync(pfad, "utf8");
        expect(inhalt, `${e.id}: Anker fehlt in ${f.pfad}`).toContain(f.anker);
      }
    });
  }
});

describe("F2 · geliefert, Kandidat und beauftragt bleiben getrennt", () => {
  it("IDs sind eindeutig und jeder Stand ist einer der drei", () => {
    expect(ids.size).toBe(eintraege.length);
    for (const e of eintraege) {
      expect(["geliefert", "kandidat", "beauftragt"], e.id).toContain(e.stand);
    }
  });

  it("Kandidaten nennen Zweig und Commit und keine Fundstelle im Hauptstand", () => {
    const kandidaten = eintraege.filter((e) => e.stand === "kandidat");
    expect(kandidaten.length).toBeGreaterThan(0);
    for (const e of kandidaten) {
      expect(e.zweig ?? "", e.id).toMatch(/^codex\/auftrag-[0-9a-f]{20}$/);
      expect(e.commit ?? "", e.id).toMatch(/^[0-9a-f]{7,40}$/);
      expect(e.fundstellen, e.id).toBeUndefined();
    }
  });

  it("beauftragte Pakete sind genau AA-02 bis AA-05, ohne Code", () => {
    const beauftragt = eintraege.filter((e) => e.stand === "beauftragt");
    expect(beauftragt.map((e) => e.aa).sort()).toEqual(["AA-02", "AA-03", "AA-04", "AA-05"]);
    for (const e of beauftragt) {
      expect(e.fundstellen, e.id).toBeUndefined();
    }
  });
});

describe("F3 · Bestand, Integrationsplan und Entscheidungsvorlage liegen vor", () => {
  it("jede ID der Liste steht in BESTAND.md", () => {
    const bestand = lies("BESTAND.md");
    const fehlend = [...ids].filter((id) => !new RegExp(`\\b${id}\\b`).test(bestand));
    expect(fehlend).toEqual([]);
  });

  it("der Integrationsplan behandelt AA-02, AA-03 und AA-04", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    for (const aa of ["AA-02", "AA-03", "AA-04"]) {
      expect(plan).toMatch(new RegExp(`^## \\d\\. ${aa} `, "m"));
    }
  });

  it("die Entscheidungsvorlage stellt beide Optionen und bleibt offen", () => {
    const vorlage = lies("ENTSCHEIDUNG-SYSTEMWEIT.md");
    expect(vorlage).toContain("**Status: offen");
    expect(vorlage).toContain("A · nur innerhalb Klarwerks");
    expect(vorlage).toContain("B · zusätzlich systemweit");
  });
});

describe("F4 · der Plan setzt nur erfasste Einstellungen und Aktionen voraus", () => {
  for (const datei of ["INTEGRATIONSPLAN.md", "ENTSCHEIDUNG-SYSTEMWEIT.md"]) {
    it(datei, () => {
      const genannt = [...lies(datei).matchAll(/\b[EOATHCW]\d{2}\b/g)].map((m) => m[0]);
      expect(genannt.length).toBeGreaterThan(0);
      expect(genannt.filter((id) => !ids.has(id))).toEqual([]);
    });
  }

  it("die Kürzelaktionen des Plans sind gelieferte Aktionen", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    const abschnitt = plan.slice(plan.indexOf("## 2. AA-03"), plan.indexOf("## 3. AA-04"));
    const aktionen = [...abschnitt.matchAll(/\bA\d{2}\b/g)].map((m) => m[0]);
    expect(new Set(aktionen)).toEqual(new Set(["A01", "A02"]));
    for (const id of aktionen) {
      const e = eintraege.find((x) => x.id === id);
      expect(e?.art, id).toBe("aktion");
      expect(e?.stand, id).toBe("geliefert");
    }
  });
});

describe("F5 · Nacharbeit 1: Word, Hinweisaktionen, Bereichsname, laufende Aufträge", () => {
  const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");
  const TASKPANE_HTML = "apps/web/public/word-addin/taskpane.html";
  const TASKPANE_JS = "apps/web/public/word-addin/taskpane.js";
  const eintrag = (id: string): Eintrag => {
    const e = eintraege.find((x) => x.id === id);
    if (!e) {
      throw new Error(`${id} fehlt in fundstellen.json`);
    }
    return e;
  };
  const wordAnker = eintraege
    .filter((e) => e.id.startsWith("W") && e.stand === "geliefert")
    .flatMap((e) => (e.fundstellen ?? []).map((f) => ({ ...f, id: e.id })));

  it("jeder Schalter der Word-Einstellungsfläche ist als W-Eintrag erfasst", () => {
    const html = quelle(TASKPANE_HTML);
    const start = html.indexOf('<div id="kw-einstellungen"');
    const ende = html.indexOf('data-t="einstAdminKicker"', start);
    expect(start).toBeGreaterThan(-1);
    expect(ende).toBeGreaterThan(start);
    const flaeche = html.slice(start, ende);
    const schalter = [...flaeche.matchAll(/id="([^"]+)" role="switch"/g)].map((m) => m[1]);
    expect(schalter.length).toBeGreaterThanOrEqual(4);
    for (const id of [...schalter, "einst-sprache-zeile"]) {
      const erfasst = wordAnker.some((a) => a.pfad === TASKPANE_HTML && a.anker === `id="${id}"`);
      expect(erfasst, `Word-Einstellung #${id} fehlt im Bestand`).toBe(true);
    }
  });

  it("die Dokumentkennung ist von Anmeldung und Panelzustand getrennt", () => {
    expect(quelle(TASKPANE_JS)).toContain("Office.context.document.settings");
    const kennung = eintrag("W05");
    expect(kennung.geltung).toBe("dokument");
    expect(kennung.art).not.toBe("einstellung");
    expect(kennung.speicher ?? "").toContain("Word-Dokuments");
    for (const id of ["W01", "W02", "W03"]) {
      expect(eintrag(id).geltung, id).toBe("panelinstanz");
    }
    const host = eintrag("H03");
    expect(host.fundstellen?.some((f) => f.anker === "var officeSchluessel = null;")).toBe(true);
    expect(host.speicher ?? "").not.toMatch(/keine dauerhafte Ablage/);
    expect(lies("BESTAND.md")).not.toContain("speichert bewusst nichts dauerhaft");
    expect(lies("INTEGRATIONSPLAN.md")).not.toContain("Word ohne Einstellungen");
  });

  it("E06 bleibt über den vorhandenen Hinweisweg erreichbar, nicht über KlaraModusWahl", () => {
    const plan = lies("INTEGRATIONSPLAN.md");
    expect(plan).toContain("**Hinweisaktionen (E06).**");
    expect(plan).toContain("`POST /api/me/assistenz/eigeninitiative/hinweise`");
    expect(plan).not.toMatch(/\| Unterstützung \| E05, E06 \|/);
    expect(quelle("apps/web/src/components/klara-vorschau/KlaraVorschau.tsx")).toContain(
      "void legeHinweisAb(kontoId, h.schluessel, stand);",
    );
    expect(quelle("apps/web/src/api/assistenzEigeninitiative.ts")).toContain(
      '"/me/assistenz/eigeninitiative/hinweise"',
    );
  });

  it("„Klara“ ist feste Vorgabe und kein erneuter Entscheidungspunkt", () => {
    expect(lies("INTEGRATIONSPLAN.md")).toContain("Der Bereich heißt „Klara“");
    expect(lies("INTEGRATIONSPLAN.md")).not.toContain("Entscheidung nötig");
    expect(lies("ENTSCHEIDUNG-SYSTEMWEIT.md")).not.toContain("Bereichsname");
  });

  it("der Auftragsabgleich nennt Kalender, Palette, Navigation, Barrierefreiheit", () => {
    const bestand = lies("BESTAND.md");
    expect(bestand).toContain("### 6.1 Abgleich weiterer laufender und gelieferter Aufträge");
    expect(eintrag("C06").zweig).toBe("codex/auftrag-037bbf78aabef05890d7");
    for (const titel of [
      "Eigenen persönlichen Kalender ohne externen Dienst nutzbar machen",
      "Rollengerechte Befehlspalette und globale Schnellsuche anbieten",
      "Navigation, Logo und aktiven Bereich konsistent bedienen",
      "Dialoggrenzen, Tastaturfokus und Vorleseansagen einheitlich führen",
    ]) {
      expect(bestand, titel).toContain(titel);
    }
    expect(bestand).not.toContain("wurden hier nicht\ninhaltlich abgeglichen");
  });

  // Nacharbeit 2 (Bens Befund): der Abgleich gegen die Originalaufträge nennt je Kandidat
  // Auftragskennung und Revision samt Auswirkung; der Vorbehalt „steht noch aus“ ist entfallen.
  it("der Vertragsabgleich nennt je Kandidat Originalauftrag und Revision", () => {
    const bestand = lies("BESTAND.md");
    const start = bestand.indexOf("### 6.2 Vertragsabgleich mit den Originalaufträgen");
    expect(start).toBeGreaterThan(-1);
    const abschnitt = bestand.slice(start, bestand.indexOf("## 7.", start));
    expect(abschnitt).toContain("HISTORIE/nacharbeit-2/BEN/STREAM.jsonl");
    const kandidaten = eintraege.filter((e) => e.stand === "kandidat");
    expect(kandidaten.length).toBe(6);
    for (const e of kandidaten) {
      expect(e.auftrag_id ?? "", e.id).toMatch(/^produkt:\d{8}:[a-z0-9-]+$/);
      expect(Number.isInteger(e.revision), e.id).toBe(true);
      const ordner = (e.zweig ?? "").replace("codex/", "");
      const zeile = `| ${e.id} | \`${e.auftrag_id}\` · \`${ordner}\` | ${e.revision} |`;
      expect(abschnitt, e.id).toContain(zeile);
    }
    expect(bestand).not.toContain("steht noch aus und braucht Lesezugriff");
  });
});
