import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { aufbewahrungsangabenAusEnv } from "../../services/app/src/aufbewahrungsangaben";
import {
  erzeugeVerarbeitungsverzeichnis,
  verzeichnisAlsMarkdown,
} from "../../services/app/src/dateninventar";
import {
  GedaechtnisDienst,
  InMemoryGedaechtnisRepo,
  wirksamBis,
} from "../../services/app/src/interaktionsgedaechtnis";
import {
  leseProtokollFristTage,
  pflegeProtokolle,
  starteProtokollPflege,
} from "../../services/app/src/protokoll-frist";
import {
  berichteDockerProtokolle,
  pflegeDockerProtokolle,
} from "../../services/app/src/protokoll-frist-docker";
const TAG = 86400000;
const START = Date.parse("2026-10-20T12:00:00Z");
describe("P10 · getrennte vorhandene Zwecke und begrenzte Ausnahmen", () => {
  it("bewahrt14/90-Standards, trennt Verantwortung/Begründung und exportiert unbekannte Nachweisfrist ehrlich", () => {
    const a = aufbewahrungsangabenAusEnv({
      KLARWERK_DIAGNOSE_VERANTWORTLICH: "Fiktiv Betrieb",
      KLARWERK_SICHERHEIT_VERANTWORTLICH: "Fiktiv Sicherheit",
      KLARWERK_AUDIT_VERANTWORTLICH: "Fiktiv Nachweis",
      KLARWERK_AUDIT_BEGRUENDUNG: "Fiktive technische Integritätsprüfung",
    });
    expect(a.map((x) => x.zweck)).toEqual(["diagnose", "sicherheit", "audit", "privatverlauf"]);
    expect(a[0]?.fristTage).toBe(14);
    expect(a[3]?.fristTage).toBe(90);
    expect(a[1]?.fristTage).toBe(null);
    expect(a[2]?.fachlicheFestlegungOffen).toBe(true);
    expect(a[1]?.verantwortlich).not.toBe(a[2]?.verantwortlich);
    const v = erzeugeVerarbeitungsverzeichnis(
      {
        modellAnbieter: [],
        lokalesModell: false,
        externeSuche: false,
        mailVersand: false,
        aufbewahrung: a,
      },
      new Date(START),
    );
    expect(v.aufbewahrung).toEqual(a);
    expect(verzeichnisAlsMarkdown(v)).toContain("Keine Zahlenfrist festgelegt.");
    expect(verzeichnisAlsMarkdown(v)).toContain("Fiktiv Sicherheit");
    expect(() => aufbewahrungsangabenAusEnv({ KLARWERK_AUDIT_FRIST_TAGE: "7" })).toThrow(
      "Nachweiskette",
    );
    for (const s of ["0", "-1", "3.5", "foo", "Infinity", "99999999999999999999"])
      expect(() => leseProtokollFristTage(s)).toThrow();
    expect(leseProtokollFristTage(undefined)).toBe(14);
  });
  it("eine konfigurierte Diagnosefrist wirkt im vorhandenen Dateilauf tatsächlich und verändert fremde Zwecke nicht", async () => {
    const dir = mkdtempSync(join(tmpdir(), "e-p10-datei-"));
    try {
      const zeit = new Date(START - 8 * TAG).toISOString();
      const log = join(dir, "alt.log");
      writeFileSync(log, JSON.stringify({ time: zeit, msg: "fiktiv" }));
      writeFileSync(join(dir, "sicherheit.nachweis"), "Fiktiver getrennter Nachweis");
      const r = pflegeProtokolle({ datei: join(dir, "server.log"), jetzt: START, fristTage: 7 });
      expect(r.geloescht).toContain("alt.log");
      expect(existsSync(log)).toBe(false);
      expect(existsSync(join(dir, "sicherheit.nachweis"))).toBe(true);
      writeFileSync(log, JSON.stringify({ time: zeit }));
      const s = starteProtokollPflege({
        datei: join(dir, "server.log"),
        jetzt: () => START,
        fristTage: 7,
      });
      await Promise.resolve();
      s?.stop();
      expect(existsSync(log)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("Dockerbericht und vorhandene Diagnoseordnerpflege wenden dieselbe konfigurierte Frist an, ohne Host-/Containerzugriff", () => {
    const dir = mkdtempSync(join(tmpdir(), "e-p10-diagnose-"));
    try {
      const d = join(dir, "fiktiv.txt");
      writeFileSync(d, JSON.stringify({ time: new Date(START - 8 * TAG).toISOString() }));
      const vor = berichteDockerProtokolle({
        ordner: join(dir, "kein-containerbestand"),
        auswahl: { label: "fiktiv", wert: "ja" },
        diagnoseordner: dir,
        jetzt: START,
        fristTage: 7,
      });
      expect(vor.diagnose.fristBestaetigt).toBe(false);
      const r = pflegeDockerProtokolle({
        ordner: join(dir, "kein-containerbestand"),
        auswahl: { label: "fiktiv", wert: "ja" },
        diagnoseordner: dir,
        jetzt: START,
        fristTage: 7,
      });
      expect(r.diagnose).toEqual(["fiktiv.txt"]);
      expect(
        berichteDockerProtokolle({
          ordner: join(dir, "kein-containerbestand"),
          auswahl: { label: "fiktiv", wert: "ja" },
          diagnoseordner: dir,
          jetzt: START,
          fristTage: 7,
        }).diagnose.fristBestaetigt,
      ).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
  it("eine begründete Ausnahme übersteht die reguläre Frist, endet wirklich und ist jederzeit selbst löschbar", async () => {
    let jetzt = START;
    const repo = new InMemoryGedaechtnisRepo();
    const d = new GedaechtnisDienst({ repo, jetzt: () => jetzt });
    const e = await d.merken("anna", {
      art: "vorliebe",
      inhalt: "Fiktive private Präferenz",
      aufbewahrungTage: 30,
    });
    const ende = START + 40 * TAG;
    for (const a of [
      { bis: new Date(ende).toISOString(), begruendung: "" },
      { bis: "unbekannt", begruendung: "Grund" },
      { bis: new Date(START + 366 * TAG).toISOString(), begruendung: "Grund" },
    ])
      await expect(
        d.aendere("anna", e.id, { fassung: 1, inhalt: e.inhalt, aufbewahrungAusnahme: a }),
      ).rejects.toMatchObject({ status: 400 });
    const n = await d.aendere("anna", e.id, {
      fassung: 1,
      inhalt: e.inhalt,
      aufbewahrungAusnahme: {
        bis: new Date(ende).toISOString(),
        begruendung: "Fiktive laufende Klärung",
        verantwortlich: "fremd",
      },
    });
    expect(n.aufbewahrungAusnahme?.verantwortlich).toBe("anna");
    expect(wirksamBis(n)).toBe(new Date(ende).toISOString());
    jetzt = START + 31 * TAG;
    expect(await d.raeumeAbgelaufeneAuf()).toBe(0);
    expect(await d.eigene("anna")).toHaveLength(1);
    expect(await d.eigene("bert")).toEqual([]);
    jetzt = ende;
    expect(await d.eigene("anna")).toEqual([]);
    expect(await d.raeumeAbgelaufeneAuf()).toBe(1);
    expect(await repo.anzahl("anna", new Date(START).toISOString())).toBe(0);
    jetzt = START;
    const x = await d.merken("anna", {
      art: "vorliebe",
      inhalt: "Fiktiv löschbar",
      aufbewahrungTage: 30,
    });
    await d.aendere("anna", x.id, {
      fassung: 1,
      inhalt: x.inhalt,
      aufbewahrungAusnahme: { bis: new Date(ende).toISOString(), begruendung: "Fiktiver Grund" },
    });
    expect(await d.vergessen("anna", x.id)).toBe(true);
  });
});
