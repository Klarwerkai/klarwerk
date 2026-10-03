// ================================================================================================
// R-1064 · DER SUPPORTWEG DIESER INSTALLATION — vom Betreiber festgelegt, in der Hilfe gezeigt.
// ================================================================================================
//
// Der Supportweg wird je Installation ORGANISATORISCH festgelegt (R-1064). Das Produkt erfindet ihn
// deshalb nicht und belegt ihn mit nichts vor: Es gibt genau zwei optionale Umgebungswerte, die der
// Betreiber auf dem vorhandenen Weg setzt (Coolify-Environment bzw. `.env`, siehe
// `docs/onboarding/user-quickstart.md`), und diese EINE Leseauskunft, die die Hilfe fragt.
//
//   KLARWERK_SUPPORT_URL    Ziel des Supportwegs: eine `https://`-Adresse ODER `mailto:<adresse>`.
//   KLARWERK_SUPPORT_LABEL  optional: der sichtbare Name des Wegs (z. B. „IT-Servicedesk").
//
// DREI ZUSTÄNDE, und jeder steht ehrlich so da, wie er ist:
//   · "eingerichtet"       — ein geprüftes Ziel; NUR dann liefert die Auskunft eine Adresse.
//   · "nicht_eingerichtet" — nichts gesetzt (oder leer). Kein Ersatzkontakt, keine Vorgabe.
//   · "ungueltig"          — gesetzt, aber nicht sicher auslieferbar. Der Rohwert geht NICHT
//                            hinaus: ein `javascript:`-Ziel als Text zurückzugeben hiesse, es einem
//                            Client anzubieten, der es eines Tages doch als Link setzt.
//
// WARUM SO ENG GEPRÜFT: Das Ziel landet als `href` in der Oberfläche. Erlaubt sind deshalb genau
// zwei Schemata — `https:` (ohne eingebettete Zugangsdaten) und `mailto:` mit GENAU EINER
// schlichten Adresse (keine Kopfzeilen wie `?bcc=`, keine Empfängerliste). Alles andere —
// `javascript:`, `data:`, `http:`, relative Pfade, Steuerzeichen — ist "ungueltig". Die Oberfläche
// prüft dieselbe Antwort noch einmal (`apps/web/src/api/support.ts`); beide Seiten müssen zustimmen.
//
// WANN GELESEN: einmal beim Aufbau der App (`build-app.ts`), nicht je Anfrage. Eine Änderung wirkt
// wie bei den übrigen Betreiberwerten erst mit einem neuen App-Prozess — und zwei Instanzen im
// selben Prozess (die Prüfstände) behalten jeweils IHREN Stand.
//
// SCHUTZ: angemeldete Nutzung genügt (`requireUser`), dieselbe Tür wie `/api/features`. Die
// Hilfeseite steht jeder Rolle offen (`minRole: "viewer"`); ein Recht darüber hinaus würde genau
// denen den Supportweg verstecken, die ihn am ehesten brauchen. Kein Adminzwang.
import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";

export type SupportKontakt =
  | {
      zustand: "eingerichtet";
      art: "https" | "mailto";
      /** Das geprüfte, normalisierte Ziel — genau dieser Wert wird `href`. */
      ziel: string;
      /** Der sichtbare Zieltext: die Adresse ohne `mailto:` bzw. die normalisierte URL. */
      anzeige: string;
      /** Der vom Betreiber vergebene Name — oder `null`: dann nennt die Oberfläche ihren. */
      bezeichnung: string | null;
    }
  | { zustand: "nicht_eingerichtet" }
  | { zustand: "ungueltig" };

const MAX_ZIEL = 500;
const MAX_BEZEICHNUNG = 80;

// Steuerzeichen und unsichtbare Zeichen — nichts davon gehört in ein Linkziel oder in eine
// einzeilige Beschriftung. Als Codepunkt-Test und nicht als Zeichenklasse, aus demselben Grund wie
// `istUnsichtbar` in `services/knowledge-object/src/search-projection.ts` (Biome:
// noControlCharactersInRegex; ein Literal mit den echten Zeichen wäre im Quelltext unlesbar).
function hatSteuerzeichen(text: string): boolean {
  for (const zeichen of text) {
    const code = zeichen.codePointAt(0) ?? 0;
    if (
      code <= 0x1f || // C0, einschliesslich Tabulator und Umbruch
      (code >= 0x7f && code <= 0x9f) || // DEL und C1
      (code >= 0x200b && code <= 0x200f) || // Zero-Width-Familie, Richtungsmarken
      code === 0x2028 || // Zeilentrenner
      code === 0x2029 || // Absatztrenner
      (code >= 0x202a && code <= 0x202e) || // Richtungsüberschreibungen
      code === 0x2060 || // Wortverbinder
      code === 0xfeff // BOM
    ) {
      return true;
    }
  }
  return false;
}

// Bewusst schlicht: Lokalteil aus Buchstaben, Ziffern und `._+-`, Domain aus Labels mit mindestens
// einem Punkt. Kein `%`, kein `?`, kein `,` — damit gibt es weder Kodierungstricks noch Kopfzeilen
// noch Empfängerlisten. Eine exotischere, aber gültige Adresse wird abgewiesen; das ist der Preis
// dafür, dass jede angenommene Adresse genau das ist, was sie zu sein scheint.
const MAIL_ADRESSE =
  /^[A-Za-z0-9._+-]{1,64}@(?=.{1,253}$)[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

type GeprueftesZiel = { art: "https" | "mailto"; ziel: string; anzeige: string };

function pruefeZiel(roh: string): GeprueftesZiel | null {
  if (roh.length > MAX_ZIEL || hatSteuerzeichen(roh) || /\s/.test(roh)) {
    return null;
  }
  if (/^mailto:/i.test(roh)) {
    const adresse = roh.slice("mailto:".length);
    if (!MAIL_ADRESSE.test(adresse)) {
      return null;
    }
    return { art: "mailto", ziel: `mailto:${adresse}`, anzeige: adresse };
  }
  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username !== "" || url.password !== "" || !url.hostname) {
    return null;
  }
  // Die Längengrenze gilt für das AUSGELIEFERTE Ziel, nicht nur für den Rohwert: `new URL` kodiert
  // z. B. jedes „ä" als `%C3%A4` (1 → 6 Zeichen). Ohne diese zweite Prüfung lieferte der Server ein
  // „eingerichtet" mit über 500 Zeichen, das der Client (`apps/web/src/api/support.ts`, dieselbe
  // Grenze) verwirft — die Hilfe zeigte dann „nicht ladbar" statt der ehrlichen Lage „ungueltig".
  if (url.href.length > MAX_ZIEL) {
    return null;
  }
  return { art: "https", ziel: url.href, anzeige: url.href };
}

/**
 * Liest die zwei Betreiberwerte und entscheidet den Zustand. Rein, ohne Seiteneffekt: dieselbe
 * Umgebung ergibt dieselbe Antwort. Weder Variablennamen noch Rohwerte gelangen in das Ergebnis.
 */
export function supportKontaktAusUmgebung(env: Record<string, string | undefined>): SupportKontakt {
  const ziel = (env.KLARWERK_SUPPORT_URL ?? "").trim();
  if (ziel === "") {
    return { zustand: "nicht_eingerichtet" };
  }
  const geprueft = pruefeZiel(ziel);
  if (!geprueft) {
    return { zustand: "ungueltig" };
  }
  const bezeichnung = (env.KLARWERK_SUPPORT_LABEL ?? "").trim();
  if (bezeichnung.length > MAX_BEZEICHNUNG || hatSteuerzeichen(bezeichnung)) {
    // Eine kaputte Beschriftung wird nicht still durch eine andere ersetzt: der Betreiber hat etwas
    // gesetzt, das nicht ausgeliefert wird, und das soll er sehen — nicht erst, wenn jemand fragt.
    return { zustand: "ungueltig" };
  }
  return { zustand: "eingerichtet", ...geprueft, bezeichnung: bezeichnung || null };
}

export interface SupportRouteDienste {
  kontakt: SupportKontakt;
}

export function supportRoutes(dienste: SupportRouteDienste, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    if (dienste.kontakt.zustand === "ungueltig") {
      // Ein Hinweis für den Betreiber im Startprotokoll — ohne den Wert selbst.
      app.log.warn(
        { supportkontakt: "UNGUELTIG" },
        "Supportkontakt gesetzt, aber nicht auslieferbar — die Hilfe zeigt ihn als ungültig an.",
      );
    }
    app.get("/api/support", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      reply.code(200).send(dienste.kontakt);
    });
  };
}
