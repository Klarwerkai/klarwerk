// ================================================================================================
// JOB 4363 · H6-D1b — DER STAND DER BEREITSCHAFTSKARTE, UND WARUM ER NICHT FRISCH IST.
// ================================================================================================
//
// DER BEFUND. Die Bereitschaftskarte (`pages/AdminSicherheitDetails.tsx`, `BereitschaftDetail`)
// hat jede gestörte Auffrischung ihrer sechs Quellen mit EINEM Satz beantwortet: dem `StaleMarker`
// „Veraltet – Aktualisierung fehlgeschlagen" (`components/LoadState.tsx:30-48`). Das ist genau
// dann eine Erfindung, wenn gar kein Abruf stattgefunden hat:
//
//   · OHNE NETZ gibt es keinen gescheiterten Versuch, den man melden könnte — die Abfrage RUHT.
//     Derselbe Satz steht seit JOB 3808 in `LoadState.tsx:54-59` und seit JOB 4293 in `i18n.ts`
//     bei `imp.stand.*`: „`loadstate.stale` passt für den Offlinefall ausdrücklich nicht".
//   · NACH DER WIEDERVERBINDUNG innerhalb der produktiven Frischefrist (`ZAEHLER_FRISCHE_MS`,
//     30 s, zugleich die `staleTime` des `QueryClient` in `main.tsx:44`) holt react-query von sich
//     aus NICHTS nach: die Antworten gelten noch als frisch, `refetchOnReconnect` findet keine
//     abgelaufene Abfrage. Der gezeigte Stand ist trotzdem der von VOR der Unterbrechung, und
//     „fehlgeschlagen" wäre auch hier falsch — es ist seither schlicht keine Antwort angekommen.
//
// UND ES FEHLTE DIE ZEIT. Der `StaleMarker` nennt keinen Zeitpunkt. Die Zeile derselben Auskunft
// eine Ebene höher sagt für denselben Zustand „Stand von 07:24 · nicht aktualisiert"
// (`Zeilenkarte.tsx`), und die Hülle jeder anderen Detailkarte ebenso (`Abfragehuelle.tsx:150-196`,
// JOB 3135). Wer die Karte offen hat, sah als Einziger nicht, WIE alt der Bestand ist.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESES BAUTEIL TUT — und was ausdrücklich nicht.
// ------------------------------------------------------------------------------------------------
// Es setzt EINE Zeile aus denselben Bausteinen zusammen, die die Übersicht und die Hülle schon
// benutzen (`einst.wert.stand` für die Zeit, `loadstate.error.retry` für den Ausweg), und
// unterscheidet dabei die DREI Lagen, die bisher einen Wortlaut teilten:
//
//   ruht (offline)      „Stand von 07:24 · ohne Netzverbindung nicht aktualisiert"   ohne Knopf
//   gescheitert         „Stand von 07:24 · Veraltet – Aktualisierung fehlgeschlagen" mit Knopf
//   Netzlücke           „Stand von 07:24 · seit der Unterbrechung ist keine neue
//                        Antwort angekommen"                                          mit Knopf
//
// und hängt, solange wirklich eine Antwort unterwegs ist, „wird gerade aufgefrischt" an — damit
// zwischen Klick und Antwort nicht der Eindruck entsteht, es geschehe nichts.
//
// WARUM DER OFFLINEFALL KEINEN KNOPF TRÄGT: die Begründung steht wörtlich in `LoadState.tsx:56-60`
// (JOB 3808) — ein Knopf, der nichts bewirken kann, solange das Netz fehlt, wäre eine
// Scheinfunktion (REGELN §7). react-query hält einen angestossenen Abruf ohne Netz an
// (`fetchStatus: "paused"`), es ginge also wirklich kein Aufruf hinaus. Sobald das Netz zurück ist,
// steht der Knopf da — das ist der Fall „Netzlücke", und genau dort wird er auch gebraucht.
//
// WARUM DER FEHLERFALL DEN VORHANDENEN SATZ BEHÄLT: er hat im Haus bereits einen
// (`loadstate.stale`, DE/EN/NL, benutzt von Start, Aufgaben, Analytics). Ein zweiter Wortlaut für
// denselben Zustand wäre genau die Krankheit, gegen die der Kopf von `Abfragehuelle.tsx:27-35`
// geschrieben ist. Neu sind nur die Sätze für die zwei Lagen, die vorher gar keinen hatten.
//
// NICHT GEGENSTAND: der Lade-, Leer- und Fehlerweg OHNE Bestand (der bleibt die `Fehlerbox` bzw.
// die zeilenweise Ladeauskunft der Karte), die Frischefrist selbst, ein eigener Abrufdienst. Dieses
// Bauteil löst nichts aus; es sagt, was ist, und reicht den Wiederholwunsch an die Karte weiter.
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cx } from "../ui";

// Vier flache Konstanten statt eines Objekts — derselbe Grund wie in `Abfragehuelle.tsx:96-113`:
// der Klassenbindungs-Sammler (`tests/app/mega47-modale-flaechen-sammler.test.tsx`) löst einen
// lokalen Bezeichner mit literalem Wert auf, einen Eigenschaftszugriff `X.y` aber nicht.
/** Der Träger der Zeile: bricht um, trägt Text und Wiederholen nebeneinander. */
const HINWEIS_ZEILE = "flex flex-wrap items-center gap-2 rounded-btn px-2.5 py-1.5 text-[11.5px]";
/** Gestört (ruht, gescheitert oder Netzlücke): die Warnfarbe, dieselbe wie am `StaleMarker`. */
const HINWEIS_GESTOERT = "bg-trust-warn-bg font-semibold text-trust-warn-text";
/** Nur „Stand von … · wird gerade aufgefrischt": keine Störung, also keine Warnfarbe. */
const HINWEIS_RUHIG = "text-muted-2";
/** Der Wiederholen-Knopf (Fokus kommt aus der globalen `:focus-visible`-Regel). */
const HINWEIS_KNOPF =
  "inline-flex items-center gap-1 rounded-btn px-2 py-0.5 hover:bg-trust-warn-text/10";

/**
 * Der Satz, der die Störung BENENNT — genau einer je Lage, und keiner behauptet mehr als er weiß.
 *
 * Die Reihenfolge trägt die Bedeutung: RUHT gewinnt vor GESCHEITERT. Wer offline ist, hat den
 * gescheiterten Versuch von vorhin zwar noch in der Abfrage stehen, aber die Auskunft, die JETZT
 * gilt, ist „es geht gerade nichts hinaus". Und die Netzlücke bleibt, was übrig ist: Netz da, kein
 * Fehler, und trotzdem seit der Störung keine neue Antwort.
 */
function stoerungsschluessel(pausiert: boolean, fehler: boolean): string {
  if (pausiert) {
    return "adm.ready.stand.offline";
  }
  return fehler ? "loadstate.stale" : "adm.ready.stand.netzluecke";
}

/**
 * Die Standzeile der Bereitschaftskarte.
 *
 * Alle Eingaben kommen aus `zeilenWert.ts` — `befund.standMs`/`befund.nichtAktualisiert` aus
 * `wertBefund()` und `pausiert`/`fehler`/`laeuft` aus der `gruppenlage()` der sechs Quellen. Hier
 * wird nichts noch einmal ausgelegt: dieses Bauteil rendert, es urteilt nicht.
 */
export function Bereitschaftstandhinweis({
  standMs,
  gestoert,
  pausiert,
  fehler,
  laeuft,
  onErneut,
}: {
  /** Zeitpunkt des letzten erfolgreichen Abrufs der GRUPPE (ältester ihrer Quellen). 0 = keiner. */
  standMs: number;
  /** `befund.nichtAktualisiert`: die Auffrischung ruht, ist gescheitert oder steht noch aus. */
  gestoert: boolean;
  /** Mindestens eine massgebliche Quelle ruht (kein Netz oder `fetchStatus: "paused"`). */
  pausiert: boolean;
  /** Mindestens eine massgebliche Quelle steht im Fehlerzustand. */
  fehler: boolean;
  /** Es ist wirklich eine Antwort unterwegs. */
  laeuft: boolean;
  onErneut: () => void;
}): JSX.Element | null {
  const { t } = useTranslation();
  // Ohne sichtbaren Bestand hat dieser Hinweis keinen Gegenstand: dann steht die Karte im Lade-,
  // Leer- oder Fehlerweg, und der sagt seinerseits die Wahrheit. Ein „Stand von" ohne Stand wäre
  // ein Verweis auf etwas, das der Mensch nirgends sieht (dieselbe Regel wie `PausedMarker`,
  // `LoadState.tsx:63-68`).
  if (standMs <= 0 && !gestoert) {
    return null;
  }
  const teile: string[] = [];
  if (standMs > 0) {
    teile.push(
      t("einst.wert.stand", {
        zeit: new Date(standMs).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }),
    );
  }
  if (gestoert) {
    teile.push(t(stoerungsschluessel(pausiert, fehler)));
  }
  // Der laufende Abruf ist ein ZUSATZ und kein Ersatz: der alte Stand bleibt daneben stehen, sonst
  // sähe es aus, als gälte die Zahl schon wieder (Auftrag K3).
  if (laeuft) {
    teile.push(t("adm.ready.stand.laeuft"));
  }
  if (teile.length === 0) {
    return null;
  }
  // Ein Wiederholen-Knopf nur dort, wo er wirklich einen Abruf auslösen kann — die Begründung steht
  // im Kopf dieser Datei.
  const mitKnopf = gestoert && !pausiert;
  return (
    // <output> trägt implizit role="status" (biome useSemanticElements) — eine Statusregion, keine
    // Alarmregion; dieselbe Wahl wie am `StaleMarker` und an der Hülle (JOB 2064 A18).
    <output
      data-einst="bereitschaft-stand"
      data-lage={gestoert ? stoerungsschluessel(pausiert, fehler) : "laeuft"}
      className={cx(HINWEIS_ZEILE, gestoert ? HINWEIS_GESTOERT : HINWEIS_RUHIG)}
    >
      {gestoert ? <AlertTriangle size={13} className="shrink-0" /> : null}
      <span className="flex-1">{teile.join(" · ")}</span>
      {mitKnopf ? (
        <button type="button" onClick={onErneut} className={HINWEIS_KNOPF}>
          <RefreshCw size={12} />
          {t("loadstate.error.retry")}
        </button>
      ) : null}
    </output>
  );
}
