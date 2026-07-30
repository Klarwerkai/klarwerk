// ================================================================================================
// AUFTRAG-mega61 BLOCK B — WO DER BANNER HÄNGT, UND WO ER AUSDRÜCKLICH NICHT HÄNGT.
// ================================================================================================
//
// DIE KLICKPFADE stehen in `apps/web/src/legal/mega61-hinweisbanner.test.tsx` (Begründung für den
// Ort im Nachbarn mega61-rechtsseiten.test.tsx). Hier steht die STRUKTUR-Zusage, und sie ist eine
// eigene: Der Banner gehört in die Anwendungshülle — dieselbe Ebene wie Kopfzeile und
// Meldungsfläche — und ausdrücklich NICHT in den Torwächter.
//
// WARUM DAS EINE EIGENE ZUSAGE IST UND KEIN DETAIL: Der Anmeldeweg ist die empfindlichste Stelle
// des Produkts, und vor einem Nutzertermin ist jede Änderung daran ein Risiko. In der
// Anwendungshülle kann der Banner den Anmeldeweg baulich nicht beeinträchtigen — er erscheint erst,
// wenn die Anwendung schon läuft. Ein Klickpfad kann das nicht belegen; er sieht nur, was da ist,
// nicht, was gerade nicht kaputtgehen kann. Deshalb dieser Wächter über der Bauform.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");
const WEB = join("apps", "web", "src");

function lies(...teile: string[]): string {
  return readFileSync(join(WURZEL, ...teile), "utf8");
}

describe("mega61 B · der Banner sitzt in der Anwendungshülle", () => {
  it("die Hülle montiert ihn — auf BEIDEN Zuschnitten und auf der shell-losen Route", () => {
    const shell = lies(WEB, "shell", "AppShell.tsx");
    // Drei Rückgaben (/mobile, schmal, breit) — der Banner darf in keiner davon fehlen, sonst
    // gäbe es eine Bildschirmbreite, auf der die Pflichtinformation still verschwindet.
    expect(shell.split("<NoticeBanner").length - 1).toBe(3);
    expect(shell.split("<LegalFooter").length - 1).toBe(3);
  });

  it("der Torwächter trägt ihn NICHT — der Anmeldeweg bleibt unberührt", () => {
    const app = lies(WEB, "App.tsx");
    expect(app).not.toContain("NoticeBanner");
    // Die sechs Anmeldezustände bekommen den Hinweis als reinen TEXT, ohne Knöpfe: dort gibt es
    // noch kein Konto, an dem sich eine Kenntnisnahme vermerken ließe.
    const auth = lies(WEB, "auth", "AuthScreens.tsx");
    expect(auth).toContain("<NoticeText");
    expect(auth).not.toContain("<NoticeBanner");
  });

  it("die Kenntnisnahme wird SERVERSEITIG geführt — nicht im Browserspeicher", () => {
    // Der zirkuläre Fall, den Block C ausschließt: im Browserspeicher zu merken, dass jemand den
    // Hinweis ÜBER den Browserspeicher gelesen hat. Der einzige Browserspeicher-Zugriff dieser
    // Fläche ist der kurzlebige Merker für den Grund NACH einer Ablehnung (Block D).
    const banner = lies(WEB, "legal", "NoticeBanner.tsx");
    expect(banner).toContain("authApi.notice");
    expect(banner).toContain("authApi.acknowledgeNotice");
    expect(banner.split("localStorage").length - 1, "der Vermerk gehört ans Konto").toBe(0);
  });
});
