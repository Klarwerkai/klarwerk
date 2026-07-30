// ================================================================================================
// AUFTRAG-mega61 BLOCK B — DER SAMMLER ÜBER DEN WORTLAUT DES BANNERS.
// ================================================================================================
//
// DIE ZUSAGE, DIE ER DECKT, IST EINE RECHTLICHE: In den Bannertexten kommen die Wörter
// „Zustimmung" und „Einwilligung" NICHT vor.
//
// WARUM DAS KEIN GESCHMACK IST: Eine Einwilligung muss freiwillig sein. Wer sie verweigert, darf
// dadurch keinen Nachteil haben. Hier ist das anders — ohne Sitzungscookie ist eine angemeldete
// Nutzung technisch unmöglich, die Ablehnung beendet also die Sitzung. Nennte man die Auswahl
// trotzdem „Zustimmung", entstünde eine SCHEINEINWILLIGUNG: eine Rechtsgrundlage, die keine ist.
// Sie wäre schlechter als gar keine, weil sie Sicherheit vortäuscht, wo keine ist. Was hier
// stattfindet, ist eine KENNTNISNAHME — und die trägt.
//
// Nach der Orientierungshilfe der Aufsichtsbehörden ist ohnehin praktisch alles, was diese
// Anwendung speichert, einwilligungsfrei (Authentifizierung, Werte ohne Kennung, Warenkorbfall).
// Der Banner MUSS also gar keine Einwilligung einholen — er informiert.
//
// Der Sammler prüft alle drei Sprachen, denn eine Übersetzung ist genauso ein Rechtstext wie das
// Original. Er prüft über die BAUFORM: JEDER Schlüssel unter `notice.` in JEDER Sprache.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const quelle = readFileSync(join(__dirname, "..", "..", "apps", "web", "src", "i18n.ts"), "utf8");

function objekt(marker: string): Record<string, string> {
  const start = quelle.indexOf(marker);
  if (start < 0) {
    throw new Error(`Marker nicht gefunden: ${marker}`);
  }
  const auf = quelle.indexOf("{", start);
  const zu = quelle.indexOf("\n};", auf);
  return new Function(`return (${quelle.slice(auf, zu + 2)})`)() as Record<string, string>;
}

const SPRACHEN: Record<string, Record<string, string>> = {
  de: objekt("const de = {"),
  en: objekt("const en: typeof de = {"),
  nl: objekt("const nl: typeof de = {"),
};

// Die verbotenen Wörter je Sprache — samt der Wortstämme, damit auch „einwilligen",
// „zugestimmt", „consented" oder „toestemming" auffallen und nicht nur die Grundform.
const VERBOTEN: Record<string, readonly string[]> = {
  de: ["zustimm", "einwillig", "einverständnis", "akzeptier"],
  en: ["consent", "agree to", "i agree", "accept all"],
  nl: ["toestemming", "instemming", "akkoord gaan"],
};

describe("mega61 B · der Sammler über den Wortlaut des Hinweisbanners", () => {
  it("die Erhebung greift überhaupt", () => {
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      const bannerSchluessel = Object.keys(texte).filter((k) => k.startsWith("notice."));
      expect(bannerSchluessel.length, sprache).toBeGreaterThan(8);
      // Kalibrierung: das Muster findet ein verbotenes Wort, wenn es dasteht.
      const probe = "Bitte geben Sie Ihre Zustimmung.";
      expect(
        (VERBOTEN.de ?? []).some((wort) => probe.toLowerCase().includes(wort)),
        "das Muster erkennt ein verbotenes Wort nicht",
      ).toBe(true);
    }
  });

  it("KEIN Bannertext spricht von Zustimmung oder Einwilligung — in keiner der drei Sprachen", () => {
    const verstoesse: string[] = [];
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      for (const [schluessel, wert] of Object.entries(texte)) {
        if (!schluessel.startsWith("notice.")) {
          continue;
        }
        for (const wort of VERBOTEN[sprache] ?? []) {
          if (wert.toLowerCase().includes(wort)) {
            verstoesse.push(`${sprache}:${schluessel} enthält „${wort}“`);
          }
        }
      }
    }
    expect(verstoesse).toEqual([]);
  });

  it("die Quittierung heißt in allen drei Sprachen nach Kenntnisnahme, nicht nach Zustimmung", () => {
    // Positiv-Probe: der Knopf sagt, was wirklich passiert. Ohne sie wäre der Test oben auch dann
    // grün, wenn jemand den Knopf ersatzlos striche.
    const erwartet: Record<string, string> = {
      de: "Verstanden",
      en: "Understood",
      nl: "Begrepen",
    };
    for (const [sprache, texte] of Object.entries(SPRACHEN)) {
      expect(texte["notice.banner.ack"], sprache).toContain(erwartet[sprache]);
    }
  });
});
