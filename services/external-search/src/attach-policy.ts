// AUFTRAG-mega16 Block A (bens SB-4, DRITTER Durchgang) — DIE STUFE IST EINE GRENZE, FAIL-CLOSED.
//
// DER BEFUND, den mega15 offen liess. Bis mega15 fragte die Route: „ist das ein ERKANNTER
// Provider?" — und pruefte die Stufe nur dann. Lieferte die Ableitung `null`, ging die Quelle
// UNGEACHTET der Stufe durch. bens Urteil: dieselbe externe Information laesst sich „ueber einen
// anderen oeffentlichen Host, einen Kurz-/Redirect-Link, einen Mirror oder ohne URL als
// vermeintlich manuelle Quelle anhaengen. Das sind keine Parsertricks, sondern der entscheidende
// semantische Bypass."
//
// PEDIS ENTSCHEIDUNG (25.07.2026): die Stufe wird FAIL-CLOSED durchgesetzt. Die Frage dreht sich um.
// Nicht mehr „erkannter Provider → pruefen", sondern „VERBOTEN, ausser die Stufe erlaubt es ODER
// die Quelle ist nachweislich intern". Erlaubnis braucht einen POSITIVEN, serverseitig gepruefeten
// Beleg; ein fehlender Beleg fuehrt zur Ablehnung, nie zur Durchfahrt. Das ist die Bedeutung von
// fail-closed und die einzige Richtung, in der ein Irrtum keinen Schaden anrichtet.
//
// Diese Datei ist die REINE Entscheidung: keine HTTP-, keine DB-, keine Fastify-Kenntnis. Sie
// beantwortet genau zwei Fragen — „welche REICHWEITE hat diese Adresse?" und „darf sie auf dieser
// Stufe an ein Wissensobjekt?" Die Route (services/app/src/routes/ko-routes.ts) beschafft die
// Tatsachen und vollzieht; die Oberflaeche (apps/web/src/lib/externalAttachGate.ts) sagt es vorher.

import type { ExternalKnowledgeStage } from "./policy";

// ---------------------------------------------------------------------------------------------
// 1. DIE REICHWEITE EINER QUELLE
// ---------------------------------------------------------------------------------------------
//
// Drei Faelle, mehr gibt es nicht — und jede Adresse faellt in GENAU einen davon:
//
//  internal    absolute http/https-Adresse, deren Hostname auf der KONFIGURIERTEN Allowlist
//              interner Origins steht. Eigene Unterlagen im eigenen Netz.
//  public      absolute http/https-Adresse, die NICHT auf der Allowlist steht. Alles Fremde —
//              Provider, Spiegel, Kurzlink, Redirector, ein privates Netz, das niemand
//              eingetragen hat. Kein Erkennen noetig: was nicht als intern belegt ist, IST
//              oeffentlich. Genau hier liegt die Umkehr gegenueber mega15.
//  unaddressed keine speicherbare Adresse — Feld fehlt, leer, relativ, schemalos oder ein anderes
//              Schema als http/https. Was hier landet, wird auch nicht als Adresse persistiert
//              (Spiegel von `safeSourceUrl`, services/knowledge-object/src/source-url.ts; die
//              Gleichheit beider Urteile ist in tests/app/external-attach-gate-e2e.test.ts
//              gepinnt). Eine Quelle, die nur aus einem Titel besteht, faellt ebenfalls hierher.
export type SourceReach = "internal" | "public" | "unaddressed";

// Hostnamen-Vergleich mit denselben Fallen wie die Herkunftsableitung (provenance.ts:66-69) —
// bewusst dieselbe Form, damit nicht zwei Vergleiche mit zwei Semantiken nebeneinander stehen:
//  - Gross-/Kleinschreibung normalisiert `new URL` bereits.
//  - Unicode-Homographen normalisiert `new URL` zu Punycode; „wikipediа.org" (kyrillisches а) wird
//    zu „xn--wikipedi-8sg.org" und matcht keinen ASCII-Eintrag.
//  - Abschliessender Punkt (FQDN-Form `intranet.example.`) wird entfernt.
//  - Die Punktgrenze haelt: `intranet.example.evil.test` endet nicht auf `.intranet.example`.
//  - Userinfo vor dem `@` beeinflusst `hostname` nicht.
//  - Eine rohe IP matcht nur, wenn genau diese IP eingetragen ist (kein Suffix-Match auf Ziffern).
function hostMatches(hostname: string, base: string): boolean {
  const host = hostname.replace(/\.$/, "");
  return host === base || host.endsWith(`.${base}`);
}

/**
 * Liest die Allowlist interner Origins aus einer Konfigurationszeichenkette (kommagetrennt).
 *
 * DIE ALLOWLIST KOMMT AUS DER KONFIGURATION, NIE AUS DEM CODE — das ist die Auflage. Ein Betreiber
 * traegt hier seine eigenen Hosts ein (`intranet.werk.local, confluence.werk.local`); im Code steht
 * kein einziger. Ohne Konfiguration ist die Liste LEER, und damit ist jede Adresse oeffentlich:
 * der Auslieferungszustand ist der geschlossene.
 *
 * Robust gegen die ueblichen Schreibweisen — ein Betreiber, der `https://intranet.werk.local/`
 * eintraegt, meint denselben Host wie `intranet.werk.local`. Unbrauchbare Eintraege werden
 * VERWORFEN, nicht geraten: ein Tippfehler darf keine Tuer aufmachen.
 */
export function parseInternalSourceOrigins(raw: string | null | undefined): string[] {
  if (typeof raw !== "string") {
    return [];
  }
  const hosts: string[] = [];
  for (const part of raw.split(",")) {
    const entry = part.trim();
    if (entry.length === 0) {
      continue;
    }
    // Mit Schema eingetragen → ueber den Parser auf den Hostnamen bringen (normalisiert auch
    // Gross-/Kleinschreibung und Unicode → Punycode). Ohne Schema: als blosser Host lesen.
    let host: string | null = null;
    if (entry.includes("://")) {
      try {
        host = new URL(entry).hostname;
      } catch {
        host = null;
      }
    } else {
      try {
        host = new URL(`https://${entry}`).hostname;
      } catch {
        host = null;
      }
    }
    if (!host) {
      continue;
    }
    const normalized = host.replace(/\.$/, "");
    // Ein leerer oder punktloser Platzhalter waere eine Sammel-Erlaubnis — verworfen.
    if (normalized.length === 0 || normalized === "." || !normalized.includes(".")) {
      continue;
    }
    if (!hosts.includes(normalized)) {
      hosts.push(normalized);
    }
  }
  return hosts;
}

/**
 * Ordnet eine vom Client gelieferte Adresse in genau eine Reichweite ein.
 *
 * Bewusst OHNE jede Ausnahme fuer private Netze, Loopback oder das eigene Produkt: was ein
 * Betreiber als intern gelten lassen will, traegt er ein. `http://127.0.0.1:8080/x` ist ohne
 * Eintrag `public` — richtig so, denn „privat" ist keine Eigenschaft, die dieser Server pruefen
 * kann (der Hostname sagt nichts ueber die Aufloesung), und ein Irrtum in diese Richtung waere
 * genau die Tuer, die fail-closed schliessen soll.
 */
export function classifySourceReach(url: unknown, internalHosts: readonly string[]): SourceReach {
  if (typeof url !== "string") {
    return "unaddressed";
  }
  const raw = url.trim();
  if (raw.length === 0) {
    return "unaddressed";
  }
  let parsed: URL;
  try {
    // OHNE Basis parsen NUR absolute Adressen erfolgreich — relativ („/x", „foo/bar") und
    // protokoll-relativ („//host/x") werfen. Der Parser entfernt eingebettete Tabs/Zeilenumbrueche,
    // sodass „java\tscript:" als `javascript:` erkannt wird (keine Obfuskation).
    parsed = new URL(raw);
  } catch {
    return "unaddressed";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "unaddressed";
  }
  for (const base of internalHosts) {
    if (hostMatches(parsed.hostname, base)) {
      return "internal";
    }
  }
  return "public";
}

// ---------------------------------------------------------------------------------------------
// 2. DIE ENTSCHEIDUNG
// ---------------------------------------------------------------------------------------------

// Warum eine Quelle abgelehnt wurde — die Oberflaeche soll den GRUND nennen, nicht bloss „Fehler".
export type AttachDenial = "public-source" | "unanchored-source";

export interface AttachRequestFacts {
  readonly stage: ExternalKnowledgeStage;
  readonly reach: SourceReach;
  /**
   * Ist die adresslose Quelle an ein Dokument gebunden, das DIESER Server an DIESEM Wissensobjekt
   * bereits haelt? Die Route belegt das gegen die eigene Anhangsliste (nicht gegen ein Client-Feld).
   */
  readonly anchoredToOwnAttachment: boolean;
}

export interface AttachDecision {
  readonly allowed: boolean;
  readonly denial?: AttachDenial;
}

const ALLOWED: AttachDecision = { allowed: true };

/**
 * DER VERTRAG. Eine Funktion, vier Stufen, drei Reichweiten — und keine stille vierte Moeglichkeit.
 *
 * Auf `search_attach` und `open` bleibt alles, wie es war: die Stufen erlauben das Anhaengen
 * externer Treffer ausdruecklich, also gibt es hier nichts zu pruefen.
 *
 * Auf `blocked` und `search_on_click` gilt fail-closed:
 *  - `internal`     → erlaubt. Der Betreiber hat diesen Origin ausdruecklich als eigenes Netz
 *                     eingetragen; das ist der positive Beleg.
 *  - `public`       → VERBOTEN. Ohne Ansehen des Hosts. Provider, Spiegel, Kurzlink, Redirector und
 *                     die von Hand abgetippte Adresse sind derselbe Fall — genau der Preis, den
 *                     Pedi ausdruecklich in Kauf genommen hat.
 *  - `unaddressed`  → nur mit Anker erlaubt. Eine Quelle ohne Adresse ist fuer diesen Server nicht
 *                     von einem externen Treffer zu unterscheiden, dem jemand die Adresse
 *                     weggenommen hat; „Adresse weglassen" darf keine Umgehung sein (bens Auflage).
 *                     Erlaubt ist sie deshalb NUR, wenn sie auf ein Dokument zeigt, das der Server
 *                     an diesem Wissensobjekt selbst haelt.
 *
 * EHRLICHE GRENZE, die hier stehen bleiben soll: der Anker belegt, dass die Belegstelle an ein im
 * Haus liegendes Dokument gebunden ist — er belegt NICHT, dass der Auszug wirklich aus diesem
 * Dokument stammt. Wer entschlossen genug ist, kann eine beliebige Datei hochladen und einen
 * fremden Auszug daran haengen. Das ist eine deutlich hoehere Huerde als „Adressfeld leer lassen"
 * und hinterlaesst eine auditierte Spur im eigenen Bestand (`ko.attached` + gespeichertes Objekt) —
 * aber es ist keine Unmoeglichkeit, und dieser Absatz ist die Stelle, an der das auffallen muss.
 * Ein wirklicher Beleg waere die Auszugs-Pruefung gegen den Dokumententext (G-2,
 * `excerptFoundInDocument`); sie braucht serverseitige Textextraktion und ist ein eigener Vorgang.
 */
export function decideExternalAttach(facts: AttachRequestFacts): AttachDecision {
  if (facts.stage === "search_attach" || facts.stage === "open") {
    return ALLOWED;
  }
  switch (facts.reach) {
    case "internal":
      return ALLOWED;
    case "public":
      return { allowed: false, denial: "public-source" };
    default:
      return facts.anchoredToOwnAttachment
        ? ALLOWED
        : { allowed: false, denial: "unanchored-source" };
  }
}
