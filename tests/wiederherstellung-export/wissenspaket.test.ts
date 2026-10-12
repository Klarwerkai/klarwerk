// ================================================================================================
// produkt:20261010:poc-wiederherstellung-export · PV-01-04 / PV-01-05 — DAS WISSENSPAKET.
// ================================================================================================
//
// Der fiktive, zusammenhängende Bestand aus `bestand.ts` (zwei geschlossene Spaces, offener und
// vertraulicher Bestand, ein Beitrag mit zwei Fassungen, Anhang, Quelle, Verantwortung, Freigabe und
// Beziehungen) — dann exportieren fünf Rollen dasselbe Format `paket`, und das ZIP wird AUSSERHALB
// der Anwendung geöffnet (JSZip, wie jedes Entpackprogramm):
//   P1  Lesbar und zuordenbar: LIESMICH, MANIFEST, zuordnungen.csv; aktuelle und historische Fassung
//       unterscheidbar; Anhang Byte für Byte; Quelle → Anhangsdatei; Namen statt nur Kennungen.
//   P2  Jede Datei im Manifest trägt die SHA-256 ihres Inhalts im ZIP.
//   P3  Berechtigungsräume: Anna sieht Nord, Bert Süd — keiner den anderen, auch nicht über eine
//       Beziehung; die Rolle `viewer` nur Offenes; der Controller Vertrauliches, aber keinen fremden
//       Space; ohne Anmeldung gibt es nichts.
//   P4  Keine Zugangsdaten: keine Adresse, kein Kennwort, kein Token in irgendeiner Datei.
//   P5  Der Export steht als `library.export` mit Format `paket` in der Auditkette.
import { createHash } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  ANHANG,
  ANHANG_NAME,
  type App,
  type Bestand,
  GEHEIM_TITEL,
  KENNWORT,
  KONTEN,
  NORD_V1,
  NORD_V2,
  OFFEN_TITEL,
  type Paket,
  SPACE_NORD,
  SUED_TITEL,
  legeFiktivenBestand,
  paketVon,
} from "./bestand";

let services: ReturnType<typeof buildServices>;
let app: App;
let b: Bestand;

const titelIn = (p: Paket): string[] => p.manifest.beitraege.map((x) => x.titel).sort();

beforeAll(async () => {
  services = buildServices();
  app = buildApp(services);
  b = await legeFiktivenBestand(app);
}, 120_000);

describe("P1/P2 · das Paket ist außerhalb der Anwendung lesbar und seinen Quellen zuordenbar", () => {
  it("P1 · Fassungen unterscheidbar, Anhang Byte für Byte, Quelle → Datei, Namen statt Kennungen", async () => {
    const p = await paketVon(app, b.kopf.anna);
    for (const datei of ["LIESMICH.md", "MANIFEST.json", "zuordnungen.csv"]) {
      expect(p.texte.has(datei), datei).toBe(true);
    }
    const nord = p.manifest.beitraege.find((x) => x.kennung === b.nordId);
    expect(nord, "Annas Beitrag fehlt im Paket").toBeTruthy();
    if (!nord) {
      return;
    }
    // Fassungen: mindestens zwei, genau eine aktuell — und sie ist die Fassung des Beitrags.
    expect(nord.fassungen.length).toBeGreaterThanOrEqual(2);
    const aktuell = nord.fassungen.filter((f) => f.aktuell);
    expect(aktuell.map((f) => f.fassung)).toEqual([nord.aktuelleFassung]);
    const aktuellText = p.texte.get(aktuell[0]?.datei ?? "") ?? "";
    expect(aktuellText).toContain(`AKTUELLE FASSUNG ${nord.aktuelleFassung}`);
    expect(aktuellText).toContain(NORD_V2);
    const historisch = nord.fassungen.filter((f) => !f.aktuell).map((f) => p.texte.get(f.datei));
    expect(
      historisch.some((t) => t?.includes("HISTORISCHE FASSUNG") && t.includes(NORD_V1)),
      "die erste Inhaltsfassung steht als historisch im Paket",
    ).toBe(true);
    expect(historisch.every((t) => !t?.includes("AKTUELLE FASSUNG"))).toBe(true);

    // Anhang: Originalbytes, Prüfsumme, Zuordnung.
    expect(nord.anhaenge).toHaveLength(1);
    const anhang = nord.anhaenge[0];
    const bytes = await p.zip.file(anhang?.datei ?? "")?.async("nodebuffer");
    expect(bytes && Buffer.from(bytes).equals(ANHANG)).toBe(true);
    expect(anhang?.objektKennung).toBe(b.objektId);
    expect(anhang?.name).toBe(ANHANG_NAME);
    expect(anhang?.hochgeladenVon.name).toBe(KONTEN.anna.name);
    const quelle = nord.quellen.find((q) => q.bezeichnung === "Prüfprotokoll N-12");
    expect(quelle?.belegtDurchAnhang).toBe(anhang?.datei);

    // Verantwortung, Freigabe, Rechte — mit Namen.
    expect(nord.freigabe.status).toBe("validiert");
    expect(nord.verantwortung.verantwortlich?.name).toBe(KONTEN.anna.name);
    expect(nord.verantwortung.verantwortlicheRolle).toBe("Instandhaltungsleitung Nord (fiktiv)");
    expect(nord.autor.name).toBe(KONTEN.anna.name);
    expect(nord.rechte.space?.name).toBe(SPACE_NORD);
    expect(nord.rechte.vertraulichkeit).toBe("intern");

    // Lesbare Zuordnung: die CSV nennt Datei, Art, Titel und die Originalbezeichnung des Anhangs.
    const csv = p.texte.get("zuordnungen.csv") ?? "";
    expect(csv.split("\n")[0]).toBe("datei;art;beitrag;beitrag_kennung;fassung;quelle");
    expect(csv).toContain(`${anhang?.datei};anhang;`);
    expect(csv).toContain(ANHANG_NAME);
    expect(csv).toMatch(/;fassung_historisch;/);
    expect(csv).toMatch(/;fassung_aktuell;/);
    expect(p.texte.get(`${nord.ordner}/aktuell.md`)).toContain(SPACE_NORD);
    expect(p.texte.get("LIESMICH.md")).toContain("Was nicht drin ist");
  });

  it("P2 · jede Datei im Manifest trägt die SHA-256 ihres Inhalts", async () => {
    const p = await paketVon(app, b.kopf.anna);
    expect(p.manifest.dateien.length).toBeGreaterThan(5);
    for (const d of p.manifest.dateien) {
      const inhalt = await p.zip.file(d.datei)?.async("nodebuffer");
      expect(inhalt, d.datei).toBeTruthy();
      const echt = Buffer.from(inhalt ?? Buffer.alloc(0));
      expect(createHash("sha256").update(echt).digest("hex"), d.datei).toBe(d.sha256);
      expect(echt.length, d.datei).toBe(d.bytes);
    }
    // Und nichts im ZIP fehlt im Manifest (außer dem Manifest selbst).
    const gelistet = new Set(p.manifest.dateien.map((d) => d.datei));
    const imZip = Object.keys(p.zip.files).filter((n) => !p.zip.files[n]?.dir);
    expect(imZip.filter((n) => n !== "MANIFEST.json" && !gelistet.has(n))).toEqual([]);
  });
});

describe("P3 · getrennte Berechtigungsräume und eine unberechtigte Rolle", () => {
  it("Anna (Werk Nord) sieht Nord und Offenes — weder Süd noch Vertrauliches, auch nicht über eine Beziehung", async () => {
    const p = await paketVon(app, b.kopf.anna);
    const titel = titelIn(p);
    expect(titel).toContain(OFFEN_TITEL);
    expect(titel).not.toContain(SUED_TITEL);
    expect(titel).not.toContain(GEHEIM_TITEL);
    const nord = p.manifest.beitraege.find((x) => x.kennung === b.nordId);
    const ziele = nord?.beziehungen.map((r) => r.gegenstueck.kennung) ?? [];
    expect(ziele).toContain(b.offenId);
    expect(ziele).not.toContain(b.suedId);
    const zuOffen = nord?.beziehungen.find((r) => r.gegenstueck.kennung === b.offenId);
    expect(zuOffen?.gegenstueck.ordner, "die Beziehung zeigt auf den Ordner im Paket").toBeTruthy();
    for (const [name, text] of p.texte) {
      expect(text, name).not.toContain(SUED_TITEL);
      expect(text, name).not.toContain(GEHEIM_TITEL);
      expect(text, name).not.toContain(b.suedId);
    }
  });

  it("Bert (Werk Süd) sieht Süd und Offenes — nicht Nord, keinen Anhang aus Nord", async () => {
    const p = await paketVon(app, b.kopf.bert);
    const ids = p.manifest.beitraege.map((x) => x.kennung);
    expect(ids).toContain(b.suedId);
    expect(ids).toContain(b.offenId);
    expect(ids).not.toContain(b.nordId);
    for (const [name, text] of p.texte) {
      expect(text, name).not.toContain(NORD_V2);
      expect(text, name).not.toContain(b.objektId);
    }
    expect(p.zip.file(/\/anhaenge\//)).toEqual([]);
  });

  it("die Rolle viewer bekommt nur Offenes; der Controller Vertrauliches, aber keinen fremden Space", async () => {
    const vera = await paketVon(app, b.kopf.vera);
    expect(vera.manifest.beitraege.map((x) => x.kennung)).toEqual([b.offenId]);
    expect(vera.manifest.umfang.vertraulichEnthalten).toBe(false);
    const carl = await paketVon(app, b.kopf.carl);
    const ids = carl.manifest.beitraege.map((x) => x.kennung).sort();
    expect(ids).toEqual([b.offenId, b.geheimId].sort());
    expect(carl.manifest.umfang.vertraulichEnthalten).toBe(true);
  });

  it("ohne Anmeldung gibt es kein Paket", async () => {
    const res = await app.inject({ method: "GET", url: "/api/library/export?format=paket" });
    expect(res.statusCode).toBe(401);
    expect(String(res.headers["content-type"] ?? "")).not.toContain("application/zip");
  });
});

describe("P4/P5 · keine Zugangsdaten, und der Export ist belegt", () => {
  it("keine Adresse, kein Kennwort, kein Token in irgendeiner Datei", async () => {
    for (const wer of ["anna", "carl"] as const) {
      const p = await paketVon(app, b.kopf[wer]);
      const token = (b.kopf[wer].authorization ?? "").slice("Bearer ".length);
      expect(token.length).toBeGreaterThan(10);
      for (const [name, text] of p.texte) {
        expect(text, name).not.toContain("@example.test");
        expect(text, name).not.toContain(KENNWORT);
        expect(text, name).not.toContain(token);
      }
      expect(p.manifest.exportiertVon.name).toBe(KONTEN[wer].name);
    }
  });

  it("jeder Paketexport steht als library.export mit Format paket in der Auditkette", async () => {
    await paketVon(app, b.kopf.vera);
    const eintraege = await services.audit.list({ action: "library.export" });
    const pakete = eintraege.filter((e) => e.payload.format === "paket");
    expect(pakete.length).toBeGreaterThan(0);
    const letzter = pakete.reduce((a, e) => (e.seq > a.seq ? e : a));
    expect(letzter.actor).toBe(b.kennung.vera);
    expect(letzter.payload.koIds).toEqual([b.offenId]);
  });
});
