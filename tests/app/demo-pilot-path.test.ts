import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  DEMO_PILOT_PATH,
  DEMO_VALUE,
  type DemoSurface,
  demoHref,
  demoPilotPath,
  demoSurfaceBanner,
  isDemoContext,
  withDemo,
} from "../../apps/web/src/lib/demoPilotPath";

// SCRUM-290: kompakter Demo-/Pilotpfad Start → Ask → Library/KO-Detail → Validation.
describe("SCRUM-290: demoPilotPath", () => {
  it("führt in 3 Schritten Ask → Library → Validation (nur vorhandene Routen)", () => {
    const steps = demoPilotPath();
    expect(steps.map((s) => s.id)).toEqual(["ask", "library", "validation"]);
    expect(steps.map((s) => s.n)).toEqual([1, 2, 3]);
  });

  it("Schritt 1 (Ask) ist quellengebunden via demo-sicherer Startfrage (?q=, kein Auto-Submit)", () => {
    const ask = DEMO_PILOT_PATH[0];
    expect(ask?.id).toBe("ask");
    expect(ask?.to.startsWith("/fragen?q=")).toBe(true);
    // demo-sicher: trifft validiertes Seed-Wissen (Ventil X / Überdruck) → quellengebunden, keine Lücke.
    expect(decodeURIComponent(ask?.to ?? "")).toContain("Ventil X bei Überdruck");
  });

  it("Schritt 2/3 zeigen Wissensbestand und Validierung über vorhandene Routen", () => {
    expect(DEMO_PILOT_PATH[1]?.to.split("?")[0]).toBe("/bibliothek");
    expect(DEMO_PILOT_PATH[2]?.to.split("?")[0]).toBe("/validierung");
  });

  it("SCRUM-291: jeder Schritt trägt den Demo-Kontext (?demo=stage1) weiter", () => {
    for (const s of DEMO_PILOT_PATH) {
      expect(s.to).toContain(`demo=${DEMO_VALUE}`);
    }
  });

  it("nutzt ausschließlich vorhandene Routen (keine neue Navigation)", () => {
    const allowed = new Set(["/bibliothek", "/validierung"]);
    for (const s of DEMO_PILOT_PATH) {
      const base = s.to.split("?")[0] ?? s.to;
      expect(base === "/fragen" || allowed.has(base)).toBe(true);
    }
  });

  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("i18n DE/EN: jeder Schritt hat nicht-leere Label/Beschreibung + Karten-Titel", () => {
    for (const lng of ["de", "en"]) {
      expect(text(lng, "demo.title").length).toBeGreaterThan(0);
      expect(text(lng, "demo.subtitle").length).toBeGreaterThan(0);
      for (const s of DEMO_PILOT_PATH) {
        expect(text(lng, s.labelKey).length).toBeGreaterThan(0);
        expect(text(lng, s.descKey).length).toBeGreaterThan(0);
      }
    }
  });

  it("i18n macht den Knowledge-OS-Kern sichtbar: quellengebunden, Status/Trust, Validierung", () => {
    expect(text("de", "demo.ask.desc")).toContain("quellengebunden");
    expect(text("de", "demo.library.desc")).toContain("status");
    expect(text("de", "demo.validation.desc")).toContain("validierung");
    expect(text("en", "demo.ask.desc")).toContain("source-bound");
    expect(text("en", "demo.validation.desc")).toContain("validation");
  });
});

// SCRUM-291: Demo-Kontext auf den Zielseiten wiedererkennbar (Query-Param + Banner).
describe("SCRUM-291: Demo-Kontext (withDemo/isDemoContext/demoSurfaceBanner)", () => {
  it("withDemo hängt ?demo=stage1 an und bewahrt eine bestehende Query", () => {
    expect(withDemo("/bibliothek")).toBe("/bibliothek?demo=stage1");
    expect(withDemo("/fragen?q=Ventil")).toBe("/fragen?q=Ventil&demo=stage1");
    expect(withDemo("/fragen?q=Ventil&demo=stage1")).toBe("/fragen?q=Ventil&demo=stage1");
  });

  it("isDemoContext erkennt nur den exakten Demo-Wert (normale Nutzung bleibt unberührt)", () => {
    expect(isDemoContext(new URLSearchParams("demo=stage1"))).toBe(true);
    expect(isDemoContext(new URLSearchParams("demo=x"))).toBe(false);
    expect(isDemoContext(new URLSearchParams(""))).toBe(false);
    expect(isDemoContext(new URLSearchParams("q=Ventil"))).toBe(false);
  });

  const surfaces: DemoSurface[] = ["ask", "library", "validation"];
  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("liefert je Zielseite eine Banner-Struktur mit korrekter Schrittnummer", () => {
    expect(surfaces.map((s) => demoSurfaceBanner(s).n)).toEqual([1, 2, 3]);
    for (const s of surfaces) {
      const b = demoSurfaceBanner(s);
      expect(b.surface).toBe(s);
      expect(b.titleKey.length).toBeGreaterThan(0);
      expect(b.bodyKey.length).toBeGreaterThan(0);
    }
  });

  it("nächster Schritt (Ask→Library, Library→Validation) trägt den Demo-Kontext weiter; Validation endet", () => {
    expect(demoSurfaceBanner("ask").next?.to).toBe("/bibliothek?demo=stage1");
    expect(demoSurfaceBanner("library").next?.to).toBe("/validierung?demo=stage1");
    expect(demoSurfaceBanner("validation").next).toBeUndefined();
  });

  it("Banner-i18n in DE/EN vorhanden (Titel/Body je Seite + Tag)", () => {
    for (const lng of ["de", "en"]) {
      expect(text(lng, "demo.banner.tag").length).toBeGreaterThan(0);
      for (const s of surfaces) {
        const b = demoSurfaceBanner(s);
        expect(text(lng, b.titleKey).length).toBeGreaterThan(0);
        expect(text(lng, b.bodyKey).length).toBeGreaterThan(0);
      }
    }
  });
});

// SCRUM-294: Use-Fluss Library → KO-Detail → Ask im Demo-Kontext sichtbar führen.
describe("SCRUM-294: KO-Detail-Surface + demoHref-Propagierung", () => {
  const text = (lng: string, key: string) =>
    String(i18n.getResource(lng, "translation", key) ?? "").toLowerCase();

  it("KO-Detail ist eine Demo-Surface mit eigenem Banner (kein statischer next-Link)", () => {
    const detail = demoSurfaceBanner("detail");
    expect(detail.surface).toBe("detail");
    expect(detail.titleKey).toBe("demo.banner.detail.title");
    expect(detail.bodyKey).toBe("demo.banner.detail.body");
    expect(detail.next).toBeUndefined(); // KO-ID dynamisch → kein statischer Demo-Link
  });

  it("demoHref trägt den Demo-Kontext NUR im Demo-Kontext weiter (sonst unverändert)", () => {
    const demo = new URLSearchParams("demo=stage1");
    const normal = new URLSearchParams("");
    // Library → KO-Detail
    expect(demoHref("/wissen/ko-7", demo)).toBe("/wissen/ko-7?demo=stage1");
    expect(demoHref("/wissen/ko-7", normal)).toBe("/wissen/ko-7");
    // KO-Detail → Ask (bestehende Query bleibt erhalten)
    expect(demoHref("/fragen?q=Ventil", demo)).toBe("/fragen?q=Ventil&demo=stage1");
    expect(demoHref("/fragen?q=Ventil", normal)).toBe("/fragen?q=Ventil");
  });

  it("demoHref dedupliziert einen bereits vorhandenen Demo-Kontext (kein Doppel-Parameter)", () => {
    const demo = new URLSearchParams("demo=stage1");
    expect(demoHref("/bibliothek?demo=stage1", demo)).toBe("/bibliothek?demo=stage1");
  });

  it("i18n DE/EN für KO-Detail-Banner vorhanden und ehrlich (quellengebunden, kein Auto-Gesichert)", () => {
    expect(text("de", "demo.banner.detail.title").length).toBeGreaterThan(0);
    expect(text("de", "demo.banner.detail.body")).toContain("quellengebunden");
    expect(text("de", "demo.banner.detail.body")).toContain("automatisch gesichert");
    expect(text("en", "demo.banner.detail.body")).toContain("source-bound");
  });
});
