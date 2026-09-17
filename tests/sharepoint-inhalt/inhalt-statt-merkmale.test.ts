// ================================================================================================
// JOB 4232 · C1/C2 — INHALT STATT MERKMALE: DER TEXT EINER TEXTDATEI KOMMT WIRKLICH AN.
// ================================================================================================
//
// DER SATZ, DEN DIESE DATEI MISST: „Wähle ich eine Textdatei aus der SharePoint-Bibliothek, steht
// nach der Übernahme IHR TEXT im Eintrag — nicht ihr Dateiname. Wähle ich irgendeinen anderen Typ,
// steht dort weiterhin kein Volltext, und die Liste sagt das VORHER."
//
// ================================================================================================
// WAS ECHT IST UND WAS VERTRAGSDOUBLE.
// ================================================================================================
//
// Echt sind der Adapter, der Graph-Client, der Mapper und die Härtungen dazwischen. Attrappe sind
// GENAU die zwei Netzgrenzen — und seit JOB 4232 R3 sind es wirklich zwei, weil der Client zwei
// Transporte hat:
//
//   METADATEN → `globalThis.fetch`, für die Dauer dieser Datei ersetzt. Jede Adresse ausserhalb der
//               gepinnten Graph-Origin landet in `fremdeAufrufe`.
//   INHALT    → der INJIZIERTE `inhaltsTransport`. Er ist die vom Auftrag ausdrücklich verlangte
//               Vorrichtung (Lieferung 10) und sieht zusätzlich, auf WELCHE Adresse gebunden wurde.
//
// `fremdeAufrufe` wird ausdrücklich als leer geprüft: ein Versuch, irgendwo sonst hinzugreifen,
// WÜRDE auffallen. Es geht hier also nicht nur „kein echter Aufruf hinaus"; es ist gemessen. Auch
// die Namensauflösung ist injiziert — es geht nicht einmal eine DNS-Anfrage hinaus.
//
// KEIN SYNTHETISCHER GEGENSERVER, KEIN SOCKET, KEIN LAUSCHER.
//
// KEIN GEFAHRENER GRAPH-LAUF WIRD BEHAUPTET. Was hier läuft, ist der Vertrag, nicht Microsoft 365.
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  SHAREPOINT_MAX_TEXT_BYTES,
  type SharePointInhaltsTransport,
  SharePointSourceAdapter,
} from "../../services/sharepoint";
// JOB 4232 R2/R3: Die Zielsperre und der gebundene Verbindungsaufbau sind modul-INTERN (sie dürfen
// die Paket-index nicht verlassen, das hält `encapsulation.test.ts` fest). Gemessen werden sie
// deshalb an ihrer Quelle — reine Funktionen, ohne Netz und ohne Attrappe.
import {
  type SharePointAufloesung,
  SharePointGraphClient,
  istPrivateAdresse,
  pinneAufAdresse,
  pruefeDownloadUrl,
  pruefeDownloadZiel,
} from "../../services/sharepoint/src/graph-client";

const GRAPH = "https://graph.microsoft.test/v1.0";
const DRIVE = "b!inhaltsbibliothek";
/** Die vorautorisierte Downloadadresse von Graph — ein ANDERER Host als die gepinnte Basis. */
const DOWNLOAD = "https://download.sharepoint.test/vorautorisiert/";

const UMGEBUNG = {
  KLARWERK_SHAREPOINT_BASE_URL: GRAPH,
  KLARWERK_SHAREPOINT_TOKEN: "vertragsdouble-nur-fuer-den-test-4232",
  KLARWERK_SHAREPOINT_DRIVE: DRIVE,
};

/** Der bekannte Inhalt aus dem Auftrag (§6, Fall C1). Er wird ZEICHENGLEICH zurückerwartet. */
const TEXT = "ZEILE EINS\nZEILE ZWEI";

const TEXTDATEI = {
  id: "01NOTIZTXT",
  name: "Wartungsnotiz.txt",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsnotiz.txt",
  lastModifiedDateTime: "2026-09-12T09:15:00Z",
  size: Buffer.byteLength(TEXT, "utf8"),
  file: { mimeType: "text/plain" },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

/** Ein Typ, den dieser Weg NICHT lesen kann. Er bleibt „nur Merkmale" — ehrlich benannt. */
const WORDDATEI = {
  id: "01ANWEISUNGDOCX",
  name: "Wartungsanweisung.docx",
  webUrl: "https://contoso.sharepoint.test/sites/technik/Freigegeben/Wartungsanweisung.docx",
  lastModifiedDateTime: "2026-09-10T08:30:00Z",
  size: 24_576,
  description: "Wartung der Abfüllanlage, Stand September.",
  file: {
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  lastModifiedBy: { user: { displayName: "R. Schuster" } },
};

const echtesFetch = globalThis.fetch;
let fremdeAufrufe: string[] = [];
/** Die Kopfzeilen JEDES Downloadaufrufs — der Sicherheitsfall liest sie, statt sie zu glauben. */
let downloadKoepfe: Record<string, string>[] = [];
/** Der Inhalt, den das Double je Datei ausliefert (Bytes, damit die Kodierprüfung echt greift). */
let inhalte = new Map<string, Buffer>();

// Die vier Stellschrauben der Quelle. Jede Probe stellt sie ein; `beforeEach` setzt sie zurück, damit
// keine Probe von der Einstellung einer anderen lebt.
/** Die Quelle meldet KEINEN Medientyp — dann darf aus der Endung nichts geschlossen werden. */
let ohneMedientyp = false;
/** Die Grösse, die die Quelle MELDET (sie kann von den wirklich gelieferten Bytes abweichen). */
let groesse: number = Buffer.byteLength(TEXT, "utf8");
/** Die Adresse, die die Quelle als Inhaltsadresse nennt — auch eine bösartige. */
let downloadAdresse: string | null = null;
/** Der Status, mit dem der Downloadhost antwortet. */
let downloadStatus = 200;

function alsQuelle(datei: typeof TEXTDATEI | typeof WORDDATEI) {
  const istText = datei.id === TEXTDATEI.id;
  return {
    ...datei,
    ...(istText ? { size: groesse } : {}),
    ...(istText && ohneMedientyp ? { file: {} } : {}),
  };
}

// ================================================================================================
// JOB 4232 RUNDE 3 — DER INHALTSWEG HAT EINEN EIGENEN TRANSPORT, ALSO AUCH EIN EIGENES DOUBLE.
// ================================================================================================
//
// Seit dieser Runde baut der Inhaltsweg seine Verbindung selbst auf, um sie an die geprüfte Adresse
// zu binden (bens Korrekturpflicht 1). Er geht deshalb NICHT mehr durch `globalThis.fetch`. Das
// Double dafür ist der injizierte `inhaltsTransport` — die ausdrücklich vorgesehene Vorrichtung
// (Lieferung 10), und damit ein Weg NÄHER am Auftrag als der frühere Griff an das globale `fetch`.
//
// ER SIEHT, WAS DER ECHTE TRANSPORT SIEHT: die Adresse, auf die gebunden wurde. Der Sicherheitsfall
// prüft sie, statt sie zu glauben.
let gebundeneAdressen: string[] = [];
const transportDouble: SharePointInhaltsTransport = async (url, optionen) => {
  downloadKoepfe.push({ accept: optionen.akzeptiert });
  gebundeneAdressen.push(optionen.adresse);
  if (!url.startsWith(DOWNLOAD)) {
    fremdeAufrufe.push(url);
    throw new Error("fremder Host");
  }
  if (downloadStatus !== 200) {
    return { status: downloadStatus, bytes: null };
  }
  const id = decodeURIComponent(url.slice(DOWNLOAD.length));
  const bytes = inhalte.get(id);
  if (bytes === undefined) {
    return { status: 404, bytes: null };
  }
  return bytes.byteLength > optionen.maxBytes
    ? { status: 200, bytes: null }
    : { status: 200, bytes };
};

globalThis.fetch = (async (eingabe: string | URL, init?: RequestInit) => {
  const url = String(eingabe);
  void init;

  if (!url.startsWith(GRAPH)) {
    fremdeAufrufe.push(url);
    throw new Error("fremder Host");
  }

  const dateien = [TEXTDATEI, WORDDATEI];
  const treffer = /\/items\/([^/?]+)/.exec(url);
  if (treffer) {
    const datei = dateien.find((d) => d.id === decodeURIComponent(treffer[1] ?? ""));
    if (!datei) {
      return new Response(JSON.stringify({}), { status: 404 });
    }
    // Die vorautorisierte Adresse liefert Graph NUR beim gezielten Abruf mit — sie steht nie in der
    // Liste (sie ist ein Schlüssel auf Zeit, und eine Liste voller Schlüssel wäre eine Halde).
    const mitAdresse = url.includes("downloadUrl");
    return new Response(
      JSON.stringify({
        ...alsQuelle(datei),
        ...(mitAdresse
          ? {
              "@microsoft.graph.downloadUrl":
                downloadAdresse ?? `${DOWNLOAD}${encodeURIComponent(datei.id)}`,
            }
          : {}),
      }),
      { status: 200 },
    );
  }
  return new Response(JSON.stringify({ value: dateien.map(alsQuelle) }), { status: 200 });
}) as unknown as typeof fetch;

afterAll(() => {
  globalThis.fetch = echtesFetch;
});

beforeEach(() => {
  fremdeAufrufe = [];
  downloadKoepfe = [];
  gebundeneAdressen = [];
  ohneMedientyp = false;
  groesse = Buffer.byteLength(TEXT, "utf8");
  downloadAdresse = null;
  downloadStatus = 200;
  inhalte = new Map([[TEXTDATEI.id, Buffer.from(TEXT, "utf8")]]);
});

/**
 * Der Adapter dieses Falls — mit BEIDEN Vorrichtungen ausdrücklich injiziert.
 *
 * JOB 4232 R3: Bis Runde 2 lief das über `createSharePointAdapterFromEnv` und ein global ersetztes
 * `fetch`. Seit der Inhaltsweg seine Verbindung selbst aufbaut, ist die ausdrückliche Injektion der
 * einzige ehrliche Weg — und sie ist auch der vom Auftrag verlangte (§5 Lieferung 10: „nur in einer
 * ausdrücklich injizierten Vorrichtung"). Die Auflösung ist ebenfalls injiziert: so geht aus diesem
 * Fall keine einzige DNS-Anfrage hinaus.
 */
function adapter(aufloeseFn: SharePointAufloesung = async () => ["93.184.216.34"]) {
  return new SharePointSourceAdapter(
    new SharePointGraphClient({
      baseUrl: GRAPH,
      accessToken: UMGEBUNG.KLARWERK_SHAREPOINT_TOKEN,
      driveId: DRIVE,
      inhaltsTransport: transportDouble,
      aufloeseFn,
    }),
  );
}

// ================================================================================================
// JOB 4232 RUNDE 2 · C6 — DIE SPERRE PRIVATER ZIELE, AN DEN ZAHLEN STATT AM TEXT.
// ================================================================================================
//
// DIE GEGENPROBE, DIE BEN GEFAHREN HAT (Korrekturpflicht 1): Vier Schreibweisen gingen an der Sperre
// aus Runde 1 vorbei — `::ffff:127.0.0.1`, `::ffff:10.0.0.5`, `::ffff:169.254.169.254` und
// `localhost.`. Sie stehen hier ALLE, zusammen mit ihrer normalisierten Form, wie `new URL()` sie
// wirklich liefert: das ist der Punkt, an dem die Textsuche aus Runde 1 scheiterte
// (`::ffff:127.0.0.1` wird zu `::ffff:7f00:1`, und dort steht kein `127.` mehr).
//
// GEPRÜFT WIRD DIE REINE FUNKTION — kein Netz, kein Aufruf, keine Attrappe nötig.
describe("JOB 4232 · C6: private Ziele, in JEDER Schreibweise", () => {
  it("die vier von Ben gemessenen Umgehungen sind gesperrt", () => {
    for (const adresse of [
      // bens vier Wege, wörtlich
      "https://[::ffff:127.0.0.1]/x",
      "https://[::ffff:10.0.0.5]/x",
      "https://[::ffff:169.254.169.254]/x",
      "https://localhost./x",
      // und dieselben Adressen so, wie `new URL()` sie normalisiert — die Form, in der sie im
      // Betrieb wirklich ankommen.
      "https://[::ffff:7f00:1]/x",
      "https://[::ffff:a00:5]/x",
      "https://[::ffff:a9fe:a9fe]/x",
    ]) {
      expect(() => pruefeDownloadUrl(adresse), adresse).toThrow();
    }
  });

  it("die gewöhnlichen privaten Bereiche bleiben gesperrt — v4 wie v6", () => {
    for (const host of [
      "127.0.0.1",
      "10.0.0.5",
      "172.16.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fe80::1",
      "fd00::1",
      "64:ff9b::127.0.0.1",
      "LOCALHOST.",
      "Etwas.LocalHost",
    ]) {
      expect(istPrivateAdresse(host) || host.toLowerCase().includes("localhost"), host).toBe(true);
    }
  });

  it("KALIBRIERUNG: öffentliche Adressen und Namen bleiben erlaubt", () => {
    // Ohne diese Probe wäre eine Sperre, die einfach ALLES ablehnt, ebenfalls „grün" — und der
    // Inhaltsweg wäre tot.
    for (const adresse of [
      "https://download.sharepoint.test/x",
      "https://contoso.sharepoint.com/x",
      "https://8.8.8.8/x",
      "https://[2606:4700::1111]/x",
    ]) {
      expect(() => pruefeDownloadUrl(adresse), adresse).not.toThrow();
    }
    expect(istPrivateAdresse("8.8.8.8")).toBe(false);
    expect(istPrivateAdresse("2606:4700::1111")).toBe(false);
  });
});

// ================================================================================================
// JOB 4232 RUNDE 2 · C7 — DER NAME, DER INS INNERE ZEIGT (bens dritte Lücke).
// ================================================================================================
//
// In der Adresse `https://speicher.example.test/datei` ist NICHTS zu sehen. Erst die Auflösung sagt,
// wohin sie führt. Ben hat genau das als Lücke benannt: „aufgelöste private Adressen berücksichtigen
// … Ablehnung VOR Verbindungsaufbau".
//
// Die Auflösung ist hier INJIZIERT — aus demselben Grund wie `fetchFn`: eine Sperre, die nur mit
// echtem DNS messbar wäre, wäre gar nicht gemessen. Und es geht dabei keine einzige Anfrage hinaus.
describe("JOB 4232 · C7: die Zielprüfung löst den Namen auf, bevor sie verbindet", () => {
  const aufloesung = (adressen: readonly string[]): SharePointAufloesung => {
    return async () => adressen;
  };

  it("ein Name, der auf eine private Adresse zeigt, wird abgelehnt", async () => {
    for (const adressen of [
      ["127.0.0.1"],
      ["169.254.169.254"],
      ["::ffff:10.0.0.5"],
      // Auch wenn nur EINE von mehreren Adressen privat ist: der Verbindungsaufbau könnte genau
      // diese wählen. Eine Sperre, die den Durchschnitt bildet, wäre keine.
      ["93.184.216.34", "10.1.2.3"],
    ]) {
      await expect(
        pruefeDownloadZiel("https://speicher.example.test/datei", aufloesung(adressen)),
        adressen.join(","),
      ).rejects.toThrow();
    }
  });

  it("ein Name, der öffentlich auflöst, kommt durch — und nennt die Adresse, auf die zu binden ist", async () => {
    // JOB 4232 R3: Die Prüfung wirft die Adresse nicht mehr weg. Genau sie bindet der
    // Verbindungsaufbau, und deshalb muss sie hier herauskommen.
    await expect(
      pruefeDownloadZiel("https://speicher.example.test/datei", aufloesung(["93.184.216.34"])),
    ).resolves.toBe("93.184.216.34");
  });

  it("FAIL-CLOSED: scheitert die Auflösung oder ist sie leer, wird ABGEBROCHEN", async () => {
    // JOB 4232 R3 — DIE UMKEHR AUS RUNDE 2. Dort ging dieser Fall weiter, mit der Begründung, ohne
    // Adresse käme ohnehin keine Verbindung zustande. Ben hat gemessen, dass der Abruf danach
    // trotzdem stattfindet — und die Begründung trug auch sachlich nicht: Wer die Auflösung
    // beherrscht, lässt den ersten Versuch scheitern und den zweiten gelingen. Wer nicht weiss,
    // wohin ein Name zeigt, verbindet nicht.
    const kaputt: SharePointAufloesung = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(
      pruefeDownloadZiel("https://speicher.example.test/datei", kaputt),
    ).rejects.toThrow();
    await expect(
      pruefeDownloadZiel("https://speicher.example.test/datei", aufloesung([])),
    ).rejects.toThrow();
  });

  it("und am ganzen Weg: keine Adresse heisst KEIN Abruf", async () => {
    // Nicht nur die Funktion — der Weg. Ohne brauchbare Auflösung darf der Transport nicht einmal
    // gerufen werden (bens Messung: „Der injizierte Download wird trotzdem aufgerufen").
    downloadAdresse = "https://speicher.example.test/datei";
    const kaputt: SharePointAufloesung = async () => {
      throw new Error("ENOTFOUND");
    };
    const fehler = await adapter(kaputt)
      .holeItem(TEXTDATEI.id)
      .then(() => null)
      .catch((err: unknown) => err);
    expect((fehler as { lage?: string })?.lage).toBe("nicht-erreichbar");
    expect(downloadKoepfe, "kein Abruf ohne geprüftes Ziel").toEqual([]);
    expect(gebundeneAdressen).toEqual([]);
  });

  it("eine ADRESSE wird nicht aufgelöst — sie ist schon entschieden", async () => {
    let gefragt = 0;
    const zaehlend: SharePointAufloesung = async () => {
      gefragt += 1;
      return ["93.184.216.34"];
    };
    // Eine private Adresse fällt durch, OHNE dass jemand einen Namen auflöst …
    await expect(pruefeDownloadZiel("https://127.0.0.1/datei", zaehlend)).rejects.toThrow();
    // … und eine öffentliche kommt durch, ebenfalls ohne Auflösung — und nennt sich selbst als
    // Bindungsziel.
    await expect(pruefeDownloadZiel("https://8.8.8.8/datei", zaehlend)).resolves.toBe("8.8.8.8");
    expect(gefragt, "eine Adresse braucht keine Namensauflösung").toBe(0);
  });
});

// ================================================================================================
// JOB 4232 RUNDE 3 · C8 — EIN DNS-WECHSEL KANN DAS ZIEL NICHT MEHR VERSCHIEBEN.
// ================================================================================================
//
// DAS FENSTER, das Runde 2 nur beschrieben hat: zwischen der Prüfung und dem Verbinden kann eine
// zweite Auflösung eine ANDERE Adresse liefern (DNS-Rebinding). Ben: „seine Dokumentation erfüllt
// die Sperrpflicht nicht."
//
// GESCHLOSSEN WIRD ES DADURCH, dass der Verbindungsaufbau gar nicht mehr auflöst: `pinneAufAdresse`
// ist die Namensauflösung, die dem Verbindungsaufbau untergeschoben wird, und sie antwortet IMMER
// mit der geprüften Adresse — egal, welchen Namen sie bekommt und egal, was das echte DNS
// inzwischen sagen würde. Das ist eine reine Funktion und hier ohne Netz gemessen.
describe("JOB 4232 · C8: die gebundene Auflösung ignoriert jeden späteren Wechsel", () => {
  const frage = (
    pinne: ReturnType<typeof pinneAufAdresse>,
    hostname: string,
    optionen: unknown,
  ): unknown[] =>
    new Promise<unknown[]>((fertig) => {
      (pinne as unknown as (h: string, o: unknown, cb: (...a: unknown[]) => void) => void)(
        hostname,
        optionen,
        (...args: unknown[]) => fertig(args),
      );
    }) as unknown as unknown[];

  it("sie liefert die geprüfte Adresse — für JEDEN Namen, den der Verbindungsaufbau nennt", async () => {
    const pinne = pinneAufAdresse("93.184.216.34");
    for (const name of [
      "speicher.example.test",
      // Genau der Wechsel, gegen den das steht: der Name zeigt inzwischen nach innen. Die Bindung
      // interessiert sich nicht dafür.
      "boeser.example.test",
      "localhost",
    ]) {
      const [fehler, adresse, familie] = (await frage(pinne, name, undefined)) as [
        unknown,
        string,
        number,
      ];
      expect(fehler, name).toBeNull();
      expect(adresse, name).toBe("93.184.216.34");
      expect(familie, name).toBe(4);
    }
  });

  it("auch in der Listenform (`all: true`) — dort kommt keine zweite Adresse dazu", async () => {
    const pinne = pinneAufAdresse("93.184.216.34");
    const [fehler, adressen] = (await frage(pinne, "boeser.example.test", { all: true })) as [
      unknown,
      { address: string; family: number }[],
    ];
    expect(fehler).toBeNull();
    expect(adressen).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("eine IPv6-Adresse wird als IPv6 gebunden — sonst käme keine Verbindung zustande", async () => {
    const pinne = pinneAufAdresse("2606:4700::1111");
    const [, adresse, familie] = (await frage(pinne, "irgendwas.test", undefined)) as [
      unknown,
      string,
      number,
    ];
    expect(adresse).toBe("2606:4700::1111");
    expect(familie).toBe(6);
  });
});

describe("JOB 4232 · C1: eine Textdatei trägt ihren Text bis ins ImportItem", () => {
  it("der volle Weg Adapter → Mapper → ImportItem liefert den GELESENEN Text als Volltext", async () => {
    const eintrag = await adapter().holeItem(TEXTDATEI.id);

    // Der Weg hat den Inhalt WIRKLICH gelesen — und sagt das als eigene Auskunft, nicht nur als Feld.
    expect(eintrag?.inhalt).toEqual({ art: "text", text: TEXT });
    // Und der Volltext des Import-Vertrags trägt genau diesen Text, beide Zeilen, in der Reihenfolge
    // der Quelle. Geprüft wird am KLARTEXT, damit der Fall nicht an der HTML-Verpackung hängt.
    const klartext = (eintrag?.item.bodyHtml ?? "")
      .replace(/<[^>]+>/g, "\n")
      .replace(/\s+/g, " ")
      .trim();
    expect(klartext).toBe("ZEILE EINS ZEILE ZWEI");
    // Kein Netzaufruf ausserhalb der zwei erlaubten Adressen.
    expect(fremdeAufrufe).toEqual([]);
  });

  it("die Kernaussage kommt aus dem gelesenen Text und nicht mehr aus dem Dateinamen", async () => {
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    // Auf dem Ausgangsstand stand hier der Dateiname (`mapper.ts:99`) — Merkmal statt Aussage.
    expect(eintrag?.item.statement).toBe("ZEILE EINS ZEILE ZWEI");
    expect(eintrag?.item.statement).not.toBe(TEXTDATEI.name);
  });
});

describe("JOB 4232 · C2: jeder andere Typ bleibt nur Merkmale — und sagt es vorher", () => {
  it("eine .docx trägt weiterhin KEINEN Volltext (die Zusage bleibt für sie gültig)", async () => {
    const eintrag = await adapter().holeItem(WORDDATEI.id);

    expect(eintrag?.item.bodyHtml).toBeUndefined();
    expect(eintrag?.inhalt).toEqual({ art: "nur-merkmale" });
    // Für sie bleibt die alte Regel: die Beschreibung der Quelle ist die Kernaussage.
    expect(eintrag?.item.statement).toBe(WORDDATEI.description);
  });

  it("die Auswahlliste kennzeichnet VOR der Annahme, was Inhalt bringt und was nur Merkmale", async () => {
    const { dateien } = await adapter().listeDateien();

    const zeile = (id: string) => dateien.find((d) => d.id === id);
    expect(zeile(TEXTDATEI.id)?.inhaltstyp).toBe("text");
    expect(zeile(WORDDATEI.id)?.inhaltstyp).toBe("nur-merkmale");
    // Die Kennzeichnung ist eine MESSUNG der Quelle (der Medientyp aus dem DriveItem-Vertrag) und
    // keine Ableitung aus dem Dateinamen: beide Zeilen tragen hier denselben Namen wie in der Quelle.
    expect(fremdeAufrufe).toEqual([]);
  });

  it("der Dateiname ALLEIN macht keinen Inhalt: `.txt` ohne gemeldeten Medientyp bleibt Merkmal", async () => {
    // Genau die Verwechslung, die der Auftrag ausschliesst: Die Endung ist eine Behauptung des
    // NAMENS, nicht der Datei. Ohne gemessenen Medientyp wird hier nichts versprochen.
    ohneMedientyp = true;
    const { dateien } = await adapter().listeDateien();
    expect(dateien.find((d) => d.id === TEXTDATEI.id)?.inhaltstyp).toBe("nur-merkmale");

    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "nur-merkmale" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
    // Und es ging kein Inhaltsabruf hinaus — es gab nichts zu holen.
    expect(downloadKoepfe).toEqual([]);
  });
});

describe("JOB 4232 · C3: der Inhaltsweg trägt KEIN Zugangsmerkmal nach draussen", () => {
  it("auf die vorautorisierte Downloadadresse geht kein `Authorization`-Kopf", async () => {
    const eintrag = await adapter().holeItem(TEXTDATEI.id);

    // Der Weg wurde wirklich gegangen — die Zusage ist nicht deshalb wahr, weil nichts geschah.
    expect(eintrag?.inhalt.art).toBe("text");
    expect(downloadKoepfe).toHaveLength(1);
    expect(Object.keys(downloadKoepfe[0] ?? {})).not.toContain("authorization");
    // JOB 4232 R3: Seit der Inhaltsweg seine Verbindung selbst aufbaut, ist das STRUKTURELL — der
    // Transportvertrag hat gar kein Feld für Kopfzeilen ausser `akzeptiert`. Hier wird deshalb
    // zusätzlich geprüft, dass durch den einzigen Kanal, den es gibt, nichts durchkommt.
    expect(JSON.stringify(downloadKoepfe)).not.toContain(UMGEBUNG.KLARWERK_SHAREPOINT_TOKEN);
    expect(JSON.stringify(gebundeneAdressen)).not.toContain(UMGEBUNG.KLARWERK_SHAREPOINT_TOKEN);
  });

  it("die Verbindung wird an die GEPRÜFTE Adresse gebunden — nicht an den Namen", async () => {
    // BENS KORREKTURPFLICHT 1, ZWEITER TEIL. Die Auflösung liefert eine öffentliche Adresse; genau
    // diese muss beim Verbindungsaufbau ankommen. Läge dort der Name, entschiede eine ZWEITE
    // Auflösung über das Ziel — und dann wäre das Fenster offen, das diese Runde schliesst.
    const eintrag = await adapter(async () => ["93.184.216.34"]).holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt.art).toBe("text");
    expect(gebundeneAdressen).toEqual(["93.184.216.34"]);
  });

  it("eine Downloadadresse ins private Netz wird abgelehnt — OHNE Netzaufruf", async () => {
    // Die Adresse kommt aus der ANTWORT der Gegenstelle. Ohne diese Sperre bestimmte damit ein
    // fremder Text, wohin diese Installation greift (SSRF) — dieselbe Sorte Vertrauen, die schon
    // der `@odata.nextLink` nicht bekommt.
    for (const boese of [
      "http://download.sharepoint.test/klartext",
      "https://127.0.0.1/interner-dienst",
      "https://169.254.169.254/latest/meta-data/",
      "https://10.0.0.5/intern",
      "https://nutzer:geheim@download.sharepoint.test/mit-zugangsdaten",
    ]) {
      downloadAdresse = boese;
      const eintrag = await adapter()
        .holeItem(TEXTDATEI.id)
        .catch((err: unknown) => err);
      // Entweder eine Lage (Wurf) oder ein Befund — aber NIE ein Text und NIE ein Aufruf dorthin.
      const text = (eintrag as { item?: { bodyHtml?: string } })?.item?.bodyHtml;
      expect(text, boese).toBeUndefined();
      expect(fremdeAufrufe, boese).toEqual([]);
      expect(downloadKoepfe, boese).toEqual([]);
    }
  });
});

describe("JOB 4232 · C4: ungültiges bricht ehrlich ab, statt Text zu erfinden", () => {
  it("eine leere Datei heisst leer — weder übernommen noch nur Merkmale", async () => {
    inhalte.set(TEXTDATEI.id, Buffer.alloc(0));
    groesse = 0;
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "leer" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
  });

  it("kaputte Kodierung wird NICHT zu Text mit Ersatzzeichen", async () => {
    // Abgeschnittene UTF-8-Folge. Der bequeme Weg (`toString('utf8')`) machte daraus einen Text
    // voller U+FFFD, der aussähe wie Inhalt — genau der Schein, den der Auftrag verbietet.
    inhalte.set(TEXTDATEI.id, Buffer.from([0xc3, 0x28, 0xa0, 0xa1]));
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "unlesbar" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
    expect(JSON.stringify(eintrag)).not.toContain("�");
  });

  it("eine Binärdatei mit falsch gemeldetem Medientyp fällt durch (NUL-Byte)", async () => {
    inhalte.set(TEXTDATEI.id, Buffer.from([0x41, 0x00, 0x42]));
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "unlesbar" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
  });

  it("über der Kante: die ANGEKÜNDIGTE Grösse hält den Abruf schon an den Merkmalen an", async () => {
    groesse = SHAREPOINT_MAX_TEXT_BYTES + 1;
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "zu-gross" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
    // Kein Byte wurde dafür geholt.
    expect(downloadKoepfe).toEqual([]);
  });

  it("über der Kante: auch eine UNTERTRIEBENE Grösse führt zu keinem halben Text", async () => {
    // Die Quelle meldet 12 Bytes und schickt dann ein Megabyte. Gemessen wird an den WIRKLICH
    // gelesenen Bytes — sonst bestimmte die Gegenstelle die Grenze dieser Installation.
    groesse = 12;
    inhalte.set(TEXTDATEI.id, Buffer.alloc(SHAREPOINT_MAX_TEXT_BYTES + 1024, 0x41));
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt).toEqual({ art: "zu-gross" });
    expect(eintrag?.item.bodyHtml).toBeUndefined();
  });

  it("403 / 404 / 401 auf dem Inhaltsweg bleiben die vier vorhandenen Lagen — ohne fremden Text", async () => {
    for (const [code, lage] of [
      [403, "keine-berechtigung"],
      [404, "nicht-gefunden"],
      [401, "abgelaufen"],
      [500, "nicht-erreichbar"],
    ] as const) {
      downloadStatus = code;
      const fehler = await adapter()
        .holeItem(TEXTDATEI.id)
        .then(() => null)
        .catch((err: unknown) => err);
      expect((fehler as { lage?: string })?.lage, String(code)).toBe(lage);
      // Kein Statuscode, keine URL, kein fremder Text nach aussen — nur der feste Satz.
      const meldung = String((fehler as { message?: string })?.message ?? "");
      expect(meldung).not.toContain(String(code));
      expect(meldung).not.toContain(DOWNLOAD);
    }
  });
});

describe("JOB 4232 · C5: der gelesene Text kommt ZEICHENGLEICH an", () => {
  it("spitze Klammern überleben den Weg in den HTML-Rumpf", async () => {
    // `bodyHtml` ist ein HTML-Feld, und der Sanitizer der Persistenz wirft Unbekanntes weg. Ohne
    // Maskierung verlöre „<Wert> einsetzen" still seine Klammern — aus echtem Inhalt würde ein
    // anderer.
    inhalte.set(TEXTDATEI.id, Buffer.from('<Wert> & „Text" einsetzen', "utf8"));
    const eintrag = await adapter().holeItem(TEXTDATEI.id);
    expect(eintrag?.inhalt.art).toBe("text");
    const rumpf = eintrag?.item.bodyHtml ?? "";
    expect(rumpf).toContain("&lt;Wert&gt;");
    expect(rumpf).toContain("&amp;");
    // Und kein ungewolltes Element ist dabei entstanden.
    expect(rumpf.replace(/<\/?p>|<br \/>/g, "")).not.toMatch(/<[a-z]/i);
  });

  it("Absätze bleiben Absätze, einfache Umbrüche bleiben Umbrüche", async () => {
    inhalte.set(TEXTDATEI.id, Buffer.from("A1\nA2\n\nB1", "utf8"));
    const rumpf = (await adapter().holeItem(TEXTDATEI.id))?.item.bodyHtml ?? "";
    expect(rumpf).toBe("<p>A1<br />A2</p><p>B1</p>");
  });
});
