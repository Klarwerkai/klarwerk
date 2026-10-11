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
//     deshalb fragt `sperrErkennungErlauben` beim Klick auf „Begleitung starten". Wird sie
//     verweigert oder fehlt die API (Firefox, Safari), bleibt allein das Fenstersignal, und die
//     Leiste sagt das.
//
// Ein privates Fenster kann eine Webseite nicht verlässlich erkennen. Der Vorgangsadapter liest
// aber ausschließlich das eigene Dokument — ein anderes (privates) Fenster ist für ihn unsichtbar,
// und das Wechseln dorthin verbirgt dieses Fenster und pausiert.

export type SperrErkennung = "bildschirm" | "nur_fenster";

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

/** Aus der Startgeste heraus rufen. Ergebnis: ob ein echter Sperrbildschirm gemeldet werden kann. */
export async function sperrErkennungErlauben(): Promise<SperrErkennung> {
  const k = klasse();
  if (!k) {
    return "nur_fenster";
  }
  try {
    return (await k.requestPermission()) === "granted" ? "bildschirm" : "nur_fenster";
  } catch {
    return "nur_fenster";
  }
}

/** Ruft `beiSperre`, sobald der Bildschirm gesperrt wird. Rückgabe: beendet die Beobachtung. */
export function beobachteSperre(beiSperre: () => void): () => void {
  const k = klasse();
  const abbruch = new AbortController();
  if (!k) {
    return () => abbruch.abort();
  }
  try {
    const melder = new k();
    melder.addEventListener("change", () => {
      if (melder.screenState === "locked") {
        beiSperre();
      }
    });
    melder.start({ threshold: SCHWELLE_MS, signal: abbruch.signal }).catch(() => {
      // Erlaubnis entzogen oder Melder nicht startbar: es bleibt das Fenstersignal.
    });
  } catch {
    // dasselbe — kein Melder, kein Sperrsignal, keine Ausnahme in der Oberfläche
  }
  return () => abbruch.abort();
}
