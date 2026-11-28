// ================================================================================================
// R-0801 · DIE DEUTSCHEN FACHTEXTE KOMMEN MIT IHRER FLÄCHE (Gesamtcheck R-1329, Nacharbeit 58).
// ================================================================================================
//
// DER BEFUND. Am Kandidaten ed51bf71 wog die Eintritts-Hülle 1 554 070 B gegen den Deckel von
// 1 360 000 B (`tests/erstladezeit/eintritt-ohne-seiten.test.ts`, Block DECKEL). 575 275 B davon
// waren die deutschen Blöcke der Textmodule (`texte/*.ts`) — auch die Texte von Flächen, die erst
// mit ihrer Seite nachgeladen werden und beim Start gar nicht zu sehen sind.
//
// WAS SICH ÄNDERT, und nur im PRODUKTIONSBAU (Plugin `sprachpaketeNachladen`,
// `texte/intern/sprachpakete.ts`, Punkte 8–11 im Kopf): ein Textmodul, dessen Schlüssel kein Modul
// der statischen Eintritts-Hülle nennt, gibt seinen deutschen Block in das Paket
// `i18n.fachtexte.de.js` ab. Der Bau trägt dafür unten in `FACHTEXTE_DE` den Lader ein. Die Hülle
// selbst — Kopfband, Anmeldung, Meldungen und alles, was sie statisch einbindet — behält jeden
// deutschen Text, den sie nennt: Deutsch bleibt Startsprache und erscheint ohne Warten.
//
// WER WARTET. Jede Seite (`routes.tsx`) und jede nachgeladene Fläche der Hülle (Hilfeknopf,
// Assistenz, Begleitung, Tutorial) lädt ihr Stück und das Fachtextpaket GLEICHZEITIG und zeichnet
// erst, wenn beides da ist. Niemand sieht also einen Schlüssel statt eines Satzes.
//
// WENN DAS PAKET NICHT KOMMT (Nachladefehler):
//   · eine Seite scheitert wie ein fehlgeschlagenes Seitenstück — dieselbe Fehlergrenze, bei einem
//     alten Tab dieselbe Karte „neue Version" (`components/ErrorBoundary.tsx`);
//   · eine Fläche der Hülle erscheint trotzdem: sie darf die ganze Anwendung nicht mitreißen.
// Ein späterer Aufruf versucht es erneut; ein gescheiterter Versuch bleibt nicht hängen.
//
// IM QUELLTEXT — jeder Vitest-Lauf, der Entwicklungsserver — trägt `FACHTEXTE_DE` keinen Lader:
// alle Texte liegen sofort vor, und `mitFachtexten` reicht das Stück unverändert durch.
import i18n from "../i18n";

type Fachtextpaket = { default: Record<string, string> };

/** Der Anker für den Bau — wörtlich, eine Zeile (`FACHTEXTE_ZEILE` in sprachpakete.ts). */
const FACHTEXTE_DE: { laden?: () => Promise<Fachtextpaket> } = {};

/** Wie eine Fläche auf ein ausbleibendes Paket reagiert (siehe Kopf). */
export type Fachtextfehler = "seite" | "flaeche";

interface Ziel {
  addResourceBundle(
    sprache: string,
    namensraum: string,
    texte: Record<string, string>,
    tief: boolean,
    ueberschreiben: boolean,
  ): unknown;
}

/**
 * Baut das Warten auf das Paket um einen Lader herum. Ohne Lader (Quelltext) wird nie gewartet.
 * Exportiert für die Gegenprobe (`tests/erstladezeit/sprachpakete-nachladen.test.ts`, Block F).
 */
export function fachtexteLader(
  laden: (() => Promise<Fachtextpaket>) | undefined,
  ziel: Ziel,
): <M>(stueck: Promise<M>, fehler?: Fachtextfehler) => Promise<M> {
  let da = laden === undefined;
  let laeuft: Promise<void> | undefined;
  const texte = (): Promise<void> => {
    if (da || laden === undefined) {
      return Promise.resolve();
    }
    laeuft ??= laden().then(
      (paket) => {
        // `ueberschreiben: false`: ein im Betrieb gepflegter Text (R-1034, `lib/textpflege.ts`),
        // der schon vor dem Paket ankam, bleibt stehen.
        ziel.addResourceBundle("de", "translation", paket.default, true, false);
        da = true;
      },
      (grund: unknown) => {
        laeuft = undefined;
        throw grund;
      },
    );
    return laeuft;
  };
  return <M>(stueck: Promise<M>, fehler: Fachtextfehler = "seite"): Promise<M> => {
    if (da) {
      return stueck;
    }
    const warten = fehler === "seite" ? texte() : texte().catch(() => undefined);
    return Promise.all([stueck, warten]).then(() => stueck);
  };
}

/** Ein nachgeladenes Stück — erst, wenn auch seine deutschen Fachtexte da sind. */
export const mitFachtexten = fachtexteLader(FACHTEXTE_DE.laden, i18n);
