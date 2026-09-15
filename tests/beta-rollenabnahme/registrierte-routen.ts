// ================================================================================================
// JOB 4061 · LIEFERUNG 1 — DIE AUFZÄHLUNG AUS DER LAUFENDEN APP: WELCHE TÜREN GIBT ES WIRKLICH?
// ================================================================================================
//
// `routengruppen.ts` liest die Kompositionswurzel als TEXT und zählt GRUPPEN. Das beantwortet eine
// andere Frage als diese Datei und bleibt bestehen (`routengruppen.ts:11-14`). Was die Gruppenzählung
// grundsätzlich NICHT sehen kann: verschwindet eine einzelne `app.get(...)` INNERHALB einer weiter
// registrierten Gruppe, bleibt die Gruppe registriert und die Abnahme schweigt. Deshalb zählt dieses
// Modul die ROUTEN — Methode und Pfad — an der Instanz, die `baueBuehne()` gebaut hat.
//
// ================================================================================================
// DER WEG: `app.printRoutes({ commonPrefix: false })`, NACHGEPRÜFT MIT `app.hasRoute`.
// ================================================================================================
//
// WARUM NICHT DER `onRoute`-HOOK, den man zuerst nähme: Fastify ruft die `onRoute`-Hooks
// SYNCHRON in dem Augenblick, in dem `app.get(...)` aufgerufen wird
// (`node_modules/fastify/lib/route.js:296-301`, `if (prefixing === false) { for (const hook of
// this[kHooks].onRoute) … }`). Ein Hook, den diese Abnahme anhängt, kann also frühestens NACH der
// Rückkehr von `buildApp` hängen — und genau dort sind die vier Routen, die `buildApp` unmittelbar
// selbst anlegt (`build-app.ts:1938`, `:1957`, `:1961`, `:2667`), bereits registriert. Der Hook
// sähe die Gruppen und übersähe ausgerechnet die vier Türen ohne Gruppe. `printRoutes` liest
// dagegen den FERTIGEN Router und kennt beide.
//
// WAS DER DRUCKER AUSGIBT (`node_modules/find-my-way/lib/pretty-print.js:132-160`): mit
// `commonPrefix: false` entsteht ein Knoten nur für Router-Knoten, an denen wirklich eine Route
// hängt; die statischen Zwischenstücke werden in den Schlüssel des nächsten solchen Knotens
// hineingezogen. Jede gedruckte Zeile ist damit eine echte Tür, und der vollständige Pfad ist die
// Verkettung der Schlüssel längs der Einrückung (vier Zeichen je Stufe, `:16-17`).
//
// WAS DIESER WEG NICHT SIEHT — ausgeschrieben, weil eine unbenannte Lücke schlimmer ist als eine
// benannte:
//   1. ROUTEN HINTER NICHT GESETZTEN SCHALTERN. Die Bühne setzt vier (`buehne.ts:54-65`). Was erst
//      unter einem fünften entsteht, ist in dieser Instanz gar nicht registriert und kann deshalb
//      auch nicht aufgezählt werden. Umgekehrt ist `@fastify/cors` an dieser Bühne SEHR WOHL
//      registriert — `resolveAddonOrigin()` liefert ohne gesetzte Umgebungsvariable den Vorgabewert
//      `https://localhost:3000` (`addon-api.ts:19-21`) —, und es legt dabei die Vorflugroute
//      `OPTIONS /*` an. Der Vermerk in `routengruppen.ts`, `cors` lege keine Route an, ist damit
//      gemessen widerlegt; die Route steht mit Grund in `NICHT_ABGENOMMEN`.
//   2. WAS KEINE ROUTE IST. Der 404-Fänger (`setNotFoundHandler`) steht nicht im Router; er ist
//      keine Tür, sondern das, was ohne Tür passiert.
//   3. DIE `HEAD`-SPIEGEL SIND KEINE EIGENEN TÜREN. Fastify legt zu jeder GET-Route automatisch
//      eine HEAD-Route mit DEMSELBEN Handler und DERSELBEN Hook-Kette an (`exposeHeadRoutes`).
//      Sie werden hier mitgezählt und ausgewiesen, aber nicht eigenständig abgenommen — dass keine
//      HEAD-Tür ohne GET-Zwilling existiert, prüft `jede-registrierte-route-ist-abgenommen.test.ts`
//      ausdrücklich nach, statt es zu behaupten.
//   4. PARAMETER-NAMEN. Teilen sich zwei Routen denselben Parameterknoten, druckt find-my-way beide
//      Namen mit `|` verbunden. Deshalb vergleicht diese Abnahme Pfade über ihre FORM und nicht über
//      die Namen (`normalisierePfad`).
//   5. EIN DRUCKFEHLER DES DRUCKERS BEI WILDCARDS. `buildObjectTree` reicht für einen
//      Wildcard-Kindknoten `'*'` statt `prefix + '*'` weiter (`pretty-print.js:157-159`) — der
//      Pfadrest zwischen dem letzten Routenknoten und dem Stern geht dabei verloren. Aus
//      `/addin/*` wird gedruckt `/addin` + `*`. Deshalb wird JEDER aufgezählte Pfad mit dem
//      öffentlichen `app.hasRoute` gegengeprüft; nur bei einem Stern am Ende wird EINE einzige
//      Wiederherstellung versucht (fehlender `/` vor dem Stern), und auch die gilt erst, wenn
//      `hasRoute` sie bestätigt. Was danach übrig bleibt, steht in `unklar` und macht den Wächter
//      rot, statt still zu verschwinden.
import type { FastifyInstance, HTTPMethods } from "fastify";

export interface RegistrierteRoute {
  /** `GET`, `POST`, … — so, wie der Router sie führt. */
  methode: string;
  /** Der Pfad, wie er REGISTRIERT ist: mit `:name` für Parameter und `*` für den Rest. */
  pfad: string;
}

export interface Aufzaehlung {
  /** Jede registrierte Tür, `HEAD`-Spiegel eingeschlossen. */
  routen: RegistrierteRoute[];
  /**
   * Gedruckte Zeilen, aus denen keine bestätigte Route wurde. IMMER leer, solange der Drucker sich
   * verhält wie beschrieben — und niemals stillschweigend: der Wächter nennt jede Zeile wörtlich.
   */
  unklar: string[];
  /** Pfade, die erst nach der Wildcard-Wiederherstellung (siehe Kopf, Punkt 4) bestätigt wurden. */
  repariert: string[];
}

/** Die Methoden, die Fastify selbst erzeugt, statt dass jemand sie schreibt. */
export const AUTOMATISCHE_METHODEN = ["HEAD"] as const;

/** Eine Zeile des Druckers: Einrückung, Verbinder, Schlüssel, Methoden in Klammern. */
const ZEILE = /^((?:(?:│|\s) {3})*)(?:├|└)── (.+)$/;
/** Der Methodenteil am Zeilenende — greedy, damit Klammern IM Pfad nicht gewinnen. */
const METHODEN = /^(.*) \(([A-Z][A-Z, ]*)\)$/;

/**
 * Der Pfad ohne Parameter-NAMEN: `/api/kos/:id` und `/api/kos/:koId` sind dieselbe Tür.
 *
 * Das ist keine Bequemlichkeit, sondern der Begriff, den der Router selbst benutzt: `hasRoute`
 * vergleicht das Muster ohne Namen, und der Drucker kann Namen gar nicht auseinanderhalten, wo sich
 * zwei Routen einen Parameterknoten teilen — er druckt dann beide Namen mit `|` verbunden
 * (`GET /api/learning-paths/:role|:pathId`, gemessen: `lifecycle-routes.ts:125` und `:157` hängen am
 * selben Knoten). Ein Vergleich über die Namen wäre an genau dieser Stelle falsch; ein Vergleich
 * über die Form ist überall richtig.
 */
export function normalisierePfad(pfad: string): string {
  return pfad
    .split("/")
    .map((teil) => (teil.startsWith(":") ? ":" : teil))
    .join("/");
}

/** Der Schlüssel, unter dem Aufzählung, Tabelle und Restliste dieselbe Tür meinen. */
export function schluessel(methode: string, pfad: string): string {
  return `${methode.toUpperCase()} ${normalisierePfad(pfad)}`;
}

// ================================================================================================
// RUNDE 2 — WELCHE ROUTE HAT DER ROUTER WIRKLICH GEWÄHLT?
// ================================================================================================
//
// HIER STAND EIN TEXTVERGLEICH, UND ER WAR FALSCH. `passtAufMuster` hat den gefahrenen Pfad gegen
// einen aus dem Muster gebauten regulären Ausdruck gehalten (`:id` → `[^/]+`). Der Prüfer hat
// gemessen, was das durchlässt: eine Zeile darf `route: "/api/duplicates/:id"` führen und dabei
// `/api/duplicates/settings` fahren — `settings` passt auf `[^/]+`, aber der Router wählt die
// STATISCHE Geschwisterroute. Ergebnis: die Parameterroute wird nie befragt, die statische zweimal,
// und die Abdeckung meldet trotzdem zwei geprüfte Endpunkte. Ein Regex-Vergleich kennt den Vorrang
// statischer Routen nicht; nur der Router kennt ihn.
//
// DESHALB FRAGT DIESE ABNAHME JETZT DEN ROUTER SELBST. Ein Hook schreibt je Anfrage
// `request.routeOptions.url` mit — das ist das REGISTRIERTE Muster der Route, die das Routing
// tatsächlich ausgewählt hat (öffentliche Fastify-API). Der Hook muss VOR `app.ready()` hängen und
// wird deshalb in `buehne.ts` gesetzt; die Zuordnung läuft über eine Marke im Anfragekopf, damit
// keine zwei Messungen einander überschreiben können.
//
// WARUM `onSend` UND NICHT `onRequest` — GEMESSEN, NICHT ÜBERLEGT. Ein `onRequest`-Mitschreiber
// wurde an zwei Türen übersprungen: `addin-static-routes.ts:118-128` beantwortet JEDEN Pfad im
// `/addin`-Namensraum ohne exakten Bündeltreffer bereits in einem eigenen `onRequest`-Hook
// (`staticNotFound(reply); return reply;`), und ein Kurzschluss dort überspringt die restliche
// onRequest-Kette. Die beiden `/addin`-Zeilen meldeten deshalb „keine Route getroffen", obwohl der
// Router sehr wohl `/addin` bzw. `/addin/*` gewählt hatte. `onSend` läuft dagegen für JEDE Antwort —
// auch für die aus einem Hook und die des 404-Fängers — und noch bevor die Antwort fertig ist.
//
// UND ER IST BEWUSST IM SYNCHRONEN RÜCKRUF-STIL geschrieben, nicht als `async`: `addin-static-routes.ts:132-137`
// hält fest, dass ein ZWEITER app-globaler ASYNC-onSend-Hook Fastifys Sende-Pipeline aufbrechen und
// `ERR_HTTP_HEADERS_SENT` auslösen kann. Diese Abnahme fügt deshalb keinen Microtask-Hop hinzu.
//
// WAS DABEI HERAUSKOMMT, IST STRENGER ALS DIE ALTE PRÜFUNG UND ERSETZT SIE VOLLSTÄNDIG: „die Route
// ist registriert" (Mengenprüfung) und „die gefahrene URL passt irgendwie auf das Muster"
// (Textprüfung) sind beide in der einen Frage aufgegangen, ob der Router für DIESE URL GENAU DIE
// Route gewählt hat, die die Zeile benennt.

/** Der Anfragekopf, über den eine Messung ihre Mitschrift wiederfindet. */
export const LAUF_KOPF = "x-abnahme-lauf-4061";

export interface Routenmitschrift {
  /**
   * Das registrierte Muster, das der Router für diese Marke gewählt hat — oder `undefined`, wenn
   * gar keine Route gegriffen hat (dann antwortet der 404-Fänger, und über Rechte ist nichts gesagt).
   */
  getroffen(marke: string): string | undefined;
}

/**
 * Hängt den Mitschreiber an die Instanz. MUSS vor `app.ready()` aufgerufen werden — danach lehnt
 * Fastify jeden weiteren Hook ab, und ein stillschweigend nicht gesetzter Hook liesse jede Messung
 * als „keine Route getroffen" erscheinen.
 *
 * Der Hook liest NUR mit: er ändert weder Antwort noch Kopfzeilen, damit die Bühne dieselbe App
 * bleibt, die der Server fährt.
 */
export function schreibeRouterentscheidungMit(app: FastifyInstance): Routenmitschrift {
  const treffer = new Map<string, string>();
  app.addHook("onSend", (request, _reply, payload, done) => {
    const marke = request.headers[LAUF_KOPF];
    if (typeof marke === "string") {
      const muster = request.routeOptions?.url;
      if (typeof muster === "string") {
        treffer.set(marke, muster);
      }
    }
    done(null, payload);
  });
  return { getroffen: (marke) => treffer.get(marke) };
}

/**
 * Zählt die Türen der übergebenen Instanz.
 *
 * Die Instanz MUSS `ready()` hinter sich haben — vorher steht im Router nur, was `buildApp`
 * unmittelbar selbst angelegt hat, und die Aufzählung wäre auf eine Weise unvollständig, die wie ein
 * Befund aussähe. `baueBuehne()` erledigt das (`buehne.ts:128`).
 */
export function zaehleRegistrierteRouten(app: FastifyInstance): Aufzaehlung {
  const routen: RegistrierteRoute[] = [];
  const unklar: string[] = [];
  const repariert: string[] = [];
  const stapel: string[] = [];

  for (const zeile of app.printRoutes({ commonPrefix: false }).split("\n")) {
    if (zeile.trim().length === 0) {
      continue;
    }
    const gedruckt = ZEILE.exec(zeile);
    if (!gedruckt) {
      unklar.push(zeile);
      continue;
    }
    const tiefe = (gedruckt[1] ?? "").length / 4;
    const rest = METHODEN.exec(gedruckt[2] ?? "");
    if (!rest) {
      unklar.push(zeile);
      continue;
    }
    stapel.length = tiefe;
    stapel[tiefe] = rest[1] ?? "";
    const roh = stapel.join("");
    const methoden = (rest[2] ?? "").split(",").map((m) => m.trim());
    for (const methode of methoden) {
      const pfad = bestaetige(app, methode, roh, repariert);
      if (pfad === null) {
        unklar.push(`${zeile}  → ${methode} ${roh} ist dem Router unbekannt`);
        continue;
      }
      routen.push({ methode, pfad });
    }
  }

  return { routen, unklar, repariert };
}

/**
 * Bestätigt einen abgelesenen Pfad am Router — oder stellt die eine bekannte Druckverkürzung her.
 *
 * `hasRoute` ist öffentliche Fastify-API (`types/instance.d.ts:207-211`) und vergleicht das
 * REGISTRIERTE Muster, nicht eine gefahrene URL. Damit ist jede Zeile dieser Aufzählung eine Zusage,
 * die der Router selbst unterschrieben hat.
 */
function bestaetige(
  app: FastifyInstance,
  methode: string,
  roh: string,
  repariert: string[],
): string | null {
  const kandidaten =
    roh.endsWith("*") && !roh.endsWith("/*") ? [roh, `${roh.slice(0, -1)}/*`] : [roh];
  for (const kandidat of kandidaten) {
    if (app.hasRoute({ method: methode as HTTPMethods, url: kandidat })) {
      if (kandidat !== roh) {
        repariert.push(`${methode} ${roh} → ${kandidat}`);
      }
      return kandidat;
    }
  }
  return null;
}
