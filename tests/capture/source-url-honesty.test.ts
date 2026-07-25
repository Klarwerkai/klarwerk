// AUFTRAG-mega6 Block A (bens ROT 1): Die serverseitige http/https-Allowlist bleibt unverändert —
// sie ist richtig. Neu ist nur, dass die Oberfläche sie KENNT. Dieser Test pinnt genau das: das
// Frontend-Prädikat isSavableSourceUrl trifft für jede Eingabe dieselbe Entscheidung wie die
// tatsächliche Servernormalisierung an der Persistenzgrenze (CaptureService.createDraft). Läuft eine
// der beiden Seiten auseinander, kippt dieser Test — ein stiller Verlust kann nicht zurückkehren.
import { describe, expect, it } from "vitest";
import { isSavableSourceUrl, unsavableSourceUrls } from "../../apps/web/src/lib/koSource";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import { CaptureService } from "../../services/capture/src/service";

// Was der Server nach dem Speichern tatsächlich im URL-Feld stehen lässt.
async function persistedUrl(url: string): Promise<string> {
  const svc = new CaptureService({ repo: new InMemoryDraftRepo() });
  const draft = await svc.createDraft(
    { title: "T", sourceForm: { label: "Quelle", url, excerpt: "" } },
    "anna",
  );
  return draft.payload.sourceForm?.url ?? "";
}

const CASES = [
  // getippt, aber noch kein vollständiges Web-Schema → nicht speicherbar
  "www.beispiel",
  "www.beispiel.de/seite",
  "beispiel.de",
  "htt",
  "https:/",
  // aktive/fremde Schemata → nicht speicherbar (Sicherheitsentscheid, unverändert)
  "javascript:alert(1)",
  "data:text/html,<script>x</script>",
  "file:///etc/passwd",
  // vollständige Web-Adressen → speicherbar
  "https://example.org/norm",
  "http://example.org",
  "https://example.org/a?b=c#d",
];

describe("Block A: Frontend-Prädikat und Servernormalisierung entscheiden identisch", () => {
  for (const url of CASES) {
    it(`„${url}" — UI-Urteil deckt sich mit dem, was der Server wirklich speichert`, async () => {
      const stored = await persistedUrl(url);
      expect(isSavableSourceUrl(url)).toBe(stored === url.trim());
    });
  }

  it("leeres/whitespace-Feld gilt als speicherbar — es gibt nichts zu verlieren", () => {
    expect(isSavableSourceUrl("")).toBe(true);
    expect(isSavableSourceUrl("   ")).toBe(true);
  });
});

describe("Block A: unsavableSourceUrls sammelt Formular UND Warteliste", () => {
  it("nennt nur die nicht speicherbaren Adressen, dedupliziert", () => {
    expect(
      unsavableSourceUrls({ url: "www.beispiel.de" }, [
        { url: "https://example.org/ok" },
        { url: "javascript:alert(1)" },
        { url: "www.beispiel.de" },
        {},
      ]),
    ).toEqual(["www.beispiel.de", "javascript:alert(1)"]);
  });

  it("ist leer, wenn alles speicherbar ist — dann entsteht auch keine Grenze", () => {
    expect(unsavableSourceUrls({ url: "" }, [{ url: "https://example.org/ok" }])).toEqual([]);
  });

  it("kürzt eine sehr lange Adresse für die Anzeige, statt den Dialog zu sprengen", () => {
    const long = `x${"y".repeat(400)}`;
    const [shown] = unsavableSourceUrls({ url: long }, []);
    expect(shown).toHaveLength(81); // 80 Zeichen + Auslassungszeichen
    expect(shown?.endsWith("…")).toBe(true);
  });
});
