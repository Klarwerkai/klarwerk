// ================================================================================================
// UX-08 · QUELLENHINWEIS-HÄLFTE — die UX08-Texte nennen den Weg, den die Fläche wirklich hat.
// ================================================================================================
//
// Der Browserlauf daneben (`quellenhinweis-weg-chromium.test.ts`) fährt den Weg an der gebauten
// Fläche. Er erreicht aber nur die beiden Hinweise, die OHNE einen Fehlschlag dastehen
// (`ext.attachBlocked`, `ext.gate.how`); `capture.sourceMissingNext` erscheint erst beim Erfassen.
// Diese Datei hält alle drei UX08-Texte fest — gegen die Namen, die Menü, Seite und Reiter WIRKLICH
// tragen, gelesen aus derselben Quelle wie die Fläche, nicht abgeschrieben.
//
// UMFANG: beauftragt sind ausschliesslich die Texte in `apps/web/src/texte/ux08.ts`. Der Katalog
// trägt den alten Weg danach noch in genau EINEM Schlüssel ausserhalb dieses Moduls
// (`xtr.append.blockedByStage`, Ablehnung beim Übernehmen). Er ist hier nicht stillschweigend
// ausgeklammert, sondern als Bestand festgehalten: taucht der alte Weg in einem WEITEREN Text auf,
// oder verschwindet er dort, wird der Fall rot und muss bewusst nachgeführt werden.
import { describe, expect, it } from "vitest";
import { ALL_ITEMS, anzeigeNameKey } from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";
import { ADMIN_DETAILS, ADMIN_SECTIONS } from "../../apps/web/src/lib/adminSections";
import ux08 from "../../apps/web/src/texte/ux08";

const SPRACHEN = ["de", "en", "nl"] as const;
type Sprache = (typeof SPRACHEN)[number];

const UX08_TEXTE = ["ext.attachBlocked", "ext.gate.how", "capture.sourceMissingNext"] as const;

/** Der frühere Weg — Gegenprobe. */
const ALTER_WEG: Record<Sprache, string> = {
  de: "Verwaltung → Externes Wissen",
  en: "Administration → External knowledge",
  nl: "Beheer → Externe kennis",
};

/** Wen der Satz anspricht: den Administrator, nicht den Lesenden selbst. */
const ADMINISTRATOR: Record<Sprache, string> = {
  de: "ein administrator",
  en: "an administrator",
  nl: "een beheerder",
};

/** Die drei Stationen, aus den Quellen gelesen, die auch Menü, Seite und Reiter benutzen. */
function weg(sprache: Sprache): string {
  const t = i18n.getFixedT(sprache);
  const ziel = ADMIN_DETAILS.find((d) => d.id === "kiExtern");
  const reiter = ADMIN_SECTIONS.find((s) => s.id === ziel?.section);
  if (!ziel || !reiter) {
    throw new Error("UX-08: das Detailziel „kiExtern“ oder sein Reiter fehlt");
  }
  return [t("einst.titel"), t(reiter.labelKey), t(ziel.labelKey)].join(" → ");
}

function bundle(sprache: Sprache): Record<string, string> {
  return i18n.getResourceBundle(sprache, "translation") as Record<string, string>;
}

describe("UX-08 · die UX08-Texte nennen Einstellungen → KI → Externe Wissensabfrage", () => {
  it("der erste Schritt heisst im Zahnrad-Menü genauso wie die Seite, auf die er führt", () => {
    const einstellungen = ALL_ITEMS.find((i) => i.path === "/admin");
    expect(einstellungen).toBeDefined();
    for (const sprache of SPRACHEN) {
      const t = i18n.getFixedT(sprache);
      expect(t(anzeigeNameKey(einstellungen as (typeof ALL_ITEMS)[number])), sprache).toBe(
        t("einst.titel"),
      );
    }
  });

  it("das Ziel liegt im Reiter KI, und seine Zeile heisst wie die Detailkarte", () => {
    const ziel = ADMIN_DETAILS.find((d) => d.id === "kiExtern");
    expect(ziel?.section).toBe("ki");
    expect(ziel?.labelKey).toBe("adm.ext.title");
  });

  it("der Weg ist je Sprache genau dieser — keine Station verrutscht", () => {
    expect(weg("de")).toBe("Einstellungen → KI → Externe Wissensabfrage");
    expect(weg("en")).toBe("Settings → AI → External knowledge");
    expect(weg("nl")).toBe("Instellingen → AI → Externe kennisopvraag");
  });

  for (const sprache of SPRACHEN) {
    it(`${sprache}: jeder UX08-Text nennt den vollständigen Weg, nicht den alten, und spricht den Administrator an`, () => {
      for (const schluessel of UX08_TEXTE) {
        const text = bundle(sprache)[schluessel] ?? "";
        expect(text, `${sprache}: ${schluessel} fehlt`).toBeTruthy();
        expect(text, `${sprache}: ${schluessel}`).toContain(weg(sprache));
        expect(text, `${sprache}: ${schluessel}`).not.toContain(ALTER_WEG[sprache]);
        // K3: der Satz richtet sich an den Administrator — er behauptet kein eigenes Recht.
        expect(text.toLowerCase(), `${sprache}: ${schluessel}`).toContain(ADMINISTRATOR[sprache]);
      }
    });

    it(`${sprache}: der alte Weg steht nur noch im ausdrücklich nicht beauftragten Schlüssel`, () => {
      const uebrig = Object.entries(bundle(sprache))
        .filter(([, text]) => typeof text === "string" && text.includes(ALTER_WEG[sprache]))
        .map(([schluessel]) => schluessel);
      expect(uebrig).toEqual(["xtr.append.blockedByStage"]);
    });
  }

  it("die Texte kommen aus dem UX08-Textmodul, die Schlüsselmenge ist unverändert", () => {
    expect([...ux08.legacySchluessel].sort()).toEqual([...UX08_TEXTE].sort());
    for (const sprache of SPRACHEN) {
      expect(Object.keys(ux08[sprache]).sort(), sprache).toEqual([...UX08_TEXTE].sort());
      for (const schluessel of UX08_TEXTE) {
        expect(bundle(sprache)[schluessel], `${sprache}: ${schluessel}`).toBe(
          ux08[sprache][schluessel],
        );
      }
    }
  });
});
