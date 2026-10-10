import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";

// B1/B1b/B2 (Pedi-UX-Fixes): Source-Inspektion (Muster capture-from-file) + i18n-Vollständigkeit.
// Reine statische Belege — keine DOM-Render-Abhängigkeit.
//
// JOB 3060 · H1: die Kopfzeile heißt jetzt Kopfband (shell/Kopfband.tsx); die drei Betriebs-Chips
// sind Zeilen im Zahnrad-Menü (shell/StatusZeilen.tsx). Die Zusagen B1 und B2 sind dieselben —
// nur der Ort, an dem sie gemessen werden, ist umgezogen.

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

describe("B1: Kopfband-Layout robust (keine Überlappung)", () => {
  const src = read("apps/web/src/shell/Kopfband.tsx");
  it("das Such-Formular hat min-w-0 (gibt bei Enge nach statt zu überlagern)", () => {
    expect(src).toMatch(/<form[\s\S]*?className="[^"]*\bmin-w-0\b/);
  });
  // WP-SAMMEL20-FIX (bens Fix 5, Viewport-Kante): der rechte Block ist nicht starr shrink-0 —
  // bei SEHR schmalen Breiten darf er selbst schrumpfen (min-w-0, shrink) statt aus dem Kopf zu
  // laufen. Die Suche gibt weiterhin ZUERST nach (min-w-0 im Formular).
  it("der rechte Block läuft bei schmalen Breiten nicht über (min-w-0/shrink)", () => {
    // FE-002: der rechte Block nimmt seit dem 26.09.2026 den Restplatz (`flex-1`) und fragt ihn
    // als Container ab; `min-w-0` bleibt — unter 1024 px sogar mit kleinerer Mindestbreite, damit
    // die Suche zur Lupe zurücktreten kann, statt überzulaufen (Messung: tests/fe002-kopfband/).
    expect(src).toMatch(/className="kw-kopfband-rechts ml-auto flex min-w-0 flex-1 [^"]*"/);
  });
});

describe("B1b: Mobile-Ansicht hat einen Rückweg zur Vollversion", () => {
  const src = read("apps/web/src/pages/Mobile.tsx");
  // WP-SAMMEL20-FIX (bens Fix 4): der Rückweg ist kein harter Link auf /start mehr — er läuft
  // durch den NavGuard und führt zur VORHERIGEN Route (state.from) zurück; HOME_ROUTE bleibt nur
  // der Fallback für den Direkteinstieg ohne Absprungpunkt.
  it("rendert den toDesktop-Rückweg über den NavGuard zur vorherigen Route (HOME_ROUTE nur Fallback)", () => {
    expect(src).toContain("guard(() => navigate(backTo))");
    expect(src).toContain("?? HOME_ROUTE");
    expect(src).toContain("topbar.toDesktop");
    expect(src).not.toContain("to={HOME_ROUTE}");
  });
  it("topbar.toDesktop ist in DE/EN/NL vorhanden", () => {
    for (const lng of ["de", "en", "nl"]) {
      expect(
        String(i18n.getResource(lng, "translation", "topbar.toDesktop") ?? "").length,
        lng,
      ).toBeGreaterThan(0);
    }
  });
  // JOB 3060 · H1: der Hinweg nach /mobile ist die Zeile „Mobil“ im Konto-Menü — weiterhin mit
  // der aktuellen Route als Absprungpunkt (state.from), damit der Rückweg dorthin zurückführt.
  it("der Hinweg (Konto-Menü „Mobil“) merkt sich die aktuelle Route als Absprungpunkt", () => {
    const konto = read("apps/web/src/shell/KontoMenue.tsx");
    expect(konto).toContain('navigate("/mobile", { state: { from:');
  });
});

describe("B2: KI-Zeile zeigt den Modus, Details nur im Tooltip", () => {
  const src = read("apps/web/src/shell/StatusZeilen.tsx");
  it("die Zeile rendert KEINE DSGVO-Aussage mehr — weder sichtbar noch im Tooltip (R-0599)", () => {
    // Das alte Pillen-Subtitle-Muster „· {t(status.countryKey)} · {t(status.dsgvoKey)}“ ist entfernt.
    expect(src).not.toContain("· {t(status.countryKey)} · {t(status.dsgvoKey)}");
    // R-0599 (Auftrag ki-modus-wahrheit): bis hierher verlangte dieser Fall die Zeichenfolge
    // „status.countryKey && status.dsgvoKey" — also dass der Tooltip die DSGVO-Aussage trägt. Sie ist
    // gestrichen, weil sie sich aus Land und Modellname nicht ableiten lässt. Der Tooltip setzt sich
    // jetzt aus Hinweis (Betriebsort/Datenfluss), Anbieter, Herkunft und offenen Prüfungen zusammen.
    expect(src).toContain("title={tooltip}");
    expect(src).not.toContain("dsgvoKey");
    expect(src).not.toContain("dsgvoConfirm");
    expect(src).toContain("status.herkunft");
    expect(src).toContain("status.offenePruefungenKey");
  });

  it("die sichtbaren Kurz-Labels sagen sachlich, WO die KI rechnet, DE/EN/NL", () => {
    // AUFTRAG-mega51 BLOCK G1: die sichtbaren Kurz-Labels nannten einen MODUS („KI-Modus:
    // Cloud"); gemeint ist der ORT, an dem gerechnet wird. Für Natascha sagt „Modus“ nichts.
    // Die Zusage dieses Pins ist unverändert — sachlich, ohne grelles „Externe KI/DSGVO“.
    expect(String(i18n.getResource("de", "translation", "topbar.kiExternal"))).toBe(
      "KI rechnet in der Cloud",
    );
    expect(String(i18n.getResource("de", "translation", "topbar.kiInternal"))).toBe(
      "KI rechnet im eigenen Haus",
    );
    expect(String(i18n.getResource("en", "translation", "topbar.kiExternal"))).toBe(
      "AI runs in the cloud",
    );
    expect(String(i18n.getResource("nl", "translation", "topbar.kiInternal"))).toBe(
      "AI rekent in eigen huis",
    );
    // Kein grelles „Externe KI“/„DSGVO: nein“ mehr im sichtbaren Label.
    expect(String(i18n.getResource("de", "translation", "topbar.kiExternal"))).not.toContain(
      "Externe",
    );
  });

  // R-0599: die EHRLICHKEIT bleibt, nur in belegbarer Form — statt „DSGVO: nein" nennt der Hinweis
  // Betriebsort und Datenfluss, und die nicht hinterlegten Punkte stehen als offene Prüfung da.
  it("die EHRLICHKEIT bleibt: Hinweis nennt Betriebsort/Datenfluss und die offenen Prüfungen", () => {
    const hinweis = String(i18n.getResource("de", "translation", "kilage.kopf.hinweisExtern"));
    expect(hinweis).toContain("Betriebsort");
    expect(hinweis).toContain("Datenfluss");
    expect(hinweis).not.toMatch(/DSGVO/);
    const offen = String(i18n.getResource("de", "translation", "kilage.kopf.offenePruefungen"));
    expect(offen).toMatch(/Auftragsverarbeitung.*Unterauftragnehmer.*Trainingsausschluss/);
  });
});
