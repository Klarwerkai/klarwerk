// ================================================================================================
// DIE ATTRAPPEN DER ENTWURF-VERLASSEN-TESTS — EINMAL, FÜR ALLE DATEIEN DIESES ORDNERS.
// ================================================================================================
//
// JOB 3572, Lieferung 7: Testserver und Bremse standen bis hierher EINMAL in
// `entwurf-verlassen-mounted.test.tsx`. Die zweite Datei dieses Ordners (`dialog-speicherfall-…`)
// braucht dieselben Werkzeuge — sie IMPORTIERT sie, sie schreibt sie nicht ab (Lehre 3550/3571).
//
// WARUM ZWEI MODULE UND NICHT EINES: `huelle.tsx` mountet das Produkt (`CaptureArbeitsraum`) und
// zieht damit `api/endpoints` herein. Die `vi.mock`-Fabrik jeder Testdatei lädt dieses Modul hier
// nach, WÄHREND `api/endpoints` gerade aufgelöst wird — läge die Hülle mit im selben Modul, liefe
// die Auflösung im Kreis. Deshalb steht hier ausschliesslich, was OHNE Produktimport auskommt.
//
// Der SERVER ist ein schreibbarer Bestand, kein festes Objekt: nur so kann ein falscher Bau
// überhaupt auffallen — ein `remove` oder ein `update` beim Verlassen verändert ihn sichtbar.
// Die BREMSE hängt den nächsten `update`/`remove`/`promote` an einem Riegel auf — genau das
// Fenster, in dem sich die Seite verlassen liess, während der Schreibvorgang noch lief.
import { vi } from "vitest";

/** Der Serverbestand. Wird je Fall in `grundzustand()` (huelle.tsx) frisch gesetzt. */
export const server = {
  bestand: {} as Record<string, unknown>,
  // JOB 3770 RUNDE 4: der Objektspeicher. Der Ganzdokument-Weg legt das ORIGINAL dort ab, BEVOR er
  // den Entwurf anlegt (WP-D2 „Original ist heilig", `Capture.tsx` `fileWholeDraft`), und verlinkt
  // es im Rumpf. Ohne diesen Bestand wäre „die Originalreferenz überlebt" nicht messbar: der
  // Platzhalter-Proxy der Attrappe unten liefert für unbekannte Endpunkte eine leere Liste, und
  // `ref.id` wäre `undefined` — der Link fiele still weg und der Test hätte nichts bemerkt.
  objekte: {} as Record<string, { ref: Record<string, unknown>; data: string }>,
};

/** Die Punkte, die die KI-Auswertung des Dateiwegs zurückgibt. Je Fall gesetzt. */
export const extrakt = {
  punkte: [] as { title: string; summary: string; sourceExcerpt: string }[],
};

/**
 * JOB 3600: Titel, deren Anlage scheitert — und zwar SOLANGE sie hier stehen, nicht einmalig.
 * Genau das ist der Fall, um den es geht: derselbe Punkt scheitert beim zweiten Druck wieder,
 * während die anderen längst angelegt sind.
 */
const createFehlerTitel = new Set<string>();

/** Ab jetzt scheitert `drafts.create` für GENAU diese Titel (leere Liste = wieder alle gelingen). */
export function lasseCreateScheiternFuer(...titel: readonly string[]): void {
  createFehlerTitel.clear();
  for (const t of titel) {
    createFehlerTitel.add(t);
  }
}

/**
 * Ein Riegel: `halte()` hängt den nächsten Durchgang auf, bis `loslassen()` kommt. Eine Fabrik,
 * weil der Ordner seit R-0020 drei davon braucht (Schreibvorgänge, Anlage, Objekt-Upload) — drei
 * Abschriften derselben sechs Zeilen wären drei Stellen zum Auseinanderlaufen.
 */
function neueBremse(): {
  halte(): void;
  loslassen(): Promise<void>;
  passiere(): Promise<void>;
} {
  let riegel: (() => void) | null = null;
  let warte: Promise<void> | null = null;
  return {
    /** Ab jetzt hängt der nächste Durchgang, bis `loslassen()` kommt. */
    halte(): void {
      warte = new Promise<void>((r) => {
        riegel = r;
      });
    },
    async loslassen(): Promise<void> {
      riegel?.();
      riegel = null;
      warte = null;
    },
    async passiere(): Promise<void> {
      if (warte) {
        await warte;
      }
    },
  };
}

/**
 * JOB 3572, Lieferung 4 (a): der nächste `update` scheitert EINMAL — der Fall „der Server lehnt ab".
 * Kein Schalter, der stehen bleibt: er verbraucht sich beim ersten Aufruf.
 */
let naechsterUpdateFehler: unknown = null;

/** Hängt den nächsten `update`/`remove`/`promote` auf. */
export const bremse = neueBremse();

/**
 * R-0020: hängt `drafts.create` auf — das Fenster, in dem der Eintrags-Anteil des manuellen Knopfes
 * läuft und `draftId` noch `null` ist. Ein zweiter Klick darin legte bis hierher neu an.
 */
export const anlageBremse = neueBremse();

/**
 * R-0020: hängt `objects.upload` auf — der „angehaltene Upload" des Auftrags. Solange er hängt, ist
 * der Ref-Cache des Originals leer, und jeder zweite Lauf lüde es ein zweites Mal hoch.
 */
export const uploadBremse = neueBremse();

/** Der nächste `drafts.update` wirft diesen Fehler, danach schreibt er wieder normal. */
export function lasseNaechstesUpdateScheitern(fehler: unknown): void {
  naechsterUpdateFehler = fehler;
}

export const draftsGet = vi.fn(async (id: string) => {
  const d = server.bestand[id];
  if (!d) {
    throw new Error(`kein Entwurf ${id}`);
  }
  return JSON.parse(JSON.stringify(d)) as unknown;
});

export const draftsList = vi.fn(
  async () => JSON.parse(JSON.stringify(Object.values(server.bestand))) as unknown[],
);

/** Der Titel, unter dem eine Anlage-Nutzlast im Bestand landet — auch der Messschlüssel unten. */
function titelAus(payload: unknown): string {
  return (payload as { title?: string } | null)?.title ?? "";
}

let neuZaehler = 0;

/**
 * JOB 3600: jede Anlage bekommt eine EIGENE Kennung. Bis hierher schrieb jede auf dieselbe
 * (`neu-1`) — eine doppelt angelegte Entwurfsreihe sah im Bestand danach aus wie eine einfache,
 * und genau der Schaden dieses Auftrags (Doppelungen in „Meine Entwürfe") wäre unsichtbar
 * geblieben. Kein Fall dieses Ordners hat sich je auf `neu-1` berufen.
 */
/**
 * R-0020: die Vorgänge, die der Server kennt — Schlüssel → Kennung und Abdruck. Dieselbe Regel wie
 * `CaptureService.createDraftVorgang`: derselbe Schlüssel mit demselben Inhalt liefert den schon
 * angelegten Entwurf, mit anderem Inhalt `IDEMPOTENCY_PAYLOAD_MISMATCH`; ohne Schlüssel legt jede
 * Anlage neu an.
 *
 * entscheidung:14ce8681/8b909a1e: mit `fortschreiben` schreibt ein anderer Inhalt denselben Entwurf
 * fort, und jede Antwort ohne Neuanlage trägt `anlage` („bestehend"/„fortgeschrieben") — wie die
 * Route `POST /api/drafts`.
 */
const vorgaenge = new Map<string, { id: string; abdruck: string }>();

/**
 * R-0020: die nächste Anlage wird AUSGEFÜHRT, ihre Antwort aber verworfen — der Netzfehler kommt
 * NACH dem Schreiben. Genau die Lage „die Antwort des Servers geht unterwegs verloren". Verbraucht
 * sich beim ersten Aufruf.
 */
let naechsteAntwortVerloren = false;

/** Die nächste `drafts.create`-Antwort geht nach dem Schreiben verloren. */
export function lasseNaechsteAnlageAntwortVerlorenGehen(): void {
  naechsteAntwortVerloren = true;
}

/** Eine Antwort ohne Neuanlage — derselbe Entwurf, mit der Auskunft der Route (`anlage`). */
function ohneNeuanlage(id: string, anlage: "bestehend" | "fortgeschrieben"): unknown {
  return { ...(JSON.parse(JSON.stringify(server.bestand[id])) as object), anlage };
}

type Weiter = [expectedOwner?: string, opts?: { fortschreiben?: boolean }];

export const draftsCreate = vi.fn(async (payload: unknown, operationId?: string, ...w: Weiter) => {
  const opts = w[1];
  await anlageBremse.passiere();
  if (createFehlerTitel.has(titelAus(payload))) {
    throw new Error(`Anlage abgelehnt: ${titelAus(payload)}`);
  }
  const abdruck = JSON.stringify(payload);
  const bekannt = operationId ? vorgaenge.get(operationId) : undefined;
  if (operationId && bekannt) {
    if (bekannt.abdruck === abdruck) {
      return ohneNeuanlage(bekannt.id, "bestehend");
    }
    if (!opts?.fortschreiben) {
      throw Object.assign(new Error("IDEMPOTENCY_PAYLOAD_MISMATCH"), {
        status: 409,
        code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
      });
    }
    server.bestand[bekannt.id] = { ...(server.bestand[bekannt.id] as object), payload };
    vorgaenge.set(operationId, { id: bekannt.id, abdruck });
    return ohneNeuanlage(bekannt.id, "fortgeschrieben");
  }
  neuZaehler += 1;
  const id = `neu-${neuZaehler}`;
  const angelegt = { id, updatedAt: "2026-09-10T12:00:00.000Z", payload };
  server.bestand[id] = angelegt;
  if (operationId) {
    vorgaenge.set(operationId, { id, abdruck });
  }
  if (naechsteAntwortVerloren) {
    naechsteAntwortVerloren = false;
    throw new TypeError("Failed to fetch");
  }
  // JOB 3770 RUNDE 4: der ANGELEGTE ENTWURF geht zurück, nicht bloss seine Kennung. Der echte
  // Endpunkt antwortet mit `Draft` (`api.post<Draft>("/drafts")`), und Aufrufer lesen daraus weiter
  // — der Ganzdokument-Weg etwa bildet seine Quittung mit `draftTitle(draft, …)`, das `draft.payload`
  // liest. Mit `{ id }` allein warf genau dieser Weg einen TypeError, und zwar NACH der erfolgreichen
  // Anlage: die Attrappe hätte damit einen Fehler erfunden, den der Server nie geschickt hätte.
  return JSON.parse(JSON.stringify(angelegt)) as unknown;
});

/**
 * Wie oft je Titel eine Anlage VERSUCHT wurde — gezählt an den Aufrufen selbst, nicht an einem
 * zweiten Buch daneben. Gescheiterte Versuche zählen mit; was davon im Bestand gelandet ist, sagt
 * `bestandJeTitel()`.
 */
export function anlageversucheJeTitel(): Record<string, number> {
  const zaehler: Record<string, number> = {};
  for (const [payload] of draftsCreate.mock.calls) {
    const titel = titelAus(payload);
    zaehler[titel] = (zaehler[titel] ?? 0) + 1;
  }
  return zaehler;
}

/**
 * Die Nutzlasten der Anlageversuche in der Reihenfolge der Aufrufe — ohne Titel ALLE, mit Titel nur
 * die unter ihm versuchten. Gelesen wird damit, was wirklich zum Server ginge, nicht was danach im
 * Bestand übrig ist.
 *
 * JOB 3770 RUNDE 4: stand als eigene Abschrift in `dateiweg-eintragsentwurf-mounted.test.tsx` (dort
 * nur mit Titel) und wird jetzt von zwei Dateien gebraucht — also hierher, einmal (Lehre 3550/3571).
 */
export function anlageNutzlasten(titel?: string): Record<string, unknown>[] {
  const alle = draftsCreate.mock.calls.map(([payload]) => payload as Record<string, unknown>);
  return titel === undefined ? alle : alle.filter((p) => titelAus(p) === titel);
}

/**
 * JOB 3770 RUNDE 4: DIE NUTZLAST, DIE WIRKLICH IM BESTAND LIEGT — nicht bloss ihr Titel.
 *
 * Der Grund für diesen Messer (bens Befund Runde 3): ein Träger, der nur unter dem Rückfalltitel
 * ZÄHLBAR ist, beweist nichts über „nichts geht still verloren". Gemessen wurde damals eine Anlage,
 * deren Nutzlast `{"title":"Entwurf","statement":"", …}` war — der geladene Dateistand stand nirgends
 * darin. Eine Sicherung ist sie erst, wenn der Inhalt oder eine verwendbare Originalreferenz in ihr
 * steht, und genau das liest dieser Helfer heraus.
 */
export function nutzlastJeTitel(titel: string): Record<string, unknown> | null {
  for (const eintrag of Object.values(server.bestand)) {
    const payload = (eintrag as { payload?: unknown } | null)?.payload;
    if (titelAus(payload) === titel) {
      return payload as Record<string, unknown>;
    }
  }
  return null;
}

/** Die Kennung, unter der ein Entwurf im Bestand liegt — sie ist der Weg ins „Fortsetzen". */
export function kennungJeTitel(titel: string): string | null {
  for (const [id, eintrag] of Object.entries(server.bestand)) {
    if (titelAus((eintrag as { payload?: unknown } | null)?.payload) === titel) {
      return id;
    }
  }
  return null;
}

let objektZaehler = 0;

/**
 * JOB 3822: der nächste Objekt-Upload scheitert EINMAL — der Fall „das Original kommt nicht in den
 * Speicher, der Text aber schon" (`Capture.tsx:1499`). Form und Grund sind die von
 * `lasseNaechstesUpdateScheitern` oben: ein Schalter, der sich beim ersten Aufruf VERBRAUCHT, keine
 * stehende Umschaltung. Sonst scheiterte im Wiederholungsfall auch der zweite Anlauf, und „der
 * Volltext ist trotzdem gesichert" liesse sich nicht vom Dauerausfall unterscheiden.
 *
 * WARUM DER FEHLER VON AUSSEN KOMMT und nicht hier festgelegt ist: `classifyUploadError`
 * (`captureAttachments.ts:71`) trennt „zu groß" (Status 413 oder Größenwortlaut) von „Upload" —
 * daran hängen ZWEI verschiedene Sätze an den Menschen (`Capture.tsx:1558-1565`). Der Fall wählt
 * also, welchen der beiden Wege er messen will.
 */
let naechsterUploadFehler: unknown = null;

/** Der nächste `objects.upload` wirft diesen Fehler, danach lädt er wieder normal hoch. */
export function lasseNaechstenUploadScheitern(fehler: unknown): void {
  naechsterUploadFehler = fehler;
}

/**
 * Der Objekt-Upload des Originals (`endpoints.objects.upload`). Er legt wirklich ab und gibt eine
 * eigene Kennung je Aufruf zurück — nur so fällt ein doppelter Upload auf, und nur so trägt der
 * Rumpf des Entwurfs danach eine Referenz, die auf etwas VORHANDENES zeigt.
 */
export const objectsUpload = vi.fn(
  async (input: { name: string; mime: string; data: string }): Promise<Record<string, unknown>> => {
    await uploadBremse.passiere();
    if (naechsterUploadFehler !== null) {
      const fehler = naechsterUploadFehler;
      naechsterUploadFehler = null;
      throw fehler;
    }
    objektZaehler += 1;
    const ref = {
      id: `obj-${objektZaehler}`,
      name: input.name,
      mime: input.mime,
      size: input.data.length,
      kind: "document",
      createdAt: "2026-09-10T12:00:00.000Z",
    };
    server.objekte[ref.id] = { ref, data: input.data };
    return ref;
  },
);

/** Wie oft je Titel ein Entwurf WIRKLICH im Bestand steht — das, was „Meine Entwürfe" zeigt. */
export function bestandJeTitel(): Record<string, number> {
  const zaehler: Record<string, number> = {};
  for (const eintrag of Object.values(server.bestand)) {
    const titel = titelAus((eintrag as { payload?: unknown } | null)?.payload);
    zaehler[titel] = (zaehler[titel] ?? 0) + 1;
  }
  return zaehler;
}

export const draftsUpdate = vi.fn(async (id: string, payload: unknown) => {
  await bremse.passiere();
  if (naechsterUpdateFehler !== null) {
    const fehler = naechsterUpdateFehler;
    naechsterUpdateFehler = null;
    throw fehler;
  }
  server.bestand[id] = { id, updatedAt: "2026-09-10T12:00:00.000Z", payload };
  return { id };
});

export const draftsRemove = vi.fn(async (id: string) => {
  await bremse.passiere();
  delete server.bestand[id];
  return {};
});

export const draftsPromote = vi.fn(async (id: string) => {
  await bremse.passiere();
  delete server.bestand[id];
  return { id: "ko-1", title: "egal" };
});

/** Setzt Riegel und Einmalfehler zurück — nichts aus einem Fall reicht in den nächsten hinein. */
export async function attrappenZuruecksetzen(): Promise<void> {
  await bremse.loslassen();
  await anlageBremse.loslassen();
  await uploadBremse.loslassen();
  naechsterUpdateFehler = null;
  // JOB 3822: der Upload-Einmalfehler gehört HIERHER. Ein Fall, der ihn setzt und dessen Upload dann
  // gar nicht mehr stattfindet (Größenabbruch VOR dem Upload), liesse ihn sonst stehen — und der
  // nächste Fall des Ordners verlöre sein Original ohne jeden Bezug zu seiner eigenen Lage.
  naechsterUploadFehler = null;
  naechsteAntwortVerloren = false;
  vorgaenge.clear();
  createFehlerTitel.clear();
  extrakt.punkte = [];
  neuZaehler = 0;
  objektZaehler = 0;
  server.objekte = {};
}

/** Das Modul `api/auth`, wie die Testdateien es in ihrer `vi.mock`-Fabrik zurückgeben. */
export function authAttrappe(): Record<string, unknown> {
  return {
    authApi: {
      status: vi.fn(async () => ({ needsSetup: false, oidcEnabled: false })),
      me: vi.fn(async () => ({ id: "u1", name: "Pia", email: "p@x.de", role: "editor" })),
      logout: vi.fn(async () => ({})),
    },
  };
}

/** Das Modul `api/endpoints`, wie die Testdateien es in ihrer `vi.mock`-Fabrik zurückgeben. */
export function endpointsAttrappe(): Record<string, unknown> {
  const ok = <T>(v: T) => vi.fn(async () => v);
  const arrFn = () => vi.fn(async () => []);
  const base: Record<string, unknown> = {
    validation: { settings: ok({ defaultNeededValidations: 3 }) },
    external: { policy: vi.fn(async () => ({ stage: "off" })), search: vi.fn(async () => []) },
    uploadLimits: { get: ok({ maxAttachments: 10, maxAttachmentBytes: 20_000_000 }) },
    directory: { list: arrFn() },
    gaps: { list: arrFn() },
    drafts: {
      list: draftsList,
      get: draftsGet,
      create: draftsCreate,
      update: draftsUpdate,
      remove: draftsRemove,
      promote: draftsPromote,
    },
    // JOB 3770 RUNDE 4: der Objektspeicher gehört ausdrücklich in die Attrappe und nicht in den
    // Platzhalter-Proxy darunter — der Ganzdokument-Weg lädt das Original hier hoch und verlinkt
    // dessen Kennung im Rumpf des Entwurfs (`fileLinkHtml`). Aus dem Proxy käme eine leere Liste,
    // die Kennung wäre `undefined`, und `fileLinkHtml` liesse den Link STILL weg.
    objects: { upload: objectsUpload },
    reasoner: {
      status: ok({ active: true, mode: "cloud", reachable: "active" }),
      config: ok(null),
      structure: vi.fn(async () => ({})),
      // JOB 3600: der Dateiweg braucht die KI-Auswertung — sie liefert genau die Punkte, die der
      // Fall in `extrakt.punkte` gelegt hat. Ohne sie gäbe es in diesem Ordner keine `filePoints`.
      extract: vi.fn(async () => ({ points: extrakt.punkte, note: null, demo: false })),
      interview: vi.fn(async () => ({ question: "", done: true, demo: false })),
      assist: vi.fn(async () => ({ text: "" })),
      describeImage: vi.fn(async () => ({ text: "", demo: false })),
    },
    notifications: { list: arrFn(), markSeen: vi.fn(async () => ({})) },
  };
  const endpoints = new Proxy(base, {
    get(target, prop) {
      if (prop in target) {
        return target[prop as string];
      }
      return new Proxy({}, { get: () => arrFn() });
    },
  });
  return { endpoints };
}
