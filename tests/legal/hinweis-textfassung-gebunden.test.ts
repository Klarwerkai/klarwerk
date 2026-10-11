// ================================================================================================
// AUFTRAG gesamt-ki-einwilligung:bindung · R-0593 — ÄNDERT SICH DER TEXT, ÄNDERT SICH DIE FASSUNG.
// ================================================================================================
//
// Originalpunkt: „Das Produkt fuehrt am Konto dieselbe Kennung der Hinweis-Textfassung wie die
// Unterrichtung, damit beide nicht auseinanderlaufen. Aendert sich der Text, wird der bereits
// erbrachte Nachweis ungueltig."
//
// DER BESTAND TRÄGT ZWEI DER DREI GLIEDER:
//   · Kennung am Konto = Kennung der Unterrichtung — `tests/legal/mega63-unterrichtung-artikel-4.test.ts`.
//   · Neue Kennung ⇒ alter Nachweis ungültig (`hinweisFaellig`) — `tests/auth/mega61-hinweis-vermerk.test.ts`.
//
// DAS FEHLENDE GLIED war der Text selbst. `HINWEIS_TEXT_VERSION` ist eine Konstante, die von Hand
// erhöht wird (`services/auth/src/notice.ts`); ändert jemand den Wortlaut des Banners und vergisst
// sie, bleibt jede Quittung gültig — für einen Text, den die Nutzerin so nie gesehen hat. Genau das
// soll der Vermerk verhindern.
//
// DIESER SAMMLER SCHLIESST ES: er hält den quittierten Wortlaut (alle `notice.banner.*`, alle drei
// Sprachen, aus dem zusammengesetzten Wörterbuch) zusammen mit der Fassung fest, zu der er gehört.
// Ändert sich der Text, wird er rot. Der Weg zurück auf Grün ist dann genau der, den R-0593 verlangt:
//   1. `HINWEIS_TEXT_VERSION` erhöhen — damit ist jeder erteilte Nachweis ungültig, der Hinweis
//      erscheint bei allen Konten wieder;
//   2. die Unterrichtung (`docs/compliance/unterrichtung-artikel-4.md`) auf dieselbe Kennung
//      nachziehen — sonst wird der mega63-Sammler rot;
//   3. hier Text UND Fassung gemeinsam neu festhalten.
// Eine reine Übersetzungskorrektur ohne Bedeutungsänderung ist nach `notice.ts` keine neue Fassung;
// auch dann wird hier neu festgehalten — bewusst, als sichtbare Entscheidung statt stiller Drift.
import { describe, expect, it } from "vitest";
import { HINWEIS_TEXT_VERSION, hinweisFaellig } from "../../services/auth/src/notice";
import { alleSprachbestaende } from "../support/i18nBestand";

/** Der quittierte Wortlaut — und die Fassung, zu der GENAU dieser Wortlaut gehört. */
const FESTGEHALTEN = {
  fassung: "2026-07-30.1",
  texte: {
    de: {
      "notice.banner.ack": "Verstanden — weiter",
      "notice.banner.ai":
        "Diese Anwendung arbeitet mit künstlicher Intelligenz. Wenn Sie eine Frage stellen, Notizen strukturieren lassen oder eine Bildbeschreibung vorschlagen lassen, wird ein KI-Modell verwendet, und die dafür benötigten Inhalte werden an dessen Betreiber übermittelt. Ergebnisse eines KI-Modells können unzutreffend sein und ersetzen keine fachliche Prüfung. An jeder betroffenen Stelle sehen Sie, welches Modell arbeitet.",
      "notice.banner.aria": "Hinweis zur Nutzung dieser Anwendung",
      "notice.banner.cookie":
        "Für die Anmeldung wird ein technisch notwendiges Sitzungscookie gesetzt. Ohne dieses Cookie ist eine angemeldete Nutzung nicht möglich.",
      "notice.banner.decline": "Nicht einverstanden",
      "notice.banner.title": "Kurz zur Kenntnis",
    },
    en: {
      "notice.banner.ack": "Understood — continue",
      "notice.banner.ai":
        "This application works with artificial intelligence. When you ask a question, have notes structured or have an image description suggested, an AI model is used, and the content required for it is transmitted to its operator. Results from an AI model can be incorrect and do not replace professional review. At every place concerned you can see which model is working.",
      "notice.banner.aria": "Note on using this application",
      "notice.banner.cookie":
        "A technically necessary session cookie is set for signing in. Without this cookie, signed-in use is not possible.",
      "notice.banner.decline": "I do not agree",
      "notice.banner.title": "Briefly, for your information",
    },
    nl: {
      "notice.banner.ack": "Begrepen — verder",
      "notice.banner.ai":
        "Deze toepassing werkt met kunstmatige intelligentie. Wanneer u een vraag stelt, notities laat structureren of een beeldbeschrijving laat voorstellen, wordt een AI-model gebruikt en wordt de daarvoor benodigde inhoud aan de exploitant ervan doorgegeven. Resultaten van een AI-model kunnen onjuist zijn en vervangen geen vakinhoudelijke toetsing. Op elke betrokken plek ziet u welk model werkt.",
      "notice.banner.aria": "Kennisgeving over het gebruik van deze toepassing",
      "notice.banner.cookie":
        "Voor het aanmelden wordt een technisch noodzakelijk sessiecookie geplaatst. Zonder dit cookie is aangemeld gebruik niet mogelijk.",
      "notice.banner.decline": "Niet akkoord",
      "notice.banner.title": "Kort ter kennisname",
    },
  } as Record<string, Record<string, string>>,
};

/** Der Wortlaut, den die Oberfläche JETZT zeigt — jeder `notice.banner.*`-Schlüssel, sortiert. */
function aktuellerWortlaut(): Record<string, Record<string, string>> {
  const ergebnis: Record<string, Record<string, string>> = {};
  for (const [sprache, texte] of Object.entries(alleSprachbestaende())) {
    ergebnis[sprache] = Object.fromEntries(
      Object.entries(texte)
        .filter(([schluessel]) => schluessel.startsWith("notice.banner."))
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  }
  return ergebnis;
}

describe("R-0593 · der quittierte Hinweistext ist an seine Fassung gebunden", () => {
  it("die Erhebung greift: alle drei Sprachen, jede mit dem vollständigen Banner", () => {
    const aktuell = aktuellerWortlaut();
    expect(Object.keys(aktuell).sort()).toEqual(["de", "en", "nl"]);
    for (const [sprache, texte] of Object.entries(aktuell)) {
      expect(Object.keys(texte).length, sprache).toBeGreaterThanOrEqual(6);
    }
  });

  it("die festgehaltene Fassung IST die Fassung des Produkts", () => {
    const anleitung = "HINWEIS_TEXT_VERSION wurde geändert — Wortlaut und Fassung neu festhalten";
    expect(HINWEIS_TEXT_VERSION, anleitung).toBe(FESTGEHALTEN.fassung);
  });

  it("DER TEXT IST UNVERÄNDERT — sonst muss die Fassung steigen und der alte Nachweis verfallen", () => {
    const anleitung = [
      "Der Hinweistext hat sich geändert.",
      "HINWEIS_TEXT_VERSION erhöhen (macht jeden erteilten Nachweis ungültig),",
      "die Unterrichtung auf dieselbe Kennung nachziehen",
      "und hier Text und Fassung gemeinsam neu festhalten.",
    ].join(" ");
    expect(aktuellerWortlaut(), anleitung).toEqual(FESTGEHALTEN.texte);
  });

  it("KALIBRIERUNG: ein Nachweis zu einer anderen Fassung als der festgehaltenen gilt nicht", () => {
    // Die Kette zu Ende gedacht: steigt die Fassung, ist jeder Vermerk zur alten fällig.
    expect(hinweisFaellig(FESTGEHALTEN.fassung)).toBe(false);
    expect(hinweisFaellig(`${FESTGEHALTEN.fassung}-vorher`)).toBe(true);
  });
});
