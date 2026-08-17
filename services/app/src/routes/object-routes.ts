import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { isValidConfidentiality } from "../../../knowledge-object";
import {
  type ObjectKind,
  type ObjectPurpose,
  type ObjectRef,
  type ObjectStore,
  decodeDataUrl,
} from "../../../object-store";
import { type Guards, type SessionUser, sendError } from "../http";
import {
  type AnhangQuellen,
  type AnhangUrteil,
  type SichtbarkeitsFakten,
  beurteileAnhang,
} from "../sichtbarkeit";

// AUFTRAG-mega20 Block C: die erlaubten Zwecke als LAUFZEIT-Prüfung. Der Typ allein hilft an einer
// HTTP-Grenze nichts — dort kommt eine beliebige Zeichenkette an, und sie in den Vertrag zu casten
// hieße, dem Client den Lebenszyklus schreiben zu lassen.
const OBJECT_PURPOSES: ReadonlySet<string> = new Set<ObjectPurpose>([
  "anchor",
  "attachment",
  "media",
  "example",
  "unknown",
]);

function isObjectPurpose(value: string): value is ObjectPurpose {
  return OBJECT_PURPOSES.has(value);
}

// SCRUM-503 (ben-Nacht-1): Stored XSS über nutzerbestimmtes MIME. Der Object-Store speichert das
// beim Upload gelieferte `mime` verbatim; die /raw-Auslieferung setzte es 1:1 als Content-Type OHNE
// Content-Disposition → `text/html`/SVG wurde INLINE auf dem App-Origin gerendert → Script-Ausführung
// in der Admin-Session. Fix: nur eine Allowlist gefahrloser Bild-Typen darf inline mit ihrem echten
// Typ ausgeliefert werden (der `<img src>`-Editor-Fall); ALLES andere → application/octet-stream +
// Content-Disposition: attachment. Zusätzlich X-Content-Type-Options: nosniff (kein MIME-Sniffing).
// SVG bewusst NICHT in der Inline-Allowlist (kann Skripte tragen) → attachment.
const SAFE_INLINE_IMAGE_MIMES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

// Dateiname für den Content-Disposition-Header entschärfen (Header-Injection/Steuerzeichen raus).
function safeAttachmentName(name: unknown): string {
  const base = typeof name === "string" ? name : "download";
  const cleaned = base.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned.slice(0, 120) : "download";
}

// WP-D2 („Original ist heilig"): expliziter Route-bodyLimit statt des globalen 1-MiB-Fastify-Defaults
// (Muster CHECK_TEXT_BODY_LIMIT). Der Upload reist als JSON-Data-URL (Base64 ≈ Datei × 1,37) — der
// globale Default deckelte reale Dateien auf ~700 KB und ließ jedes normale Nutzer-PDF/DOCX mit 413
// scheitern, BEVOR MAX_OBJECT_BYTES überhaupt greifen konnte. 30 MiB umhüllt die 30-MB-Data-URL-
// Obergrenze des Object-Store plus JSON-Envelope; darüber → kontrolliertes 413.
export const OBJECTS_BODY_LIMIT = 30 * 1024 * 1024; // 30 MiB

// ================================================================================================
// AUFTRAG-mega74 BLOCK C — G4: DIE KOPFZEILE, DIE EINE SPERRE EIN JAHR ÜBERLEBTE.
// ================================================================================================
//
// Hier stand `Cache-Control: private, max-age=31536000, immutable` — ein Jahr, unveränderlich. Wer
// einen Anhang einmal geholt hatte, behielt ihn ein Jahr im Browser, auch nachdem das tragende
// Objekt gesperrt wurde. Bei einem ausgeschiedenen Mitarbeiter ist das genau der Fall, den ein
// Zugriffsschutz verhindern soll: der Serverentzug wirkt, die Kopie im Browser nicht.
//
// ================================================================================================
// JOB 579 · D5 — DIE FRIST WAR DAS LOCH. SIE IST WEG.
// ================================================================================================
//
// mega74 ersetzte das Jahr durch fünf Minuten. Das war besser und immer noch falsch: `max-age=300`
// ist die Erlaubnis, die Bytes **300 Sekunden lang ohne jede Rückfrage** weiterzuverwenden. In
// diesem Fenster wirkt kein Serverentzug — nicht die Höherstufung des tragenden Objekts, nicht
// seine Löschung, nicht der Rollenentzug. Genau dieses Fenster ist am Draht gemessen worden
// (JOB 579 D3, Sequenz S-B) und ist der gesamte Gegenstand dieses Durchgangs.
//
// DER SCHNITT, begründet:
//   · VERTRAULICH → `no-store`. Kein Zwischenspeicher, nirgends, auch nicht auf der Platte. Für
//     ein vertrauliches Original ist das die einzige Zusage, die trägt. UNVERÄNDERT.
//   · SONST → `private, no-cache, must-revalidate`. KEINE Frist mehr.
//       `no-cache`        erlaubt das Ablegen und verbietet die Wiederverwendung OHNE Rückfrage.
//                         Damit greift jeder Entzug beim nächsten Abruf — sofort, nicht nach 300 s.
//       `private`         bleibt nötig: `no-cache` erlaubt einem GETEILTEN Zwischenspeicher das
//                         Ablegen weiterhin; `private` verbietet es.
//       `must-revalidate` ist daneben redundant (es regelt den veralteten Zustand, den es ohne
//                         Frischefrist gar nicht gibt) und steht bewusst da: bei einer Kopfzeile,
//                         die ein Jahr lang unbemerkt falsch stand, ist die eindeutige Absicht für
//                         den nächsten Leser den Preis wert.
//   · JEDE NICHTAUSLIEFERUNG (404, 415) → `no-store`. Ein Fehlerzweig darf keine frühere positive
//     Zusage erben, und eine Ablehnung ist nichts, was irgendwo liegenbleiben dürfte.
//
// WAS DER SERVER NICHT KANN — und was hier deshalb NICHT versprochen wird: **Eine bereits
// abgelegte lokale Kopie kann er nicht löschen.** Keine Kopfzeile kann das. Die Zusage lautet
// ausschliesslich: Revalidierung vor Wiederverwendung, und beim nächsten Abruf sofortiger
// serverseitiger Entzug (404, keine Bytes).
//
// WAS ES KOSTET, ehrlich: `no-cache` OHNE Validator bedeutet **vollständige Neuübertragung** bei
// jeder Wiederverwendung. Es gibt hier bewusst keinen `ETag` und kein `Last-Modified`, also auch
// kein `304` — die Validator-Scheibe ist eine eigene, spätere Tranche. Bei einem Wissensobjekt mit
// vielen Bildern ist dieser Preis spürbar; er ist der bewusst gewählte Tausch von Ladezeit gegen
// Entziehbarkeit. (Der frühere Satz an dieser Stelle versprach „bedingte Anfragen, die mit 304
// beantwortet werden" — es gab nie einen Validator, der das hätte einlösen können.)
const CACHE_UNVERTRAULICH = "private, no-cache, must-revalidate";
const CACHE_VERTRAULICH = "no-store";
// Jede Nichtauslieferung — 404 wie 415, Metadaten- wie Rohbyteroute.
const CACHE_KEINE_ANTWORT = "no-store";

// Beide im Produkt LEBENDEN Authwege: `http.ts` liest den `authorization`-Kopf und fällt auf das
// Sitzungs-Cookie zurück. Nur die Nennung BEIDER trägt. Ehrlich eingeordnet: neben `private,
// no-cache` ist die praktische Wirkung klein — `Vary` ist die zweite Linie für den Fall, dass ein
// Zwischenspeicher `private` nicht respektiert. Es ist nicht die tragende Zusage.
const VARY_AUTH = "Cookie, Authorization";

/**
 * `Vary` setzen, ohne vorhandene Werte zu verlieren.
 *
 * Ein blindes `.header("Vary", …)` würde einen Wert überschreiben, den ein Plugin oder ein Hook
 * bereits gesetzt hat — und ein verlorener `Vary`-Anteil ist ein Zwischenspeicher, der zwei
 * verschiedene Antworten für dieselbe Adresse verwechselt. Gemessen (JOB 579 D3) trägt heute
 * nichts etwas nach; die Zusammenführung steht trotzdem hier, weil sie genau dann gebraucht wird,
 * wenn sich das ändert, und niemand daran denken würde.
 *
 * Der Vergleich ist ohne Rücksicht auf Gross-/Kleinschreibung: `Vary`-Feldnamen sind
 * Kopfzeilennamen, und die unterscheiden sie nicht.
 */
function mitVary(reply: FastifyReply): FastifyReply {
  const vorhanden = String(reply.getHeader("vary") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const bekannt = new Set(vorhanden.map((s) => s.toLowerCase()));
  const ergaenzt = [...vorhanden];
  for (const feld of VARY_AUTH.split(",").map((s) => s.trim())) {
    if (!bekannt.has(feld.toLowerCase())) {
      bekannt.add(feld.toLowerCase());
      ergaenzt.push(feld);
    }
  }
  reply.header("Vary", ergaenzt.join(", "));
  return reply;
}

// SCRUM-121: Objekt-/Attachment-Speicher. Upload liefert eine ObjectRef (nur Metadaten);
// das KO speichert die Referenz + kleine Vorschau statt des großen Originals.
//
// AUFTRAG-mega76 BLOCK A: `traeger` war OPTIONAL und ist jetzt PFLICHT. Der alte Kommentar nannte
// das „KEIN stiller Rückfall, sondern der Weg für Aufrufer ohne Wissensobjekt-Bestand" — genau das
// war der Fehler: fehlte der Zugang, antwortete `urteile` mit `{ sichtbar: true }`, also mit einem
// bedingungslosen Ja für JEDEN Anhang. Ein Schutz, den der Aufrufer weglassen kann, ist keiner.
// Pflichtparameter ohne Umbau möglich: einziger Aufrufer ist die Kompositionswurzel
// (build-app.ts:1045).
export function objectRoutes(
  store: ObjectStore,
  guards: Guards,
  quellen: AnhangQuellen,
): FastifyPluginAsync {
  // Die EINE Torwache dieser Datei. Sie beantwortet „darf dieser Mensch diesen Anhang sehen"
  // ausschliesslich über das Prädikat aus Block A — keine zweite Auslegung hier.
  async function urteile(
    user: SessionUser,
    objectId: string,
    ref: ObjectRef,
  ): Promise<AnhangUrteil> {
    // `ObjectRef.confidentiality` ist bewusst ein roher String (object-store bleibt von
    // knowledge-object entkoppelt, types.ts:94). Hier, an der Modulgrenze, wird er EINMAL geprüft;
    // ein unbekannter Wert wird nicht geraten, sondern fällt weg.
    const eigen: SichtbarkeitsFakten = {
      confidentiality: isValidConfidentiality(ref.confidentiality) ? ref.confidentiality : null,
      // Der Hochladende ist für das ungebundene Objekt das, was der Autor für ein Wissensobjekt
      // ist: die Person, die es erzeugt hat. `lifecycle.owner` kommt serverseitig aus der
      // Anmeldung (object-routes POST), nie aus dem Body — er ist damit belastbar.
      author: ref.lifecycle?.owner ?? null,
    };
    // mega76 A, zweite Linie unter dem Pflichtparameter: ein Aufrufer, den der Compiler nicht
    // sieht (JavaScript, `as never`, ein aus JSON gebautes Deps-Objekt), bekommt ein NEIN — nicht
    // das alte bedingungslose Ja.
    if (typeof quellen?.kos !== "function") {
      return { sichtbar: false, vertraulich: true };
    }
    return beurteileAnhang(user, objectId, eigen, quellen);
  }

  return async (app) => {
    app.post<{
      Body: {
        name: string;
        mime: string;
        data: string;
        kind?: ObjectKind;
        confidentiality?: string;
        // AUFTRAG-mega20 Block C: WOZU wird hochgeladen (s. object-store/src/types.ts).
        purpose?: string;
        draftId?: string;
      };
    }>("/api/objects", { bodyLimit: OBJECTS_BODY_LIMIT }, async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        const { name, mime, data, kind, confidentiality, purpose, draftId } = request.body;
        // AUFTRAG-mega20 Block C: der Zweck wird gegen die bekannte Liste geprüft und NIE geraten.
        // Ein unbekannter Wert wird zu „unknown" — also zur KONSERVATIVSTEN Einstufung, nicht zu
        // der, die der Client vielleicht gemeint hat. `owner` kommt aus der ANMELDUNG, nie aus dem
        // Body: er ist eine Herkunftsangabe, und eine erfundene Herkunft wäre schlechter als keine.
        const purposeField =
          typeof purpose === "string" && isObjectPurpose(purpose) ? { purpose } : {};
        // SCRUM-521 (WP1): Vertraulichkeit beim Upload persistieren — nur wenn es ein bekannter Level
        // ist. Ungültig/fehlend → nicht setzen; der Medien-Egress behandelt das Objekt dann fail-safe
        // als vertraulich (kein externer Transkriptions-Egress). Der Client kann so nur beim Upload
        // eine Einstufung setzen, nie nachträglich beim Analyse-Request herabstufen.
        const confidentialityField =
          typeof confidentiality === "string" && isValidConfidentiality(confidentiality)
            ? { confidentiality }
            : {};
        reply.code(201).send(
          await store.put({
            name,
            mime,
            data,
            ...(kind ? { kind } : {}),
            ...confidentialityField,
            ...purposeField,
            owner: user.id,
            ...(typeof draftId === "string" && draftId.trim() ? { draftId: draftId.trim() } : {}),
          }),
        );
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Params: { id: string } }>("/api/objects/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      // mega74 C: dieselbe Form wie am Wissensobjekt — nicht sichtbar sieht aus wie nicht
      // vorhanden. Ein 403 würde die Existenz des Anhangs bestätigen.
      //
      // JOB 579 D5: und derselbe Cachevertrag für BEIDE Fälle. Ob die Kennung gar nicht existiert
      // oder nur unsichtbar ist, darf sich weder am Status noch am Rumpf noch an einer Kopfzeile
      // unterscheiden — sonst wird die Kopfzeile zum Existenzorakel, das der 404 gerade verhindern
      // soll.
      if (!obj || !(await urteile(user, request.params.id, obj.ref)).sichtbar) {
        mitVary(reply)
          .header("Cache-Control", CACHE_KEINE_ANTWORT)
          .code(404)
          .send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      // Die erfolgreiche Antwort hängt am Betrachter — dieselbe Adresse liefert je nach Anmeldung
      // Metadaten oder 404.
      mitVary(reply).code(200).send(obj);
    });

    // SCRUM-45/46/48 (KW-STR): rohe Bytes für <img src="/api/objects/:id/raw"> im Editor-Body.
    app.get<{ Params: { id: string } }>("/api/objects/:id/raw", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const obj = await store.read(request.params.id);
      const urteil = obj
        ? await urteile(user, request.params.id, obj.ref)
        : { sichtbar: false, vertraulich: true };
      if (!obj || !urteil.sichtbar) {
        // JOB 579 D5: bytegleich zur Metadatenroute — Status, Rumpf und Cachevertrag.
        mitVary(reply)
          .header("Cache-Control", CACHE_KEINE_ANTWORT)
          .code(404)
          .send({ error: "NOT_FOUND", message: "Objekt nicht gefunden." });
        return;
      }
      const decoded = decodeDataUrl(obj.data);
      if (!decoded) {
        // JOB 579 D5: auch dieser Zweig ist eine Nichtauslieferung. Ohne die Zeile erbte er die
        // Vorgabe der Route — also eine positive Cachezusage für eine Antwort, die gar keine
        // Bytes trägt.
        mitVary(reply)
          .header("Cache-Control", CACHE_KEINE_ANTWORT)
          .code(415)
          .send({ error: "UNSUPPORTED", message: "Kein dekodierbares Objekt." });
        return;
      }
      // SCRUM-503: Content-Type NICHT aus dem nutzerkontrollierten `mime` durchreichen. Nur eine
      // Allowlist gefahrloser Bild-Typen wird inline mit echtem Typ ausgeliefert; alles andere wird
      // neutralisiert (octet-stream + attachment), sodass kein `text/html`/SVG inline auf dem
      // App-Origin rendert. nosniff verhindert MIME-Sniffing auf octet-stream.
      const claimedMime = obj.ref.mime || decoded.mime;
      const isSafeInlineImage = SAFE_INLINE_IMAGE_MIMES.has(claimedMime);
      mitVary(reply)
        .header("Content-Type", isSafeInlineImage ? claimedMime : "application/octet-stream")
        .header("X-Content-Type-Options", "nosniff")
        .header(
          "Content-Disposition",
          isSafeInlineImage
            ? "inline"
            : `attachment; filename="${safeAttachmentName(obj.ref.name)}"`,
        )
        // AUFTRAG-mega74 BLOCK C (G4): siehe die Begründung am Kopf der Datei. Die Stufe kommt aus
        // dem GESPEICHERTEN Objekt, nie aus der Anfrage.
        .header("Cache-Control", urteil.vertraulich ? CACHE_VERTRAULICH : CACHE_UNVERTRAULICH)
        .code(200)
        .send(decoded.bytes);
    });
  };
}
