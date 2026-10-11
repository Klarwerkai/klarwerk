// ================================================================================================
// AKTIVE BEGLEITUNG · HOSTZUSTAND IM BROWSER — wer meldet „Bildschirm gesperrt"?
// ================================================================================================
//
// Der Browser selbst ist hier der Host. Zwei Signale gibt er her, beide ohne Inhalte:
//
//   · `document.hidden` (Page Visibility): das Fenster ist verborgen — anderes Fenster/anderer Tab
//     im Vordergrund, minimiert oder Bildschirm aus. Die Leiste pausiert dann mit „verborgen" und
//     liest VORHER nichts mehr (`KlaraBegleitung.tsx`, `abtasten`).
//   · `IdleDetector` (Idle Detection API, Chrome): `screenState === "locked"` heißt Sperrbildschirm.
//     Die API braucht eine Erlaubnis, die nur aus einer Nutzergeste heraus erfragt werden darf —
//     deshalb wird der Melder beim Klick auf „Begleitung starten" und bei JEDEM „Fortsetzen"
//     (auch nach Neuladen) neu eingerichtet.
//
// DER TATSÄCHLICHE ZUSTAND (Nacharbeit 3, Ben AC07/G10): `starteSperrmelder` antwortet erst, wenn
// feststeht, was gilt:
//   laeuft       — Erlaubnis erteilt UND `start()` erfolgreich; erst dann darf die Leiste die
//                  Sperrerkennung zusagen
//   nur_fenster  — API fehlt oder Erlaubnis verweigert; die Leiste sagt das so
//   ausgefallen  — Erlaubnis da, aber Konstruktor oder `start()` scheitern; die Begleitung wird
//                  pausiert und der Fehler sichtbar gemacht — nichts wird verschluckt
//
// Ein privates Fenster kann eine Webseite nicht verlässlich erkennen. Der Vorgangsadapter liest
// aber ausschließlich das eigene Dokument — ein anderes (privates) Fenster ist für ihn unsichtbar,
// und das Wechseln dorthin verbirgt dieses Fenster und pausiert.

export type MelderErgebnis =
  | { readonly zustand: "laeuft"; readonly beenden: () => void }
  | { readonly zustand: "nur_fenster" }
  | { readonly zustand: "ausgefallen" };

interface IdleDetectorArtig extends EventTarget {
  readonly screenState: "locked" | "unlocked" | null;
  start(optionen: { threshold: number; signal: AbortSignal }): Promise<void>;
}

interface IdleDetectorKlasse {
  new (): IdleDetectorArtig;
  requestPermission(): Promise<string>;
}

/** Die kleinste Schwelle, die die API annimmt — für das Sperrsignal ist sie ohne Belang. */
const SCHWELLE_MS = 60_000;

function klasse(): IdleDetectorKlasse | null {
  const k = (globalThis as { IdleDetector?: unknown }).IdleDetector;
  return typeof k === "function" ? (k as IdleDetectorKlasse) : null;
}

/** Ohne API gibt es nichts einzurichten — dann bleibt der Ablauf synchron und meldet `nur_fenster`. */
export function sperrmelderVerfuegbar(): boolean {
  return klasse() !== null;
}

/**
 * Richtet den Sperrbildschirmmelder ein. MUSS synchron aus einer Nutzergeste gerufen werden: die
 * Erlaubnisanfrage geschieht vor dem ersten `await`. Antwortet erst mit dem tatsächlichen Zustand.
 */
export async function starteSperrmelder(beiSperre: () => void): Promise<MelderErgebnis> {
  const k = klasse();
  if (!k) {
    return { zustand: "nur_fenster" };
  }
  let erlaubnis: string;
  try {
    erlaubnis = await k.requestPermission();
  } catch {
    return { zustand: "nur_fenster" };
  }
  if (erlaubnis !== "granted") {
    return { zustand: "nur_fenster" };
  }
  const abbruch = new AbortController();
  try {
    const melder = new k();
    melder.addEventListener("change", () => {
      if (melder.screenState === "locked") {
        beiSperre();
      }
    });
    await melder.start({ threshold: SCHWELLE_MS, signal: abbruch.signal });
  } catch {
    abbruch.abort();
    return { zustand: "ausgefallen" };
  }
  return { zustand: "laeuft", beenden: () => abbruch.abort() };
}
