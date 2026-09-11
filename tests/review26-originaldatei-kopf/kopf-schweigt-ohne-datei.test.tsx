// @vitest-environment jsdom
// ================================================================================================
// JOB 3474 · REVIEW26 — DIE GEGENPROBE: OHNE ORIGINALDATEI BEHAUPTET DER KOPF KEINE.
// ================================================================================================
//
// Die naheliegende Übertreibung dieses Auftrags wäre, die Datei-Aussage IMMER anzuzeigen — als
// Leerfassung „Originaldatei · keine". Über einen Eintrag ohne Dateiimport wäre das eine Aussage
// ohne Gegenstand (Auftrag §5.3/§9): es gäbe nie einen Zustand, in dem sie etwas mitteilt, und der
// Kopf spräche über eine Sache, die es an diesem Eintrag gar nicht gibt.
//
// Diese Datei ist VOR und NACH der Änderung grün. Das ist ihr Zweck: sie hält die Aussage von
// `kopf-nennt-originaldatei.test.tsx` davon ab, durch „immer anzeigen" erschlichen zu werden.
// Ihre Tragfähigkeit ist an der Gegenprobe belegt (RUECKGABE: Knopf bedingungslos gerendert → F-N1
// wird rot).
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../apps/web/src/api/auth", () => ({
  authApi: {
    status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
    me: vi.fn(async () => ({ id: "u1", name: "Eva", email: "e@x.de", role: "admin" })),
    logout: vi.fn(async () => ({})),
  },
}));

vi.mock("../../apps/web/src/api/endpoints", () => {
  const leer = vi.fn(async () => []);
  return {
    endpoints: {
      ko: {
        get: vi.fn(async () => globalThis.__job3474Ko),
        list: vi.fn(async () => [globalThis.__job3474Ko]),
        versions: leer,
        evidence: leer,
        neighbors: vi.fn(async () => ({
          center: "ko-1",
          neighbors: [],
          excludedTags: [],
          limit: 8,
        })),
        act: vi.fn(async () => globalThis.__job3474Ko),
      },
      conflicts: { list: leer },
      duplicateSignal: { list: leer },
      audit: { list: leer },
      directory: { list: vi.fn(async () => [{ id: "u1", name: "Eva" }]) },
      lifecycle: { pending: leer, linked: leer },
      external: { policy: vi.fn(async () => ({ stage: "blocked", enabled: false })) },
      uploadLimits: {
        get: vi.fn(async () => ({ maxAttachments: 8, maxAttachmentBytes: 20000000 })),
      },
      reasoner: {
        status: vi.fn(async () => ({ active: false, mode: "off" })),
        config: vi.fn(async () => ({})),
        assist: vi.fn(async () => ({ text: "" })),
        assistPresets: leer,
        extract: vi.fn(async () => ({ points: [], note: null })),
        describeImage: vi.fn(async () => ({})),
      },
      aiCheck: { coverageSummary: vi.fn(async () => ({ total: 0 })) },
    },
  };
});

import i18n from "../../apps/web/src/i18n";
import { LANGER_TEXT, el, knopf, mount, suche, text, unmount } from "./lesen-harness";

/** Ein Bild im Body: eine `figure` ist KEINE Datei-Referenz (Auftrag §8.6 d). */
const BILD_IM_BODY =
  '<figure><img data-image-id="b1" src="/api/objects/bild-1/raw" alt="Ventil"></figure>' +
  '<figcaption data-image-id="b1">Ventil V2</figcaption>';

afterEach(() => {
  unmount();
  vi.clearAllMocks();
});

describe("JOB 3474 · ohne Datei-Referenz schweigt der Kopf über Dateien", () => {
  it("F-N1 · Bericht ohne `div.attachment`: kein Originaldatei-Knopf, keine Datei-Behauptung", async () => {
    await i18n.changeLanguage("de");
    await mount(LANGER_TEXT);
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    const kopf = text(el("bib-kopf-spruenge"));
    expect(kopf, "der Kopf spricht über eine Originaldatei, die es nicht gibt").not.toContain(
      "Originaldatei",
    );
    // Kalibrierung: der Kopf steht wirklich — die beiden alten Knöpfe sind da.
    expect(kopf).toContain(i18n.t("lib.lesen.sprung.quellenLeer"));
  });

  it("F-N2 · ohne Datei bleibt die alte, engere Leerfassung des Anhangknopfs unverändert", async () => {
    await i18n.changeLanguage("de");
    await mount(LANGER_TEXT);
    // Lieferung 4, Variante A: der Anhangknopf wird NUR dort qualifiziert, wo eine Datei im Text
    // hängt. Ohne Datei ist „Anhänge · keine" wahr und bleibt stehen.
    expect(text(knopf("bib-sprung-anhaenge"))).toBe(i18n.t("lib.lesen.sprung.anhaengeLeer"));
  });

  it("F-N3 · Bilder im Body sind keine Originaldateien", async () => {
    await i18n.changeLanguage("de");
    await mount(`${LANGER_TEXT}${BILD_IM_BODY}`);
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    // Kalibrierung: das Bild ist wirklich gezeichnet, der Fall misst kein leeres Blatt.
    expect(suche('[data-testid="bib-text"] img')).not.toBeNull();
  });

  it("F-N4 · ein Link auf eine FREMDE Adresse im Text macht keinen Kopfknopf", async () => {
    await i18n.changeLanguage("de");
    await mount(
      `${LANGER_TEXT}<div class="attachment"><a href="https://fremd.example/x">Fremd.docx</a></div>`,
    );
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    expect(text(el("bib-kopf-spruenge"))).not.toContain("Fremd.docx");
  });

  // ================================================================================================
  // RUNDE 2 · BENS GEGENPROBE, GEMOUNTET (Korrekturpflicht 2).
  // ================================================================================================
  //
  // Runde 1 las den Attributwert SUCHEND und nahm ein `href=` aus dem `title` als Adresse. Ben hat
  // an genau dieser Fläche gemessen, was daraus wurde: der Kopf zeigte „Originaldatei · Fremd.docx"
  // — eine Datei, die es nicht gibt, und ein Knopf, dessen Sprungziel im Text gar nicht existiert.
  // Der Fall überlebt `sanitizeHtml`, weil `title` am `<a>` erlaubter Freitext ist; deshalb steht er
  // hier an der ECHTEN Fläche und nicht nur als Modultest (dort: R12).
  it("F-N5 · BENS FALL: ein `href=` im `title` erzeugt keine Originaldatei-Aussage", async () => {
    await i18n.changeLanguage("de");
    const fremd =
      '<div class="attachment">\n' +
      '  <a title="Hinweis href=/api/objects/fake/raw "\n' +
      '     href="https://fremd.example/x">Fremd.docx</a>\n' +
      "</div>";
    await mount(`${LANGER_TEXT}${fremd}`);
    // Kalibrierung: der Fremdlink ist wirklich gezeichnet — der Fall misst kein leeres Blatt, und
    // der `title` hat den Sanitizer überlebt (sonst prüfte er einen entschärften Angriff).
    const anker = suche<HTMLAnchorElement>('[data-testid="bib-text"] .attachment a');
    expect(anker, "der Fremdlink steht gar nicht im Text").not.toBeNull();
    expect((anker as HTMLAnchorElement).getAttribute("href")).toBe("https://fremd.example/x");
    expect((anker as HTMLAnchorElement).getAttribute("title")).toContain(
      "href=/api/objects/fake/raw",
    );
    // Und der Kopf schweigt: kein Knopf, kein Dateiname, keine erfundene Object-Kennung.
    expect(suche('[data-testid="bib-sprung-originaldatei"]')).toBeNull();
    const kopf = text(el("bib-kopf-spruenge"));
    expect(kopf, "der Kopf behauptet eine Datei aus einem Attributtext").not.toContain(
      "Fremd.docx",
    );
    expect(kopf).not.toContain("Originaldatei");
    // Die alte, unqualifizierte Leerfassung gilt hier weiter — es hängt ja wirklich keine Datei.
    expect(text(knopf("bib-sprung-anhaenge"))).toBe(i18n.t("lib.lesen.sprung.anhaengeLeer"));
  });
});
