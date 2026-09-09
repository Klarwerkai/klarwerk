// ================================================================================================
// JOB 3323 · APP-SPRACHSCHALTER — DER SPRACHWECHSEL, DER AUS JEDER LAUFENDEN SZENE ERREICHBAR IST.
// ================================================================================================
//
// DER BEFUND. Umschalten konnte man die Sprache an genau zwei Orten: auf der Anmeldefläche
// (`auth/BrandPanel.tsx`, `PublicLangSwitch`) und auf der Profilseite (`pages/Profile.tsx`,
// `SprachWahl`). Beide liegen AUSSERHALB jeder laufenden Szene: wer mitten im Erfassen, im Prüfen,
// in der Bibliothek oder im Import auf Englisch wechseln wollte, musste die Seite verlassen — und
// nahm dabei den offenen Entwurf, die Auswahl und den Prüfstand mit. Vor einem Kunden ist das kein
// Sprachwechsel, sondern ein Abbruch.
//
// DER ORT. Dieser Schalter wohnt im KONTO-MENÜ der Hülle (`shell/KontoMenue.tsx`, Zeile
// `KontoEintraege`) — und damit an genau einer Stelle, die auf JEDER angemeldeten Seite steht:
//   · breit (> 899 px): Konto-Kreis im Kopfband → Menü;
//   · schmal (≤ 899 px, also auch 390 px): derselbe Konto-Kreis im schmalen Kopfband UND zusätzlich
//     der Off-Canvas-Drawer, der `KontoEintraege` ebenfalls rendert (`shell/DrawerMenue.tsx`).
// NICHT als Pille direkt ins Kopfband: dessen sichtbarer Text ist gepinnt (die sechs Wörter,
// `tests/design/zielbild-h1-kein-erklaertext.test.ts`, Fall N nennt „DE/EN/NL" ausdrücklich als
// verboten). Das Menü ist der Ort, den der Auftrag nennt, und der Ort, der den Pin nicht bricht.
//
// KEIN ZWEITER WECHSELWEG. Gewechselt wird über `i18n.changeLanguage` — dieselbe eine Funktion, die
// Profil und Anmeldung rufen. Die ERLAUBTE MENGE wird nicht neu geschrieben, sondern aus
// `lib/htmlLang.ts` geholt (`ERLAUBTE_SPRACHEN`): dort steht sie seit Auftrag 101 als die eine
// Wahrheit, und dieselbe Liste prüft auch `applyHtmlLang` und `sprachwahl.ts`. Eine vierte Kopie
// von `["de","en","nl"]` hätte beim nächsten Sprachzuwachs still auseinanderlaufen können.
//
// WAS DIESER SCHALTER NICHT TUT, und das ist die eigentliche Zusage des Auftrags:
//   · Er lädt NICHT neu (kein `location.reload`) und navigiert NICHT (kein Routenwechsel). Er ruft
//     `changeLanguage`; React rendert die Bäume neu, die an `useTranslation` hängen — die
//     Komponenten bleiben dabei montiert, also bleibt ihr Zustand (Entwurfstext, Auswahl, geöffnete
//     Prüfung, Filter, Scrollposition) unangetastet.
//   · Er übersetzt KEINE INHALTE. Wissen, Quellen, KI-Antworten, Status und IDs kommen vom Server
//     und stehen als Daten im Baum; ein Sprachwechsel fasst sie nicht an. Ein importierter
//     englischer Text bleibt englisch. Es gibt hier keinen Modellaufruf und keinen Netzabruf.
//   · Er MERKT sich die Wahl nicht selbst. Das Schreiben in den Browserspeicher wohnt an der
//     Anwendungswurzel (`main.tsx` → `bindSpracheSpeichern`), genau wie das `lang`-Attribut
//     (`bindHtmlLang`). Hinge es am Umschalter, merkte sich einer die Wahl und die beiden anderen
//     nicht — die Lehre steht wörtlich in `lib/htmlLang.ts` und in `lib/sprachwahl.ts`.
//
// KEIN `aria-pressed` AN DIESEN KNÖPFEN, und das ist kein Stilentscheid: `tests/app/
// mega40-design-umschalter-mounted.test.tsx:166` erhebt den Design-Umschalter als „der EINE Button
// des Konto-Menüs mit aria-pressed". Drei weitere Knöpfe mit `aria-pressed` in derselben Fläche
// hätten diesen Wächter stumpf gemacht. Die Auszeichnung ist hier ohnehin die richtigere:
// `role="menuitemradio"` + `aria-checked` sagt „eine aus drei", `aria-pressed` sagt „an/aus".
import { useTranslation } from "react-i18next";
import { ERLAUBTE_SPRACHEN } from "../lib/htmlLang";

/**
 * Die aktive Sprache als Element der erlaubten Menge.
 *
 * `startsWith` statt `===` — dieselbe Regel, die `pages/Profile.tsx` und `auth/BrandPanel.tsx`
 * schon anwenden. `i18n.language` ist heute zugesichert exakt „de" | „en" | „nl" (kein Detector,
 * keine Normalisierung, s. `lib/htmlLang.ts`); käme je ein Regionalcode dazu, zeichnet der Schalter
 * trotzdem die richtige Sprache aus, statt gar keine.
 */
function istAktiv(sprache: string, kandidat: string): boolean {
  return sprache.startsWith(kandidat);
}

/**
 * Die drei Sprachknöpfe als Zeile eines Menüs — Beschriftung links, Wahl rechts, wie die Zeile
 * „Darstellung" daneben (`shell/Darstellung.tsx`). Der aktive Knopf IST der Wert; ein zusätzlicher
 * Werttext stünde doppelt da.
 *
 * TASTATUR: echte `<button>`s (Enter/Leertaste nativ), und weil sie `role="menuitemradio"` tragen,
 * findet sie der Zeilen-Selektor der Menü-Bausteine (`shell/Menue.tsx`, `ZEILEN_SELEKTOR`) — Pfeil
 * hoch/runter wandert also auch über den Sprachschalter, Escape schließt das Menü.
 *
 * ARIA: die Gruppe trägt den übersetzten Namen der Wahl (`prof.language` — derselbe Schlüssel, den
 * die Profilzeile benutzt), jeder Knopf den ausgeschriebenen Sprachnamen (`lib.facet.lang.*`, in
 * allen drei Sprachen vorhanden). Sichtbar bleibt das Kürzel; vorgelesen wird „Deutsch".
 */
export function SprachSchalter(): JSX.Element {
  const { t, i18n } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 text-[13px]">
      <span className="min-w-0 flex-1 truncate text-text">{t("prof.language")}</span>
      {/* biome-ignore lint/a11y/useSemanticElements: ein <fieldset> ist hier die falsche Antwort.
          Die Regel schlägt es als semantisches Gegenstück zu role="group" vor — aber dieser Baustein
          liegt IN einem `role="menu"` (shell/Menue.tsx, MenueFlaeche), und das WAI-ARIA-Menümuster
          verlangt für eine Auswahl aus menuitemradio-Zeilen genau eine `group`. Ein <fieldset>
          brächte eine Formularsemantik samt verlangtem <legend> in ein Menü, das kein Formular ist,
          und der Zeilen-Selektor des Menüs würde daran vorbeigreifen. Die Auszeichnung bleibt. */}
      <span
        role="group"
        aria-label={t("prof.language")}
        data-testid="sprach-schalter"
        className="flex shrink-0 gap-1"
      >
        {ERLAUBTE_SPRACHEN.map((l) => {
          const aktiv = istAktiv(i18n.language, l);
          // ======================================================================================
          // WARUM DIE ENTSCHEIDUNG HIER STEHT UND NICHT IM `className`.
          // ======================================================================================
          // Der Klassenbindungs-Sammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`,
          // JOB 1181) zerlegt jede `className`-Bindung in AUFGELÖST und OFFEN. Ein Ternär direkt
          // im Attribut (`… ${aktiv ? "a" : "b"}`) trägt den Bezeichner `aktiv` in den Ausdruck;
          // dessen Deklaration führt keine Zeichenkette, also bliebe die Bindung OFFEN und der
          // gepinnte Zählstand stiege von 217 auf 218. Die Lehre aus JOB 3267 (Q1) steht dort
          // wörtlich: „die Klassen auflösbar schreiben statt den Pin hochzusetzen."
          // Als lokale Konstante trägt der Bezeichner BEIDE Klassenketten literal — der Sammler
          // löst ihn auf, die Bindung bleibt in seiner Erhebung, und nichts ist an ihm vorbei
          // geschrieben (ein Attributobjekt oder ein festes `className` nähme sie ihm ganz weg).
          const zustandsKlasse = aktiv
            ? "bg-ink text-white"
            : "border border-hairline text-muted hover:text-text";
          return (
            <button
              key={l}
              type="button"
              role="menuitemradio"
              aria-checked={aktiv}
              aria-label={t(`lib.facet.lang.${l}`)}
              data-testid={`sprach-schalter-${l}`}
              onClick={() => {
                void i18n.changeLanguage(l);
              }}
              className={`rounded-btn px-2 py-0.5 text-[12px] font-semibold uppercase ${zustandsKlasse}`}
            >
              {l}
            </button>
          );
        })}
      </span>
    </div>
  );
}
