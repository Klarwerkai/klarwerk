// ================================================================================================
// JOB 4232 · F — DIE ABSOLUTE FRIST, GEMESSEN AM TATSÄCHLICHEN BETRIEBSWEG.
// ================================================================================================
//
// BENS BEFUND AN RUNDE 3, wörtlich: „Der neue HTTPS-Transport besitzt nur einen Socket-Timeout, keine
// absolute Frist. Regelmäßige Daten verlängern den Abruf über die zugesagte Grenze hinaus. Auch die
// vorgeschaltete DNS-Auflösung ist unbegrenzt." Und seine Prüffrage: „Eine Socket-Inaktivitätsgrenze
// ersetzt keine absolute Frist."
//
// ER HAT RECHT, UND ZWAR AN EINER STELLE, DIE KEIN BISHERIGER FALL SEHEN KONNTE: Alle Fälle aus
// Runde 3 injizieren `inhaltsTransport` — sie messen den Vertrag ÜBER dem Transport und nie den
// Transport selbst. Genau dort sass der Fehler. `timeout:` an `node:https` ist eine
// UNTÄTIGKEITSGRENZE: sie läuft bei jedem empfangenen Byte neu los. Eine Gegenstelle, die alle 20 ms
// ein Zeichen schickt, hält den Abruf damit beliebig lange fest, ohne die Grenze je zu verletzen.
//
// DIESE DATEI MISST DESHALB DEN ECHTEN `gebundenerTransport`. Attrappe ist genau eine Ebene tiefer:
// das Modul `node:https` selbst. Damit läuft der Produktionscode des Inhaltswegs unverändert — die
// Zielprüfung, die Adressbindung, der Bytezähler, die Fristbehandlung — und nur der Socket darunter
// ist nachgebaut. Es entsteht KEIN Server, KEIN Lauscher, KEIN Socket und keine DNS-Anfrage.
//
// WAS HIER NICHT BEHAUPTET WIRD: ein echter TLS-Verbindungsaufbau, ein echter Netzstapel, eine echte
// Microsoft-365-Quelle. Gemessen ist das Verhalten des Codes gegen einen Strom, der sich so verhält,
// wie ein Socket sich verhält.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** Der bekannte Inhalt — derselbe wie in C1, damit die Kalibrierung dieselbe Sprache spricht. */
const TEXT = "ZEILE EINS\nZEILE ZWEI";

/** Die Frist dieser Fälle. Kurz, damit die Messung kurz ist — die GRENZE des Betriebs ist grösser. */
const FRIST_MS = 120;

/**
 * Die Stellschrauben der gefälschten Gegenstelle. Sie sind hoisted, weil die Attrappenfabrik von
 * `vi.mock` vor allen Importen dieser Datei läuft.
 *
 *   `sofort`  — Antwort und Inhalt kommen unverzüglich. Die KALIBRIERUNG: ohne sie wäre eine Frist,
 *               die einfach alles abbricht, ebenfalls „grün" und der Inhaltsweg tot.
 *   `tropfen` — alle 20 ms EIN Byte, endlos. Der Socket wird nie untätig; genau bens Fall.
 *   `still`   — die Gegenstelle nimmt die Verbindung an und antwortet dann gar nicht mehr.
 */
const h = vi.hoisted(() => ({
  art: "sofort" as "sofort" | "tropfen" | "still",
  status: 200,
  /** Jede wirklich gebaute Verbindung mit ihrem Abbauzustand — „beenden" wird gemessen, nicht geglaubt. */
  verbindungen: [] as { abgebaut: boolean; hatAuthorization: boolean }[],
  /** Die laufenden Tropfen-Ticker, damit keiner den Lauf überlebt. */
  ticker: [] as ReturnType<typeof setInterval>[],
}));

vi.mock("node:https", async () => {
  const { EventEmitter } = await import("node:events");
  const request = (
    _url: string,
    optionen: Record<string, unknown>,
    rueckruf: (antwort: unknown) => void,
  ): unknown => {
    const koepfe = (optionen.headers ?? {}) as Record<string, string>;
    const buch = {
      abgebaut: false,
      hatAuthorization: Object.keys(koepfe).some((k) => k.toLowerCase() === "authorization"),
    };
    h.verbindungen.push(buch);

    const anfrage = new EventEmitter();
    Object.assign(anfrage, {
      end: (): void => undefined,
      destroy: (fehler?: Error): void => {
        buch.abgebaut = true;
        // Ein abgebauter `ClientRequest` meldet sich im Betrieb als `error` — dieselbe Reihenfolge.
        if (fehler) {
          anfrage.emit("error", fehler);
        }
      },
    });

    // Die Antwort kommt asynchron, wie im Betrieb: nie im selben Zug wie der Aufruf.
    setTimeout(() => {
      if (h.art === "still") {
        // Angenommen und dann Schweigen. Kein `data`, kein `end`, kein `timeout`.
        return;
      }
      const antwort = new EventEmitter();
      Object.assign(antwort, {
        statusCode: h.status,
        headers: {},
        destroy: (): void => undefined,
      });
      rueckruf(antwort);
      if (h.art === "sofort") {
        setTimeout(() => {
          antwort.emit("data", Buffer.from(TEXT, "utf8"));
          antwort.emit("end");
        }, 1);
        return;
      }
      // TROPFEN: ein Byte alle 20 ms, endlos. Eine Untätigkeitsgrenze greift hier NIE.
      const ticker = setInterval(() => antwort.emit("data", Buffer.from("x", "utf8")), 20);
      h.ticker.push(ticker);
      anfrage.on("error", () => clearInterval(ticker));
    }, 1);

    return anfrage;
  };
  return { request };
});

import {
  SharePointGraphClient,
  type SharePointInhalt,
  sharepointFehlerlage,
} from "../../services/sharepoint/src/graph-client";

const TEXTDATEI = {
  id: "01NOTIZTXT",
  name: "Wartungsnotiz.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsnotiz.txt",
  lastModifiedDateTime: "2026-09-12T09:15:00Z",
  size: Buffer.byteLength(TEXT, "utf8"),
  file: { mimeType: "text/plain" },
  "@microsoft.graph.downloadUrl": "https://download.sharepoint.test/vorautorisiert/01NOTIZTXT",
};

/** Die Auflösung des Betriebs wäre echtes DNS — sie ist hier injiziert und geht nirgendwohin. */
const OEFFENTLICH = async (): Promise<readonly string[]> => ["93.184.216.34"];

function client(aufloeseFn: () => Promise<readonly string[]> = OEFFENTLICH): SharePointGraphClient {
  return new SharePointGraphClient({
    baseUrl: "https://graph.microsoft.test/v1.0",
    accessToken: "vertragsdouble-nur-fuer-den-test-4232",
    driveId: "b!inhaltsbibliothek",
    timeoutMs: FRIST_MS,
    aufloeseFn,
    // KEIN `inhaltsTransport`: DAS ist der Punkt dieser Datei. Hier läuft der echte
    // `gebundenerTransport` über das gefälschte `node:https`.
  });
}

/** Wie lange ein Weg wirklich gebraucht hat — und was er ergeben hat. */
async function miss(
  aufgabe: Promise<SharePointInhalt>,
): Promise<{ ms: number; fehler: unknown; wert: SharePointInhalt | null }> {
  const start = Date.now();
  try {
    const wert = await aufgabe;
    return { ms: Date.now() - start, fehler: null, wert };
  } catch (fehler) {
    return { ms: Date.now() - start, fehler, wert: null };
  }
}

beforeEach(() => {
  h.art = "sofort";
  h.status = 200;
  h.verbindungen = [];
});

afterEach(() => {
  for (const t of h.ticker) {
    clearInterval(t);
  }
  h.ticker = [];
});

describe("JOB 4232 · F — die Frist des Inhaltswegs ist ABSOLUT, nicht nur eine Untätigkeitsgrenze", () => {
  // ----------------------------------------------------------------------------------------------
  // F1 — BENS FALL, WÖRTLICH: „alle 40 ms ein Datenstück, Frist 100 ms".
  // ----------------------------------------------------------------------------------------------
  it("F1: ein DAUERSTROM bricht fristgerecht ab — und die Verbindung wird wirklich beendet", async () => {
    h.art = "tropfen";
    const { ms, fehler, wert } = await miss(client().holeTextInhalt(TEXTDATEI));

    // (1) Er bricht ab — und zwar als eine der VIER Lagen, nicht als fremder Fehler.
    expect(wert, "ein Dauerstrom darf keinen Inhalt ergeben").toBeNull();
    expect(sharepointFehlerlage(fehler)).toBe("nicht-erreichbar");
    // (2) Und er bricht INNERHALB der Grenze ab. Das ist der ganze Befund: ohne absolute Frist
    //     läuft dieser Weg endlos weiter, weil der Socket nie untätig wird.
    expect(ms, `der Abruf lief ${ms} ms trotz einer Frist von ${FRIST_MS} ms`).toBeLessThan(
      FRIST_MS * 6,
    );
    // (3) „Aktive Verbindungen dabei beenden" (bens Wortlaut) — gemessen am Abbau, nicht behauptet.
    expect(h.verbindungen.length, "es wurde eine Verbindung gebaut").toBe(1);
    expect(h.verbindungen[0]?.abgebaut, "die laufende Verbindung muss abgebaut werden").toBe(true);
  });

  // ----------------------------------------------------------------------------------------------
  // F2 — DIE HÄNGENDE AUFLÖSUNG. Sie liegt VOR jeder Verbindung und war deshalb von keiner
  // Transportgrenze gedeckt: `dns.lookup` kennt kein Abbruchsignal.
  // ----------------------------------------------------------------------------------------------
  it("F2: eine hängende Namensauflösung hält den Aufrufer nicht fest — und verbindet danach nicht", async () => {
    const haengt = (): Promise<readonly string[]> =>
      new Promise<readonly string[]>(() => undefined);
    const { ms, fehler, wert } = await miss(client(haengt).holeTextInhalt(TEXTDATEI));

    expect(wert).toBeNull();
    expect(sharepointFehlerlage(fehler)).toBe("nicht-erreichbar");
    expect(ms, `die Auflösung hielt ${ms} ms trotz einer Frist von ${FRIST_MS} ms`).toBeLessThan(
      FRIST_MS * 6,
    );
    // WER NICHT WEISS, WOHIN EIN NAME ZEIGT, VERBINDET NICHT — auch nicht nach der Frist.
    expect(h.verbindungen.length, "ohne geprüfte Adresse darf keine Verbindung entstehen").toBe(0);
  });

  // ----------------------------------------------------------------------------------------------
  // F3 — DIE STILLE GEGENSTELLE: angenommen und dann nichts. Kein `data`, kein `end`.
  // ----------------------------------------------------------------------------------------------
  it("F3: eine Gegenstelle, die schweigt, läuft in dieselbe Frist", async () => {
    h.art = "still";
    const { ms, fehler, wert } = await miss(client().holeTextInhalt(TEXTDATEI));

    expect(wert).toBeNull();
    expect(sharepointFehlerlage(fehler)).toBe("nicht-erreichbar");
    expect(ms).toBeLessThan(FRIST_MS * 6);
    expect(h.verbindungen[0]?.abgebaut, "auch die stille Verbindung wird abgebaut").toBe(true);
  });

  // ----------------------------------------------------------------------------------------------
  // F4 — DIE KALIBRIERUNG. Ohne sie wäre eine Frist, die einfach ALLES abbricht, ebenfalls grün.
  // ----------------------------------------------------------------------------------------------
  it("F4: der gewöhnliche Download gelingt weiterhin — mit genau dem Text, ohne Zugangsmerkmal", async () => {
    const { fehler, wert } = await miss(client().holeTextInhalt(TEXTDATEI));

    expect(fehler, "der normale Weg darf nicht abbrechen").toBeNull();
    expect(wert).toEqual({ art: "text", text: TEXT });
    // Und der Downloadweg trägt weiterhin KEIN Zugangsmerkmal (Gegenprobe b aus §7 des Auftrags).
    expect(h.verbindungen[0]?.hatAuthorization).toBe(false);
    expect(h.verbindungen[0]?.abgebaut, "eine gelungene Verbindung wird nicht abgebrochen").toBe(
      false,
    );
  });
});
