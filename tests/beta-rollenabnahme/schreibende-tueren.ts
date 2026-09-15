// ================================================================================================
// JOB 4113 · LIEFERUNG 3 — DIE SCHREIBENDEN TÜREN, MIT ECHTEM FACHVORGANG.
// ================================================================================================
//
// WARUM DIESE DATEI NEBEN `tabelle.ts` STEHT UND NICHT DARIN.
//
// Eine Zeile in `tabelle.ts` ist ein DATENSATZ: Methode, fertige URL, feste Nutzlast, fünf
// Erwartungen. Sie kann das sein, weil sie LIEST — der Bestand, gegen den sie misst, ist vor ihr da
// und nach ihr derselbe. Eine schreibende Zeile kann das nicht: `PUT /api/kos/:id` braucht ein
// Wissensobjekt, das es erst geben muss; `POST /api/drafts/:id/restore` braucht einen Entwurf, der
// zuvor angelegt UND gelöscht wurde; `POST /api/ask/helpful` braucht einen Beleg, den GENAU DER
// Akteur bekommen hat, der gleich klopft. Der Fachvorgang ist Teil der Zeile, nicht ihre Kulisse.
//
// Deshalb trägt jede Zeile hier ein `ruesten` — eine Funktion, die auf einer FRISCHEN Bühne
// (`baueFrischeBuehne()`, `buehne.ts`) den Vorgang herstellt und die URL samt Nutzlast zurückgibt.
// Sie läuft JE MESSUNG einmal, an einer eigenen Bühne, und was sie hinterlässt, sieht keine zweite
// Messung. Ohne diese Trennung wäre jede Zeile hier vom Ausgang ihrer Vorgängerin abhängig.
//
// ================================================================================================
// WAS „ERLAUBT" HIER STRENGER BEDEUTET ALS IN `tabelle.ts`.
// ================================================================================================
//
// `tabelle.ts:24-28` sagt für die Lesezeilen: „sie misst die Tür, nicht den Raum dahinter. Deshalb
// sind die Nutzlasten unten bewusst dünn". Das bleibt dort wörtlich so — keine einzige dieser
// Nutzlasten wird von diesem Auftrag angefasst.
//
// FÜR DIE ZEILEN DIESER DATEI GILT DER SCHÄRFERE MASSSTAB: eine Nutzlast ist erst dann echt, wenn
// der BERECHTIGTE Akteur an ihr nicht scheitert. Ein `400` beim berechtigten Akteur ist hier KEIN
// `erlaubt`, sondern ein Fehlschlag der Nutzlast, und `schreibende-tueren-am-draht.test.ts` macht
// ihn eigens rot (nicht `gemessen()` — die eine Übersetzungsstelle von Status zu Abnahmeergebnis
// bleibt unverändert, wo sie ist). Der Grund ist der Nutzerweg: eine Schreib-Tür, die zu weit
// offensteht, lässt einen Gast den BESTAND ändern. Wer nur misst, ob das Tor bei leerem Rumpf
// durchlässt, hat über den Vorgang dahinter nichts gesagt.
//
// ================================================================================================
// WAS HIER NICHT STEHT.
// ================================================================================================
//
// Kein Produktdiff, keine Reparatur. Findet eine Zeile eine Abweichung, geht sie als `ist` mit
// ausgeschriebenem Grund in die Zeile (`tabelle.ts:48-52`) und als BEFUND in die Rückgabe — nie ins
// `soll`. Und: was hier nicht steht, steht mit eigenem Grund und `art: "zurueckgestellt"` in
// `NICHT_ABGENOMMEN`; eine stille Auslassung gibt es nicht (E2 verbietet sie).
import type { FastifyInstance } from "fastify";
import { AKTEURE, type Akteur, type Buehne, PASSWORT, type Rolle } from "./buehne";
import {
  AB_CONTROLLER,
  AB_EXPERTE,
  ANGEMELDET,
  type Erwartungen,
  NUR_ADMIN,
  NUR_LESEN,
  OEFFENTLICH,
} from "./tabelle";

/** Der Fehlerschlüssel, den das EIGENE Tor des auth-Moduls sendet (`services/auth/src/routes.ts:319-322`). */
const AUTH_401 = "INVALID_CREDENTIALS";

/**
 * Was `ruesten` zurückgibt: der hergestellte Vorgang.
 *
 * `bestand` ist der Lesegriff auf die Grösse, die ein GELUNGENER Aufruf verändern würde. Er ist
 * optional, weil ihn nicht jede Tür sinnvoll hat — und er ist der ganze Inhalt von Lieferung 4:
 * ein `403`, nach dem der Vorgang trotzdem stattgefunden hätte, wäre die gefährlichste Grünfärbung
 * dieser Abnahme.
 */
export interface Vorgang {
  /** Die URL, die wirklich gefahren wird — mit den Kennungen aus dem hergestellten Vorgang. */
  pfad: string;
  payload?: Record<string, unknown>;
  bestand?: () => Promise<unknown>;
}

export interface Schreibzeile {
  /** Der Registrar aus `build-app.ts`, wie in `tabelle.ts`. */
  gruppe: string;
  methode: "POST" | "PUT" | "DELETE";
  /** Das Muster, unter dem die Tür REGISTRIERT ist — die Auskunft, gegen die der Router gehalten wird. */
  route: string;
  /** Wo die Route steht: Datei und Zeile. */
  belegstelle: string;
  /** Das Recht, das die Route fordert — oder wie sie sonst schützt. */
  tor: string;
  erwartet: Erwartungen;
  /**
   * RUNDE 2 · KORREKTURPFLICHT 2 — DIE STATUS, DIE EIN GELUNGENER FACHVORGANG AN DIESER TÜR HAT.
   *
   * DER BEFUND DES PRÜFERS, wörtlich nachgestellt: er hat in `POST /api/kos/:id/restore` eine
   * ERFUNDENE Zielkennung eingesetzt (`/api/kos/ben-nicht-vorhanden/restore`). Der Admin bekam
   * darauf **404**, und die Zeile blieb GRÜN — denn Runde 1 hat beim Berechtigten nur den einen
   * Fall `400` verschärft, und `gemessen()` bildet jeden anderen Status auf `erlaubt` ab. Damit
   * hätte die Zeile behaupten können, einen Fachvorgang gefahren zu haben, während sie in
   * Wahrheit die Existenzprüfung gemessen hat — genau das, was Lieferung 3 ausschliessen soll.
   *
   * SEITHER SAGT JEDE ZEILE POSITIV, WIE IHR GELINGEN AUSSIEHT. Wer `erlaubt` erwartet, muss einen
   * dieser Status bekommen; alles andere (404 auf eine erfundene Kennung, 409 auf einen nicht
   * wiederholbaren Vorgang, 503 ohne Adapter, 400 auf einen halben Rumpf) ist ein Fehlschlag der
   * Nutzlast und wird namentlich rot. Eine Aufzählung statt einer Spanne, weil „2xx genügt" genau
   * die Unschärfe wäre, die den 404 von damals wieder durchliesse — 404 ist kein 2xx, ein 409 aber
   * auch nicht, und beide sollen fallen.
   */
  erfolg: number[];
  /** Abweichender Fehlerschlüssel im Feld `error`, wie in `tabelle.ts`. */
  codes?: Partial<Record<"401" | "403", string>>;
  /** Stellt den Fachvorgang auf der frischen Bühne her. Wirft, wenn die Vorbereitung scheitert. */
  ruesten(buehne: Buehne, akteur: Akteur): Promise<Vorgang>;
}

// ------------------------------------------------------------------------------------------------
// RUNDE 2 · KORREKTURPFLICHT 1 — EINE AUSGELASSENE MESSUNG IST KEINE MESSUNG.
// ------------------------------------------------------------------------------------------------
//
// DER BEFUND DES PRÜFERS: er hat in einer Schreibzeile `viewer: nicht-geprueft` gesetzt. Der
// Drahttest übersprang den Akteur (er tut das für die LESEnden Zeilen zu Recht — dort steht ein
// ausgeschriebener Grund daneben), und die Abdeckungszahl zählte die Tür trotzdem als „mit fünf
// Akteuren gemessen". 52 Fälle grün, `SCHREIBENDE Türen: 36 von 94` unverändert — die Zusage war
// nicht abgesichert, sondern nur aufgeschrieben.
//
// DIESE FUNKTION IST DIE EINE STELLE, DIE DAS URTEIL FÄLLT, und sie ist absichtlich eine reine
// Funktion ohne Bühne: so lässt sie sich mit einer erfundenen Zeile GEGENPROBEN, ohne 125 Instanzen
// zu bauen (`S5` in `schreibende-tueren-am-draht.test.ts`). Der Drahttest benutzt sie, um rot zu
// werden, und der Abdeckungswächter, um gar nicht erst zu zählen — zwei Folgen, ein Urteil.
//
// WARUM ES FÜR SCHREIBZEILEN KEIN `nicht-geprueft` GIBT: eine Lesezeile darf eine Tür auslassen und
// den Grund danebenschreiben, weil sie nichts verändert. Eine Schreib-Tür, an der ein Akteur NICHT
// gefahren wird, ist genau die Tür, an der niemand weiss, ob er den Bestand ändern könnte. Wer eine
// solche Tür nicht messen kann, lässt sie ganz aus der Tabelle und führt sie mit Grund in
// `NICHT_ABGENOMMEN` — dort zählt E9 sie als Prüfschuld.

/** Die Akteure, für die diese Zeile KEINE Messung fährt. Leer heisst: alle fünf werden gefahren. */
export function ausgelasseneAkteure(zeile: Pick<Schreibzeile, "erwartet">): Akteur[] {
  return AKTEURE.filter((akteur) => {
    const wert = zeile.erwartet[akteur];
    if (wert === undefined) {
      return true;
    }
    return (typeof wert === "string" ? wert : wert.soll) === "nicht-geprueft";
  });
}

/** Wird diese Zeile wirklich mit allen fünf Akteuren gefahren? Nur dann zählt ihre Tür. */
export function vollstaendigGemessen(zeile: Pick<Schreibzeile, "erwartet">): boolean {
  return ausgelasseneAkteure(zeile).length === 0;
}

// ------------------------------------------------------------------------------------------------
// HANDGRIFFE DER VORBEREITUNG — jeder fährt am echten Draht, keiner am Dienst vorbei.
// ------------------------------------------------------------------------------------------------

/** Der Inhalt, aus dem ein gültiges Wissensobjekt entsteht (Pflichtfelder samt Einstufung). */
const KO_INHALT = {
  title: "Dichtungswechsel L4",
  statement: "Dichtung vor jedem Anlauf prüfen.",
  type: "best_practice",
  category: "Instandhaltung",
  bodyHtml: "<p>Dichtung nach 500 h tauschen.</p>",
  confidentiality: "intern",
} as const;

/**
 * Die Frage, die zu `KO_INHALT` passt — sie muss das Objekt wirklich als Quelle liefern, sonst gibt
 * es keinen Beleg für `POST /api/ask/helpful`.
 */
const PASSENDE_FRAGE = "Dichtung vor dem Anlauf prüfen";

/** Eine Frage, zu der es im leeren Bestand keine Antwort gibt — daraus entsteht die Wissenslücke. */
const OFFENE_FRAGE = "Wie ist der Spaltmassbericht der Anlage 17 zu lesen?";

function kopf(buehne: Buehne, rolle: Rolle): Record<string, string> {
  return { authorization: `Bearer ${buehne.sitzung[rolle]}` };
}

interface Antwort {
  statusCode: number;
  body: string;
  json(): unknown;
}

async function fahre(
  app: FastifyInstance,
  kopfzeilen: Record<string, string>,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
): Promise<Antwort> {
  return app.inject({
    method: methode,
    url,
    headers: kopfzeilen,
    ...(payload ? { payload } : {}),
  });
}

/**
 * Derselbe Aufruf, aber mit Erfolgspflicht: scheitert eine VORBEREITUNG, ist das kein Messwert,
 * sondern ein kaputter Aufbau. Er wird geworfen und benannt — eine Zeile, die auf einem misslungenen
 * Vorgang misst, wäre grün oder rot aus dem falschen Grund.
 */
async function musterhaft(
  app: FastifyInstance,
  kopfzeilen: Record<string, string>,
  methode: "GET" | "POST" | "PUT" | "DELETE",
  url: string,
  payload?: Record<string, unknown>,
): Promise<Antwort> {
  const antwort = await fahre(app, kopfzeilen, methode, url, payload);
  if (antwort.statusCode >= 400) {
    throw new Error(
      `Vorbereitung fehlgeschlagen: ${methode} ${url} → ${antwort.statusCode} ${antwort.body.slice(0, 300)}`,
    );
  }
  return antwort;
}

/**
 * WER DEN VORGANG VORBEREITET, wenn der gemessene Akteur ihn selbst nicht herstellen kann.
 *
 * Das ist kein Kniff, sondern die Bedingung dafür, dass die Sperre überhaupt etwas beweist: ein
 * Entwurf, den es gar nicht gibt, antwortet auch dem Gast mit 404 — und ein 404 belegt keine
 * Sperre, sondern eine leere Bühne. Gemessen wird immer der Akteur; hergestellt wird der Vorgang
 * von dem, der ihn im Betrieb herstellt.
 */
function schreiberFuer(akteur: Akteur): Rolle {
  return akteur === "anonym" || akteur === "viewer" ? "experte" : akteur;
}

async function legeKoAn(buehne: Buehne, rolle: Rolle = "admin"): Promise<{ id: string }> {
  const antwort = await musterhaft(buehne.app, kopf(buehne, rolle), "POST", "/api/kos", {
    ...KO_INHALT,
  });
  return antwort.json() as { id: string };
}

async function zaehleKos(buehne: Buehne): Promise<number> {
  const antwort = await musterhaft(buehne.app, kopf(buehne, "admin"), "GET", "/api/kos");
  return (antwort.json() as unknown[]).length;
}

async function legeEntwurfAn(buehne: Buehne, rolle: Rolle): Promise<{ id: string }> {
  const antwort = await musterhaft(buehne.app, kopf(buehne, rolle), "POST", "/api/drafts", {
    ...KO_INHALT,
  });
  return antwort.json() as { id: string };
}

async function zaehleEntwuerfe(buehne: Buehne, rolle: Rolle): Promise<number> {
  const antwort = await musterhaft(buehne.app, kopf(buehne, rolle), "GET", "/api/drafts");
  return (antwort.json() as unknown[]).length;
}

/** Stellt eine echte Wissenslücke her: eine Frage, auf die der leere Bestand keine Antwort hat. */
async function legeLueckeAn(buehne: Buehne): Promise<{ id: string }> {
  await musterhaft(buehne.app, kopf(buehne, "admin"), "POST", "/api/ask", {
    question: OFFENE_FRAGE,
  });
  const liste = await musterhaft(buehne.app, kopf(buehne, "admin"), "GET", "/api/gaps");
  const luecken = liste.json() as { id: string }[];
  if (luecken.length === 0) {
    throw new Error(
      "Vorbereitung fehlgeschlagen: POST /api/ask hat keine Wissenslücke erzeugt (GET /api/gaps ist leer) — ohne echte Lücke misst die Zeile die Existenzprüfung statt des Tors.",
    );
  }
  const erste = luecken[0];
  if (!erste) {
    throw new Error("Vorbereitung fehlgeschlagen: Wissenslücke ohne Kennung.");
  }
  return erste;
}

/** Ein Eintrag, wie ihn der Bibliotheks-Import erwartet. */
const IMPORT_EINTRAG = {
  title: "Spaltmass Anlage 17",
  statement: "Spaltmass vor der Freigabe messen.",
  type: "best_practice",
  category: "Instandhaltung",
  confidentiality: "intern",
} as const;

// ------------------------------------------------------------------------------------------------
// DIE TABELLE DER SCHREIBENDEN TÜREN. Reihenfolge nach Nutzerweg: zuerst, was den BESTAND ändert.
// ------------------------------------------------------------------------------------------------

export const SCHREIB_TABELLE: Schreibzeile[] = [
  // --- Wissensobjekte ---------------------------------------------------------------------------
  {
    gruppe: "koRoutes",
    methode: "POST",
    route: "/api/kos",
    belegstelle: "services/app/src/routes/ko-routes.ts:1099",
    erfolg: [201],
    tor: "ko.create",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne) => ({
      pfad: "/api/kos",
      payload: { ...KO_INHALT },
      bestand: () => zaehleKos(buehne),
    }),
  },
  {
    gruppe: "koRoutes",
    methode: "PUT",
    route: "/api/kos/:id",
    belegstelle: "services/app/src/routes/ko-routes.ts:1908",
    erfolg: [200],
    // DIE GRENZE DIESER ZEILE, ausgeschrieben statt verschwiegen: `PUT /api/kos/:id` verzweigt je
    // Aktion im Rumpf in ein EIGENES Tor (`rate` → ko.validate, `assign` → ko.assign,
    // `admin-validate` → users.manage, `revise` → ko.create). Diese Zeile misst GENAU `revise`.
    // Dass die übrigen Aktionen andere Tore haben, ist kein Nebensatz, sondern wird in
    // `schreibende-tueren-am-draht.test.ts` (S2) eigens gemessen — sonst behauptete die eine Zeile,
    // die ganze Tür beurteilt zu haben.
    tor: "requireUser + Sichtbarkeit, dann ko.create (Aktion `revise`)",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne) => {
      const ko = await legeKoAn(buehne, "admin");
      return {
        pfad: `/api/kos/${ko.id}`,
        payload: { action: "revise", changes: { ...KO_INHALT, statement: "Neue Fassung." } },
        bestand: async () => {
          const stand = await musterhaft(
            buehne.app,
            kopf(buehne, "admin"),
            "GET",
            `/api/kos/${ko.id}`,
          );
          return (stand.json() as { statement?: string }).statement;
        },
      };
    },
  },
  {
    gruppe: "koRoutes",
    methode: "DELETE",
    route: "/api/kos/:id",
    belegstelle: "services/app/src/routes/ko-routes.ts:1850",
    erfolg: [204],
    tor: "ko.read, dann ko.validate ODER Autorschaft (`ko-routes.ts:1863`)",
    erwartet: AB_CONTROLLER,
    ruesten: async (buehne) => {
      const ko = await legeKoAn(buehne, "admin");
      return {
        pfad: `/api/kos/${ko.id}`,
        bestand: () => zaehleKos(buehne),
      };
    },
  },
  {
    gruppe: "koRoutes",
    methode: "POST",
    route: "/api/kos/:id/restore",
    belegstelle: "services/app/src/routes/ko-routes.ts:1818",
    // 200 und NICHT „irgendein 2xx": genau hier hat der Prüfer mit einer erfundenen Kennung einen
    // 404 erzeugt, den Runde 1 als `erlaubt` durchgehen liess (S6 hält den Fall dauerhaft fest).
    erfolg: [200],
    tor: "users.manage",
    erwartet: NUR_ADMIN,
    ruesten: async (buehne) => {
      const ko = await legeKoAn(buehne, "admin");
      await musterhaft(buehne.app, kopf(buehne, "admin"), "DELETE", `/api/kos/${ko.id}`);
      return {
        pfad: `/api/kos/${ko.id}/restore`,
        bestand: () => zaehleKos(buehne),
      };
    },
  },
  {
    gruppe: "koRoutes",
    methode: "DELETE",
    route: "/api/kos/trash/:id",
    belegstelle: "services/app/src/routes/ko-routes.ts:1830",
    erfolg: [204],
    tor: "users.manage",
    erwartet: NUR_ADMIN,
    ruesten: async (buehne) => {
      const ko = await legeKoAn(buehne, "admin");
      await musterhaft(buehne.app, kopf(buehne, "admin"), "DELETE", `/api/kos/${ko.id}`);
      return {
        pfad: `/api/kos/trash/${ko.id}`,
        bestand: async () => {
          const papierkorb = await musterhaft(
            buehne.app,
            kopf(buehne, "admin"),
            "GET",
            "/api/kos/trash",
          );
          return (papierkorb.json() as unknown[]).length;
        },
      };
    },
  },
  {
    gruppe: "koRoutes",
    methode: "POST",
    route: "/api/kos/:id/ai-check",
    belegstelle: "services/app/src/routes/ko-routes.ts:1725",
    // NUR 200 — und das ist an dieser Tür die schärfste der drei möglichen Antworten: 409
    // („kein wiederholbarer Prüf-Job") und 503 („Hintergrund-Prüfung nicht verdrahtet") kämen
    // beide durchs Tor, ohne dass ein Vorgang stattgefunden hätte. Dass hier wirklich ein
    // ANGENOMMENER Retry gemessen wird, hängt daran, dass die Prüfbühne den Job ohne Modell auf
    // `failed` setzt (`ko-routes.ts:1744-1750`); fällt das weg, wird diese Zeile rot.
    erfolg: [200],
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
    ruesten: async (buehne) => {
      const ko = await legeKoAn(buehne, "admin");
      return { pfad: `/api/kos/${ko.id}/ai-check` };
    },
  },
  {
    gruppe: "koRoutes",
    methode: "PUT",
    route: "/api/upload-limits",
    belegstelle: "services/app/src/routes/ko-routes.ts:1776",
    erfolg: [200],
    tor: "users.manage",
    erwartet: NUR_ADMIN,
    ruesten: async (buehne) => ({
      pfad: "/api/upload-limits",
      payload: { maxAttachments: 7, maxAttachmentBytes: 2_000_000 },
      bestand: async () => {
        const stand = await musterhaft(
          buehne.app,
          kopf(buehne, "admin"),
          "GET",
          "/api/upload-limits",
        );
        return stand.body;
      },
    }),
  },

  // --- Entwürfe ---------------------------------------------------------------------------------
  {
    gruppe: "captureRoutes",
    methode: "POST",
    route: "/api/drafts",
    belegstelle: "services/app/src/routes/capture-routes.ts:891",
    // NUR 201. Die Route antwortet 200, wenn derselbe Vorgangsschlüssel ein zweites Mal kommt
    // (`capture-routes.ts:949`) — an einer frischen Bühne darf das nie passieren, und wenn doch,
    // hat die Zeile nicht angelegt, sondern eine Wiederholung gemessen.
    erfolg: [201],
    tor: "ko.create (Auth-Riegel im `onRequest`, also VOR dem Rumpfparsen)",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => ({
      pfad: "/api/drafts",
      payload: { ...KO_INHALT },
      bestand: () => zaehleEntwuerfe(buehne, schreiberFuer(akteur)),
    }),
  },
  {
    gruppe: "captureRoutes",
    methode: "PUT",
    route: "/api/drafts/:id",
    belegstelle: "services/app/src/routes/capture-routes.ts:1233",
    erfolg: [200],
    tor: "ko.create, dann Sichtbarkeit des Entwurfs",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => {
      const schreiber = schreiberFuer(akteur);
      const entwurf = await legeEntwurfAn(buehne, schreiber);
      return {
        pfad: `/api/drafts/${entwurf.id}`,
        payload: { ...KO_INHALT, statement: "Weitergeschrieben." },
      };
    },
  },
  {
    gruppe: "captureRoutes",
    methode: "DELETE",
    route: "/api/drafts/:id",
    belegstelle: "services/app/src/routes/capture-routes.ts:1367",
    erfolg: [204],
    tor: "ko.create, dann Sichtbarkeit des Entwurfs",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => {
      const schreiber = schreiberFuer(akteur);
      const entwurf = await legeEntwurfAn(buehne, schreiber);
      return {
        pfad: `/api/drafts/${entwurf.id}`,
        bestand: () => zaehleEntwuerfe(buehne, schreiber),
      };
    },
  },
  {
    gruppe: "captureRoutes",
    methode: "POST",
    route: "/api/drafts/:id/restore",
    belegstelle: "services/app/src/routes/capture-routes.ts:1329",
    erfolg: [200],
    tor: "ko.create, dann Sichtbarkeit im Entwurfs-Papierkorb",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => {
      const schreiber = schreiberFuer(akteur);
      const entwurf = await legeEntwurfAn(buehne, schreiber);
      await musterhaft(buehne.app, kopf(buehne, schreiber), "DELETE", `/api/drafts/${entwurf.id}`);
      return {
        pfad: `/api/drafts/${entwurf.id}/restore`,
        bestand: () => zaehleEntwuerfe(buehne, schreiber),
      };
    },
  },
  {
    gruppe: "captureRoutes",
    methode: "DELETE",
    route: "/api/drafts/trash/:id",
    belegstelle: "services/app/src/routes/capture-routes.ts:1348",
    erfolg: [204],
    tor: "ko.create, dann Sichtbarkeit im Entwurfs-Papierkorb",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => {
      const schreiber = schreiberFuer(akteur);
      const entwurf = await legeEntwurfAn(buehne, schreiber);
      await musterhaft(buehne.app, kopf(buehne, schreiber), "DELETE", `/api/drafts/${entwurf.id}`);
      return {
        pfad: `/api/drafts/trash/${entwurf.id}`,
        bestand: async () => {
          const papierkorb = await musterhaft(
            buehne.app,
            kopf(buehne, schreiber),
            "GET",
            "/api/drafts/trash",
          );
          return (papierkorb.json() as unknown[]).length;
        },
      };
    },
  },
  {
    gruppe: "captureRoutes",
    methode: "POST",
    route: "/api/drafts/:id/promote",
    belegstelle: "services/app/src/routes/capture-routes.ts:1452",
    erfolg: [201],
    tor: "ko.create, dann Sichtbarkeit des Entwurfs",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne, akteur) => {
      const schreiber = schreiberFuer(akteur);
      const entwurf = await legeEntwurfAn(buehne, schreiber);
      return {
        pfad: `/api/drafts/${entwurf.id}/promote`,
        payload: {},
        bestand: () => zaehleKos(buehne),
      };
    },
  },

  // --- Prüfen, Freigeben, Wissenslücken ---------------------------------------------------------
  {
    gruppe: "validationRoutes",
    methode: "PUT",
    route: "/api/validation/settings",
    belegstelle: "services/app/src/routes/validation-routes.ts:99",
    erfolg: [200],
    tor: "users.manage",
    erwartet: NUR_ADMIN,
    ruesten: async (buehne) => ({
      pfad: "/api/validation/settings",
      payload: { defaultNeededValidations: 3 },
      bestand: async () => {
        const stand = await musterhaft(
          buehne.app,
          kopf(buehne, "admin"),
          "GET",
          "/api/validation/settings",
        );
        return stand.body;
      },
    }),
  },
  {
    gruppe: "askRoutes",
    methode: "POST",
    route: "/api/ask/helpful",
    belegstelle: "services/app/src/routes/ask-routes.ts:453",
    // 204 und nichts sonst: ein unbelegter oder fremder Beleg ergibt hier 403 — und der käme über
    // `gemessen()` als Sperre durch, obwohl das TOR den Akteur längst durchgelassen hat.
    erfolg: [204],
    tor: "ko.read (danach prüft der Dienst den Beleg aus dem echten Antwortvorgang)",
    erwartet: NUR_LESEN,
    ruesten: async (buehne, akteur) => {
      await legeKoAn(buehne, "admin");
      if (akteur === "anonym") {
        // Ohne Sitzung gibt es keinen Beleg — und es braucht auch keinen: `requirePermission`
        // entscheidet vor jeder Belegprüfung. Die Nutzlast bleibt trotzdem formgerecht, damit die
        // Zeile nicht versehentlich eine Rumpfprüfung misst.
        return {
          pfad: "/api/ask/helpful",
          payload: { koId: "ohne-sitzung-gibt-es-keinen-beleg", receipt: "" },
        };
      }
      const gefragt = await musterhaft(buehne.app, kopf(buehne, akteur), "POST", "/api/ask", {
        question: PASSENDE_FRAGE,
      });
      // `sources` ist eine Liste von KENNUNGEN, nicht von Objekten (gemessen am Rumpf dieser
      // Antwort: `"sources":["8d9cdd16-…"]`). Ein `sources[0].id` wäre hier still `undefined`
      // gewesen — und die Zeile hätte auf einer erfundenen Kennung gemessen.
      const antwort = gefragt.json() as { receipt?: string; result?: { sources?: string[] } };
      const quelle = antwort.result?.sources?.[0];
      if (typeof antwort.receipt !== "string" || typeof quelle !== "string") {
        throw new Error(
          `Vorbereitung fehlgeschlagen: POST /api/ask lieferte keinen Beleg mit Quelle — ${gefragt.body.slice(0, 300)}`,
        );
      }
      return { pfad: "/api/ask/helpful", payload: { koId: quelle, receipt: antwort.receipt } };
    },
  },
  {
    gruppe: "askRoutes",
    methode: "PUT",
    route: "/api/gaps/:id",
    belegstelle: "services/app/src/routes/ask-routes.ts:496",
    erfolg: [200],
    tor: "ko.assign",
    erwartet: AB_CONTROLLER,
    ruesten: async (buehne) => {
      const luecke = await legeLueckeAn(buehne);
      return {
        pfad: `/api/gaps/${luecke.id}`,
        payload: { expertId: buehne.konto.experte.id },
        bestand: async () => {
          const liste = await musterhaft(buehne.app, kopf(buehne, "admin"), "GET", "/api/gaps");
          const treffer = (liste.json() as { id: string; expertId?: string }[]).find(
            (g) => g.id === luecke.id,
          );
          return treffer?.expertId ?? null;
        },
      };
    },
  },
  {
    gruppe: "askRoutes",
    methode: "DELETE",
    route: "/api/gaps/:id",
    belegstelle: "services/app/src/routes/ask-routes.ts:531",
    erfolg: [204],
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
    ruesten: async (buehne) => {
      const luecke = await legeLueckeAn(buehne);
      return {
        // Die ausdrückliche Bestätigung reist in der Abfrage mit — ohne sie weist der Dienst ab,
        // und die Zeile mässe seine Bestätigungsregel statt des Tors.
        pfad: `/api/gaps/${luecke.id}?confirm=true`,
        bestand: async () => {
          const liste = await musterhaft(buehne.app, kopf(buehne, "admin"), "GET", "/api/gaps");
          return (liste.json() as unknown[]).length;
        },
      };
    },
  },

  // --- Bibliothek -------------------------------------------------------------------------------
  {
    gruppe: "libraryRoutes",
    methode: "POST",
    route: "/api/library/import",
    belegstelle: "services/app/src/routes/library-routes.ts:731",
    erfolg: [200],
    tor: "ko.create",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne) => ({
      pfad: "/api/library/import",
      payload: { items: [{ ...IMPORT_EINTRAG }] },
      bestand: () => zaehleKos(buehne),
    }),
  },
  {
    gruppe: "libraryRoutes",
    methode: "POST",
    route: "/api/library/import/candidates",
    belegstelle: "services/app/src/routes/library-routes.ts:749",
    erfolg: [201],
    tor: "ko.create",
    erwartet: AB_EXPERTE,
    ruesten: async (buehne) => ({
      pfad: "/api/library/import/candidates",
      payload: { items: [{ ...IMPORT_EINTRAG }] },
      bestand: async () => {
        const liste = await musterhaft(
          buehne.app,
          kopf(buehne, "admin"),
          "GET",
          "/api/library/import/candidates",
        );
        return (liste.json() as unknown[]).length;
      },
    }),
  },
  {
    gruppe: "libraryRoutes",
    methode: "PUT",
    route: "/api/library/import/candidates/:id",
    belegstelle: "services/app/src/routes/library-routes.ts:821",
    erfolg: [200],
    tor: "ko.validate",
    erwartet: AB_CONTROLLER,
    ruesten: async (buehne) => {
      const angelegt = await musterhaft(
        buehne.app,
        kopf(buehne, "admin"),
        "POST",
        "/api/library/import/candidates",
        { items: [{ ...IMPORT_EINTRAG }] },
      );
      const kandidaten = angelegt.json() as { id: string }[];
      const erster = kandidaten[0];
      if (!erster) {
        throw new Error(
          `Vorbereitung fehlgeschlagen: POST /api/library/import/candidates lieferte keinen Kandidaten — ${angelegt.body.slice(0, 300)}`,
        );
      }
      return {
        // `info` und nicht `accept`: die Frage dieser Zeile ist das Tor, nicht die Wirkung des
        // Annehmens. `accept` legte zusätzlich ein Wissensobjekt an und zöge die Erkennungskette
        // hinter sich her — beides gehört nicht in eine Rollenmessung.
        pfad: `/api/library/import/candidates/${erster.id}`,
        payload: { action: "info", note: "Rückfrage aus der Rollenabnahme." },
      };
    },
  },

  // --- Konto und Sitzung: erst die frische Bühne macht diese Türen messbar -----------------------
  {
    gruppe: "authRoutes",
    methode: "POST",
    route: "/api/auth/logout",
    belegstelle: "services/auth/src/routes.ts:447",
    erfolg: [204],
    tor: "keines — die Abmeldung beendet, was da ist, und schweigt über den Rest",
    // DER BEFUND DIESER ZEILE, gemessen statt vermutet: `POST /api/auth/logout` hat KEIN Tor. Ohne
    // Token entfernt sie nur das Cookie und antwortet 204 — das ist richtig (eine Abmeldung soll
    // niemandem sagen, ob er angemeldet WAR) und für eine Rollenabnahme genau die Art Aussage, die
    // benannt gehört, statt unter „grün" zu verschwinden.
    erwartet: OEFFENTLICH(
      "Die Abmeldung ist absichtlich ohne Rechtetor: `routes.ts:448-453` liest den Token, meldet ihn ab, WENN es einen gibt, und löscht in jedem Fall das Sitzungscookie. Ein 401 für den Unangemeldeten wäre eine Auskunft über den Sitzungsstand, die niemand braucht. Dass die Abmeldung des ANGEMELDETEN wirklich wirkt, wird nicht behauptet, sondern in `schreibende-tueren-am-draht.test.ts` (S3) nachgelesen: danach ist `GET /api/auth/me` mit demselben Token 401.",
    ),
    ruesten: async (buehne, akteur) => ({
      pfad: "/api/auth/logout",
      bestand: async () => {
        if (akteur === "anonym") {
          return "ohne Sitzung";
        }
        const nachher = await fahre(buehne.app, kopf(buehne, akteur), "GET", "/api/auth/me");
        return nachher.statusCode;
      },
    }),
  },
  {
    gruppe: "authRoutes",
    methode: "POST",
    route: "/api/auth/password",
    belegstelle: "services/auth/src/routes.ts:600",
    erfolg: [204],
    tor: "requireUser (eigener Guard des auth-Moduls, `routes.ts:312-327`)",
    erwartet: ANGEMELDET,
    codes: { "401": AUTH_401 },
    ruesten: async () => ({
      pfad: "/api/auth/password",
      payload: { oldPassword: PASSWORT, newPassword: "Rollenabnahme-2026-neu!" },
    }),
  },
  {
    gruppe: "authRoutes",
    methode: "POST",
    route: "/api/auth/notice",
    belegstelle: "services/auth/src/routes.ts:582",
    erfolg: [200],
    tor: "requireUser (eigener Guard des auth-Moduls)",
    erwartet: ANGEMELDET,
    codes: { "401": AUTH_401 },
    ruesten: async (buehne, akteur) => ({
      pfad: "/api/auth/notice",
      payload: {},
      bestand: async () => {
        if (akteur === "anonym") {
          return "ohne Sitzung";
        }
        const stand = await fahre(buehne.app, kopf(buehne, akteur), "GET", "/api/auth/notice");
        return stand.body;
      },
    }),
  },
  {
    gruppe: "authRoutes",
    methode: "POST",
    route: "/api/auth/users/:id/approve",
    belegstelle: "services/auth/src/routes.ts:757",
    erfolg: [200],
    tor: "requireAdmin (eigener Guard des auth-Moduls, `routes.ts:329-344`)",
    erwartet: NUR_ADMIN,
    codes: { "401": AUTH_401 },
    ruesten: async (buehne) => {
      // Ein WIRKLICH nicht freigegebenes Konto: das zweite und jedes weitere Konto einer Instanz
      // entsteht als nicht freigegebener `experte` (`services/auth/src/service.ts:225`). Auf der
      // frischen Bühne ist das gefahrlos — vor JOB 4113 hätte dieser Griff den Kontenbestand
      // verändert, gegen den alle anderen Zeilen messen.
      const wartend = await buehne.services.auth.register({
        name: "Abnahme Wartend",
        email: "wartend@abnahme.de",
        password: PASSWORT,
      });
      return {
        pfad: `/api/auth/users/${wartend.id}/approve`,
        bestand: async () => {
          const liste = await musterhaft(buehne.app, kopf(buehne, "admin"), "GET", "/api/users");
          const treffer = (liste.json() as { id: string; approved?: boolean }[]).find(
            (k) => k.id === wartend.id,
          );
          return treffer?.approved ?? null;
        },
      };
    },
  },
  {
    gruppe: "authRoutes",
    methode: "POST",
    route: "/api/auth/users/:id/reset",
    belegstelle: "services/auth/src/routes.ts:769",
    erfolg: [204],
    tor: "requireAdmin (eigener Guard des auth-Moduls)",
    erwartet: NUR_ADMIN,
    codes: { "401": AUTH_401 },
    ruesten: async (buehne) => ({
      // Gesetzt wird das Passwort des VIEWER-Kontos: an der gemeinsamen Bühne hätte genau das die
      // Sitzung entwertet, mit der die folgenden Zeilen messen (der alte Restlistengrund).
      pfad: `/api/auth/users/${buehne.konto.viewer.id}/reset`,
      payload: { password: "Frisch-gesetzt-2026!" },
    }),
  },
];
