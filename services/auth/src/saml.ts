import {
  type KeyObject,
  X509Certificate,
  createHash,
  createPublicKey,
  createVerify,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { type OidcClaims, type OidcRoleConfig, mapOidcRole } from "./oidc";
import type { Role } from "./types";

// ================================================================================================
// R-0560 · ANMELDUNG ÜBER DAS ÄLTERE UNTERNEHMENSVERFAHREN SAML 2.0.
// ================================================================================================
//
// DER WEG (SP-initiiert, wie ihn Entra ID, ADFS, Okta und Keycloak führen):
//   1. `GET /api/auth/saml/start` schickt eine AuthnRequest per HTTP-Redirect-Bindung zum Anbieter.
//      Ihre Kennung merkt sich dieser Prozess zehn Minuten lang — EINMAL einlösbar — zusammen mit
//      der Prüfsumme eines einmaligen Browsernachweises, den der Start als Cookie in GENAU den
//      startenden Browser legt.
//   2. Der Anbieter schickt die signierte Antwort per HTTP-POST an `POST /api/auth/saml/acs`.
//   3. `pruefeAntwort` prüft sie vollständig (unten) und gibt dieselbe Identität zurück, die der
//      OIDC-Weg liefert (`OidcClaims`), dazu die Bindung der eingelösten Anfrage.
//   4. `GET /api/auth/saml/abschluss` vergibt die Sitzung erst, wenn der Browser den passenden
//      Nachweis vorzeigt (s. `routes.ts`). Ab dort ist es DERSELBE Anmeldeweg (`loginWithOidc`):
//      Verknüpfung über (Aussteller, Subjekt), Selbstanlage, Rolle aus Gruppen, Sperre, Ablauf.
//
// WARUM KEINE FREMDE BIBLIOTHEK: im Bestand liegt keine XML-Signaturbibliothek, und eine
// Installation ist in diesem Auftrag nicht möglich. Die Signaturprüfung selbst macht `node:crypto`;
// selbst gebaut sind nur der XML-Leser und die exklusive Kanonisierung (exc-c14n). Beide sind
// bewusst SCHMAL: alles, was eine SAML-Antwort nicht braucht, wird ABGELEHNT statt geduldet —
// DOCTYPE, Entitäten ausser den fünf vordefinierten, Verarbeitungsanweisungen, verschlüsselte
// Assertions, IdP-initiierte Antworten, SHA-1.
//
// DIE PRÜFUNGEN, jede ein eigener Ablehnungsgrund (`SamlFehler.grund`, nur ins Protokoll):
//   · Signatur: Assertion ODER Antwort signiert, Referenz genau auf das signierte Element (#ID),
//     ID im Dokument eindeutig, nur enveloped-signature + exc-c14n, RSA-SHA256/512, Digest
//     SHA-256/512, Schlüssel AUSSCHLIESSLICH aus dem konfigurierten Zertifikat (KeyInfo im
//     Dokument wird nie benutzt).
//   · Gegen Signatur-Umhüllung (XSW): genau EINE Assertion im ganzen Dokument, direktes Kind der
//     Antwort; alle Werte werden aus GENAU dem Knoten gelesen, dessen Signatur geprüft wurde.
//   · Aussteller, Status, Destination, Audience, Recipient, InResponseTo (einmalig), Zeitfenster
//     mit zwei Minuten Uhrtoleranz, Wiederholung derselben Assertion.

export const SAML_NS = {
  protocol: "urn:oasis:names:tc:SAML:2.0:protocol",
  assertion: "urn:oasis:names:tc:SAML:2.0:assertion",
  metadata: "urn:oasis:names:tc:SAML:2.0:metadata",
  dsig: "http://www.w3.org/2000/09/xmldsig#",
  excC14n: "http://www.w3.org/2001/10/xml-exc-c14n#",
} as const;

const ALGORITHMUS = {
  enveloped: "http://www.w3.org/2000/09/xmldsig#enveloped-signature",
  rsaSha256: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha256",
  rsaSha512: "http://www.w3.org/2001/04/xmldsig-more#rsa-sha512",
  sha256: "http://www.w3.org/2001/04/xmlenc#sha256",
  sha512: "http://www.w3.org/2001/04/xmlenc#sha512",
} as const;

const XML_NS = "http://www.w3.org/XML/1998/namespace";
const STATUS_ERFOLG = "urn:oasis:names:tc:SAML:2.0:status:Success";
const BESTAETIGUNG_BEARER = "urn:oasis:names:tc:SAML:2.0:cm:bearer";
const NAMEID_EMAIL = "urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress";
const BINDUNG_POST = "urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST";

export const SAML_ANFRAGE_FRIST_MS = 10 * 60 * 1000;
export const SAML_UHR_TOLERANZ_MS = 2 * 60 * 1000;
const SAML_ANTWORT_MAX_ZEICHEN = 512 * 1024;
const OFFENE_ANFRAGEN_MAX = 10_000;

/** Ein Ablehnungsgrund. Der Text geht NUR ins Protokoll; der Mensch liest den Katalogsatz. */
export class SamlFehler extends Error {
  constructor(readonly grund: string) {
    super(grund);
    this.name = "SamlFehler";
  }
}

// --- XML: ein strenger, schmaler Leser ------------------------------------------------------------

export interface XmlAttribut {
  qname: string;
  prefix: string;
  local: string;
  ns: string;
  wert: string;
}

export interface XmlElement {
  art: "element";
  qname: string;
  prefix: string;
  local: string;
  ns: string;
  attribute: XmlAttribut[];
  /** Die Namensräume, die IM BEREICH dieses Elements gelten (Präfix → URI, "" = Vorgabe). */
  imBereich: Map<string, string>;
  kinder: XmlKnoten[];
  eltern: XmlElement | null;
}

export interface XmlText {
  art: "text";
  text: string;
}

export type XmlKnoten = XmlElement | XmlText;

const NAME = /[A-Za-z_][\w.-]*(?::[A-Za-z_][\w.-]*)?/y;
const LEERRAUM = /[ \t\n]*/y;
const GLEICH = /[ \t\n]*=[ \t\n]*/y;

function treffe(muster: RegExp, text: string, pos: number): string | undefined {
  muster.lastIndex = pos;
  return muster.exec(text)?.[0];
}

function teile(qname: string): [string, string] {
  const doppelpunkt = qname.indexOf(":");
  return doppelpunkt < 0
    ? ["", qname]
    : [qname.slice(0, doppelpunkt), qname.slice(doppelpunkt + 1)];
}

const VORDEFINIERT: Record<string, string> = {
  lt: "<",
  gt: ">",
  amp: "&",
  quot: '"',
  apos: "'",
};

function entschluessele(roh: string): string {
  return roh.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[A-Za-z]+);|&/g, (_ganz, ref?: string) => {
    if (ref === undefined) {
      throw new SamlFehler("XML: einzelnes &");
    }
    if (ref.startsWith("#")) {
      const code = ref.startsWith("#x") ? Number.parseInt(ref.slice(2), 16) : Number(ref.slice(1));
      if (
        !Number.isInteger(code) ||
        code <= 0 ||
        code > 0x10ffff ||
        (code >= 0xd800 && code <= 0xdfff)
      ) {
        throw new SamlFehler("XML: ungültiger Zeichenverweis");
      }
      return String.fromCodePoint(code);
    }
    const ersatz = VORDEFINIERT[ref];
    if (ersatz === undefined) {
      throw new SamlFehler("XML: unbekannte Entität");
    }
    return ersatz;
  });
}

/**
 * Liest ein XML-Dokument in einen Baum. Kommentare entfallen (exc-c14n ohne Kommentare), angrenzende
 * Texte werden zusammengefasst — ein Kommentar mitten in einer NameID ändert deshalb weder den
 * kanonischen noch den gelesenen Wert (bekannter Angriff gegen Bibliotheken, die nur den ersten
 * Textknoten lesen).
 */
export function leseXml(eingabe: string): XmlElement {
  const text = eingabe.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new SamlFehler("XML: DOCTYPE/ENTITY nicht erlaubt");
  }
  let pos = 0;
  if (text.startsWith("<?xml")) {
    const ende = text.indexOf("?>");
    if (ende < 0) {
      throw new SamlFehler("XML: Deklaration nicht geschlossen");
    }
    pos = ende + 2;
  }
  let wurzel: XmlElement | null = null;
  const stapel: XmlElement[] = [];

  const fuegeText = (inhalt: string): void => {
    const oben = stapel.at(-1);
    if (!oben) {
      if (inhalt.trim() !== "") {
        throw new SamlFehler("XML: Text ausserhalb des Wurzelelements");
      }
      return;
    }
    const letzter = oben.kinder.at(-1);
    if (letzter?.art === "text") {
      letzter.text += inhalt;
    } else if (inhalt !== "") {
      oben.kinder.push({ art: "text", text: inhalt });
    }
  };

  while (pos < text.length) {
    const lt = text.indexOf("<", pos);
    if (lt < 0) {
      fuegeText(entschluessele(text.slice(pos)));
      break;
    }
    if (lt > pos) {
      const roh = text.slice(pos, lt);
      if (roh.includes("]]>")) {
        throw new SamlFehler("XML: ']]>' im Text");
      }
      fuegeText(entschluessele(roh));
    }
    if (text.startsWith("<!--", lt)) {
      const ende = text.indexOf("-->", lt + 4);
      if (ende < 0) {
        throw new SamlFehler("XML: Kommentar nicht geschlossen");
      }
      pos = ende + 3;
      continue;
    }
    if (text.startsWith("<![CDATA[", lt)) {
      if (stapel.length === 0) {
        throw new SamlFehler("XML: CDATA ausserhalb des Wurzelelements");
      }
      const ende = text.indexOf("]]>", lt + 9);
      if (ende < 0) {
        throw new SamlFehler("XML: CDATA nicht geschlossen");
      }
      fuegeText(text.slice(lt + 9, ende));
      pos = ende + 3;
      continue;
    }
    if (text.startsWith("<?", lt) || text.startsWith("<!", lt)) {
      throw new SamlFehler("XML: Verarbeitungsanweisung oder Deklaration nicht erlaubt");
    }
    if (text.startsWith("</", lt)) {
      const ende = text.indexOf(">", lt);
      if (ende < 0) {
        throw new SamlFehler("XML: Endtag nicht geschlossen");
      }
      const name = text.slice(lt + 2, ende).trim();
      const oben = stapel.pop();
      if (!oben || oben.qname !== name) {
        throw new SamlFehler("XML: Endtag passt nicht");
      }
      pos = ende + 1;
      continue;
    }
    // Starttag.
    pos = lt + 1;
    const qname = treffe(NAME, text, pos);
    if (qname === undefined) {
      throw new SamlFehler("XML: Elementname fehlt");
    }
    pos += qname.length;
    const roheAttribute: [string, string][] = [];
    let leer = false;
    for (;;) {
      const raum = treffe(LEERRAUM, text, pos) ?? "";
      pos += raum.length;
      if (text.startsWith("/>", pos)) {
        leer = true;
        pos += 2;
        break;
      }
      if (text.startsWith(">", pos)) {
        pos += 1;
        break;
      }
      if (raum.length === 0) {
        throw new SamlFehler("XML: Attribut ohne Trennung");
      }
      const attributName = treffe(NAME, text, pos);
      if (attributName === undefined) {
        throw new SamlFehler("XML: Attributname fehlt");
      }
      pos += attributName.length;
      const gleich = treffe(GLEICH, text, pos);
      if (gleich === undefined) {
        throw new SamlFehler("XML: '=' fehlt");
      }
      pos += gleich.length;
      const zeichen = text[pos];
      if (zeichen !== '"' && zeichen !== "'") {
        throw new SamlFehler("XML: Attributwert ohne Anführungszeichen");
      }
      const ende = text.indexOf(zeichen, pos + 1);
      if (ende < 0) {
        throw new SamlFehler("XML: Attributwert nicht geschlossen");
      }
      const rohwert = text.slice(pos + 1, ende);
      if (rohwert.includes("<")) {
        throw new SamlFehler("XML: '<' im Attributwert");
      }
      // Normalisierung nach XML 1.0 §3.3.3: wörtlicher Leerraum wird zum Leerzeichen, ein
      // Zeichenverweis (&#xA;) bleibt, was er ist — deshalb VOR dem Entschlüsseln.
      roheAttribute.push([attributName, entschluessele(rohwert.replace(/[\t\n]/g, " "))]);
      pos = ende + 1;
    }

    const eltern = stapel.at(-1) ?? null;
    const imBereich = new Map<string, string>(eltern ? eltern.imBereich : [["xml", XML_NS]]);
    const gesehen = new Set<string>();
    for (const [name, wert] of roheAttribute) {
      if (gesehen.has(name)) {
        throw new SamlFehler("XML: doppeltes Attribut");
      }
      gesehen.add(name);
      if (name === "xmlns") {
        imBereich.set("", wert);
      } else if (name.startsWith("xmlns:")) {
        if (wert === "") {
          throw new SamlFehler("XML: leere Präfixbindung");
        }
        imBereich.set(name.slice(6), wert);
      }
    }
    const [prefix, local] = teile(qname);
    const ns = prefix ? imBereich.get(prefix) : (imBereich.get("") ?? "");
    if (ns === undefined) {
      throw new SamlFehler("XML: unbekanntes Präfix");
    }
    const attribute: XmlAttribut[] = [];
    for (const [name, wert] of roheAttribute) {
      if (name === "xmlns" || name.startsWith("xmlns:")) {
        continue;
      }
      const [aPrefix, aLocal] = teile(name);
      const aNs = aPrefix ? imBereich.get(aPrefix) : "";
      if (aNs === undefined) {
        throw new SamlFehler("XML: unbekanntes Attributpräfix");
      }
      if (attribute.some((a) => a.ns === aNs && a.local === aLocal)) {
        throw new SamlFehler("XML: doppeltes Attribut");
      }
      attribute.push({ qname: name, prefix: aPrefix, local: aLocal, ns: aNs, wert });
    }
    const element: XmlElement = {
      art: "element",
      qname,
      prefix,
      local,
      ns,
      attribute,
      imBereich,
      kinder: [],
      eltern,
    };
    if (eltern) {
      eltern.kinder.push(element);
    } else {
      if (wurzel) {
        throw new SamlFehler("XML: mehr als ein Wurzelelement");
      }
      wurzel = element;
    }
    if (!leer) {
      stapel.push(element);
    }
  }
  if (stapel.length > 0 || !wurzel) {
    throw new SamlFehler("XML: Dokument unvollständig");
  }
  return wurzel;
}

export function kinderVon(el: XmlElement, ns: string, local: string): XmlElement[] {
  return el.kinder.filter(
    (k): k is XmlElement => k.art === "element" && k.ns === ns && k.local === local,
  );
}

function einKind(el: XmlElement, ns: string, local: string): XmlElement {
  const treffer = kinderVon(el, ns, local);
  if (treffer.length !== 1) {
    throw new SamlFehler(`${local}: erwartet genau eins, gefunden ${treffer.length}`);
  }
  return treffer[0] as XmlElement;
}

export function nachfahren(el: XmlElement, ns: string, local: string): XmlElement[] {
  const treffer: XmlElement[] = [];
  const laufe = (knoten: XmlElement): void => {
    for (const k of knoten.kinder) {
      if (k.art === "element") {
        if (k.ns === ns && k.local === local) {
          treffer.push(k);
        }
        laufe(k);
      }
    }
  };
  laufe(el);
  return treffer;
}

export function attributVon(el: XmlElement, local: string): string | undefined {
  return el.attribute.find((a) => a.ns === "" && a.local === local)?.wert;
}

export function textVon(el: XmlElement): string {
  return el.kinder.map((k) => (k.art === "text" ? k.text : textVon(k))).join("");
}

// --- Exklusive Kanonisierung (http://www.w3.org/2001/10/xml-exc-c14n#) ----------------------------

function maskiereAttribut(wert: string): string {
  return wert
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

function maskiereText(wert: string): string {
  return wert
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r/g, "&#xD;");
}

function vergleiche(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Exklusive Kanonisierung eines Teilbaums. `ohne` ist die eine Signatur, die die
 * enveloped-signature-Transformation herausnimmt; `inklusiv` die PrefixList aus
 * `InclusiveNamespaces` ("#default" = Vorgabenamensraum).
 *
 * Gerendert wird ein Namensraum genau dann, wenn das Element ihn SICHTBAR NUTZT (eigenes Präfix
 * oder Präfix eines Attributs) oder er in der PrefixList steht — und kein Ausgabevorfahr ihn mit
 * demselben Wert schon gerendert hat. Namensräume nach Präfix, Attribute nach (URI, lokaler Name).
 */
export function kanonisiere(
  el: XmlElement,
  opts: { ohne?: XmlElement; inklusiv?: readonly string[] } = {},
): string {
  const ausgabe: string[] = [];
  schreibe(el, new Map([["", ""]]), opts, ausgabe);
  return ausgabe.join("");
}

function schreibe(
  el: XmlElement,
  gerendert: ReadonlyMap<string, string>,
  opts: { ohne?: XmlElement; inklusiv?: readonly string[] },
  ausgabe: string[],
): void {
  if (el === opts.ohne) {
    return;
  }
  const genutzt = new Set<string>([el.prefix]);
  for (const a of el.attribute) {
    if (a.prefix !== "" && a.prefix !== "xml") {
      genutzt.add(a.prefix);
    }
  }
  for (const p of opts.inklusiv ?? []) {
    const schluessel = p === "#default" ? "" : p;
    if (el.imBereich.has(schluessel)) {
      genutzt.add(schluessel);
    }
  }
  const weiter = new Map(gerendert);
  const deklarationen: [string, string][] = [];
  for (const prefix of genutzt) {
    if (prefix === "xml") {
      continue;
    }
    const uri = prefix === "" ? (el.imBereich.get("") ?? "") : el.imBereich.get(prefix);
    if (uri === undefined || gerendert.get(prefix) === uri) {
      continue;
    }
    deklarationen.push([prefix, uri]);
    weiter.set(prefix, uri);
  }
  deklarationen.sort((a, b) => vergleiche(a[0], b[0]));
  const attribute = [...el.attribute].sort((a, b) =>
    a.ns !== b.ns ? vergleiche(a.ns, b.ns) : vergleiche(a.local, b.local),
  );
  ausgabe.push("<", el.qname);
  for (const [prefix, uri] of deklarationen) {
    ausgabe.push(prefix === "" ? ' xmlns="' : ` xmlns:${prefix}="`, maskiereAttribut(uri), '"');
  }
  for (const a of attribute) {
    ausgabe.push(" ", a.qname, '="', maskiereAttribut(a.wert), '"');
  }
  ausgabe.push(">");
  for (const kind of el.kinder) {
    if (kind.art === "text") {
      ausgabe.push(maskiereText(kind.text));
    } else {
      schreibe(kind, weiter, opts, ausgabe);
    }
  }
  ausgabe.push("</", el.qname, ">");
}

// --- XML-Signatur ---------------------------------------------------------------------------------

function inklusivListe(el: XmlElement): string[] {
  const inklusiv = kinderVon(el, SAML_NS.excC14n, "InclusiveNamespaces")[0];
  return inklusiv ? (attributVon(inklusiv, "PrefixList") ?? "").split(/\s+/).filter(Boolean) : [];
}

function zaehleIds(wurzel: XmlElement): Map<string, number> {
  const zaehler = new Map<string, number>();
  const laufe = (el: XmlElement): void => {
    const id = attributVon(el, "ID");
    if (id !== undefined) {
      zaehler.set(id, (zaehler.get(id) ?? 0) + 1);
    }
    for (const k of el.kinder) {
      if (k.art === "element") {
        laufe(k);
      }
    }
  };
  laufe(wurzel);
  return zaehler;
}

function base64(el: XmlElement): Buffer {
  return Buffer.from(textVon(el).replace(/\s+/g, ""), "base64");
}

/**
 * Prüft die EINE Signatur, die direktes Kind von `signiert` ist. `false`, wenn es keine gibt; ein
 * `SamlFehler`, wenn es eine gibt und sie nicht trägt.
 */
export function pruefeSignatur(
  signiert: XmlElement,
  schluessel: KeyObject,
  ids: ReadonlyMap<string, number>,
): boolean {
  const signaturen = kinderVon(signiert, SAML_NS.dsig, "Signature");
  if (signaturen.length === 0) {
    return false;
  }
  if (signaturen.length > 1) {
    throw new SamlFehler("Signatur: mehr als eine");
  }
  const signatur = signaturen[0] as XmlElement;
  const signedInfo = einKind(signatur, SAML_NS.dsig, "SignedInfo");
  const kanon = einKind(signedInfo, SAML_NS.dsig, "CanonicalizationMethod");
  if (attributVon(kanon, "Algorithm") !== SAML_NS.excC14n) {
    throw new SamlFehler("Signatur: Kanonisierung nicht exc-c14n");
  }
  const methode = attributVon(einKind(signedInfo, SAML_NS.dsig, "SignatureMethod"), "Algorithm");
  const signaturHash =
    methode === ALGORITHMUS.rsaSha256
      ? "RSA-SHA256"
      : methode === ALGORITHMUS.rsaSha512
        ? "RSA-SHA512"
        : undefined;
  if (!signaturHash) {
    throw new SamlFehler("Signatur: Verfahren nicht zugelassen");
  }
  const referenz = einKind(signedInfo, SAML_NS.dsig, "Reference");
  const id = attributVon(signiert, "ID");
  if (!id || attributVon(referenz, "URI") !== `#${id}`) {
    throw new SamlFehler("Signatur: Referenz zeigt nicht auf das signierte Element");
  }
  if (ids.get(id) !== 1) {
    throw new SamlFehler("Signatur: ID nicht eindeutig");
  }
  let enveloped = false;
  let exklusiv = false;
  let inklusiv: string[] = [];
  const transformationen = kinderVon(referenz, SAML_NS.dsig, "Transforms")[0];
  for (const t of transformationen ? kinderVon(transformationen, SAML_NS.dsig, "Transform") : []) {
    const algorithmus = attributVon(t, "Algorithm");
    if (algorithmus === ALGORITHMUS.enveloped) {
      enveloped = true;
    } else if (algorithmus === SAML_NS.excC14n) {
      exklusiv = true;
      inklusiv = inklusivListe(t);
    } else {
      throw new SamlFehler("Signatur: Transformation nicht zugelassen");
    }
  }
  if (!enveloped || !exklusiv) {
    throw new SamlFehler("Signatur: enveloped-signature und exc-c14n verlangt");
  }
  const digestVerfahren = attributVon(einKind(referenz, SAML_NS.dsig, "DigestMethod"), "Algorithm");
  const digestHash =
    digestVerfahren === ALGORITHMUS.sha256
      ? "sha256"
      : digestVerfahren === ALGORITHMUS.sha512
        ? "sha512"
        : undefined;
  if (!digestHash) {
    throw new SamlFehler("Signatur: Digest-Verfahren nicht zugelassen");
  }
  const soll = base64(einKind(referenz, SAML_NS.dsig, "DigestValue"));
  const ist = createHash(digestHash)
    .update(kanonisiere(signiert, { ohne: signatur, inklusiv }), "utf8")
    .digest();
  if (soll.length !== ist.length || !timingSafeEqual(soll, ist)) {
    throw new SamlFehler("Signatur: Digest stimmt nicht");
  }
  const signedInfoKanon = kanonisiere(signedInfo, { inklusiv: inklusivListe(kanon) });
  const wert = base64(einKind(signatur, SAML_NS.dsig, "SignatureValue"));
  if (!createVerify(signaturHash).update(signedInfoKanon, "utf8").verify(schluessel, wert)) {
    throw new SamlFehler("Signatur: Wert stimmt nicht");
  }
  return true;
}

// --- Der Anbieter ---------------------------------------------------------------------------------

export interface SamlKonfig {
  idpEntityId: string;
  idpSsoUrl: string;
  idpSchluessel: KeyObject;
  spEntityId: string;
  acsUrl: string;
  autoProvision: boolean;
  attributEmail: string;
  attributName: string;
  attributGruppen: string;
  rollen: Omit<OidcRoleConfig, "roleClaim">;
}

export interface SamlErgebnis {
  claims: OidcClaims;
  rolle: Role;
  /**
   * Die Browserbindung der eingelösten Anfrage (Prüfsumme des Nachweises, den der Start in den
   * startenden Browser gelegt hat) — `undefined`, wenn die Anfrage ohne gestellt wurde. Die Route
   * vergibt eine Sitzung NUR, wenn der zurückkehrende Browser den passenden Nachweis vorzeigt.
   */
  bindung: string | undefined;
}

export interface SamlProvider {
  readonly config: SamlKonfig;
  readonly autoProvision: boolean;
  /**
   * Die Adresse beim Anbieter; die Anfragekennung gilt zehn Minuten und genau einmal. `relayState`
   * reist unverändert hin und zurück — die Route lässt dafür nur EINEN festen Wert zu. `bindung`
   * wird mit der Anfragekennung gemerkt und von `pruefeAntwort` zurückgegeben.
   */
  anmeldeUrl(relayState?: string, bindung?: string): string;
  pruefeAntwort(samlResponse: string): SamlErgebnis;
  metadaten(): string;
}

const ISO_ZEIT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function zeitpunkt(wert: string | undefined): number | undefined {
  if (wert === undefined) {
    return undefined;
  }
  const ms = ISO_ZEIT.test(wert) ? Date.parse(wert) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw new SamlFehler("Zeitangabe unlesbar");
  }
  return ms;
}

function maskiere(wert: string): string {
  return maskiereAttribut(wert).replace(/>/g, "&gt;");
}

export function createSamlProvider(
  config: SamlKonfig,
  deps: { now?: () => number; genId?: () => string } = {},
): SamlProvider {
  const jetzt = deps.now ?? (() => Date.now());
  const neueId = deps.genId ?? (() => `_${randomBytes(16).toString("hex")}`);
  const offeneAnfragen = new Map<string, { bis: number; bindung: string | undefined }>();
  const verbrauchteAssertions = new Map<string, number>();

  const raeumeAuf = (): void => {
    const nun = jetzt();
    for (const [id, anfrage] of offeneAnfragen) {
      if (anfrage.bis <= nun) {
        offeneAnfragen.delete(id);
      }
    }
    for (const [id, bis] of verbrauchteAssertions) {
      if (bis <= nun) {
        verbrauchteAssertions.delete(id);
      }
    }
  };

  return {
    config,
    autoProvision: config.autoProvision,
    anmeldeUrl(relayState?: string, bindung?: string): string {
      raeumeAuf();
      if (offeneAnfragen.size >= OFFENE_ANFRAGEN_MAX) {
        // Eine Flut offener Starts darf den Speicher nicht füllen; die älteste fällt heraus.
        const aelteste = offeneAnfragen.keys().next().value;
        if (aelteste !== undefined) {
          offeneAnfragen.delete(aelteste);
        }
      }
      const id = neueId();
      const nun = jetzt();
      offeneAnfragen.set(id, { bis: nun + SAML_ANFRAGE_FRIST_MS, bindung });
      const zeit = new Date(nun).toISOString().replace(/\.\d{3}Z$/, "Z");
      const anfrage = [
        `<samlp:AuthnRequest xmlns:samlp="${SAML_NS.protocol}" xmlns:saml="${SAML_NS.assertion}"`,
        ` ID="${maskiere(id)}" Version="2.0" IssueInstant="${zeit}"`,
        ` Destination="${maskiere(config.idpSsoUrl)}"`,
        ` AssertionConsumerServiceURL="${maskiere(config.acsUrl)}" ProtocolBinding="${BINDUNG_POST}">`,
        `<saml:Issuer>${maskiere(config.spEntityId)}</saml:Issuer>`,
        `<samlp:NameIDPolicy AllowCreate="true"/></samlp:AuthnRequest>`,
      ].join("");
      const ziel = new URL(config.idpSsoUrl);
      ziel.searchParams.set(
        "SAMLRequest",
        deflateRawSync(Buffer.from(anfrage, "utf8")).toString("base64"),
      );
      if (relayState) {
        ziel.searchParams.set("RelayState", relayState);
      }
      return ziel.toString();
    },

    pruefeAntwort(samlResponse: string): SamlErgebnis {
      if (samlResponse.length > SAML_ANTWORT_MAX_ZEICHEN) {
        throw new SamlFehler("Antwort zu gross");
      }
      raeumeAuf();
      const nun = jetzt();
      const xml = Buffer.from(samlResponse.replace(/\s+/g, ""), "base64").toString("utf8");
      const wurzel = leseXml(xml);
      if (wurzel.ns !== SAML_NS.protocol || wurzel.local !== "Response") {
        throw new SamlFehler("keine SAML-Antwort");
      }
      // InResponseTo ZUERST und einmalig: eine Antwort ohne eigene Anfrage (IdP-initiiert) oder
      // eine zweite Einlösung derselben Anfrage kommt nicht weiter.
      const inResponseTo = attributVon(wurzel, "InResponseTo");
      const anfrage = inResponseTo === undefined ? undefined : offeneAnfragen.get(inResponseTo);
      if (inResponseTo === undefined || anfrage === undefined || anfrage.bis <= nun) {
        throw new SamlFehler("InResponseTo unbekannt, abgelaufen oder verbraucht");
      }
      offeneAnfragen.delete(inResponseTo);
      const ziel = attributVon(wurzel, "Destination");
      if (ziel !== undefined && ziel !== config.acsUrl) {
        throw new SamlFehler("Destination passt nicht");
      }
      const antwortAussteller = kinderVon(wurzel, SAML_NS.assertion, "Issuer")[0];
      if (antwortAussteller && textVon(antwortAussteller).trim() !== config.idpEntityId) {
        throw new SamlFehler("Aussteller der Antwort passt nicht");
      }
      const status = einKind(wurzel, SAML_NS.protocol, "Status");
      const code = attributVon(einKind(status, SAML_NS.protocol, "StatusCode"), "Value");
      if (code !== STATUS_ERFOLG) {
        throw new SamlFehler(`Status ${code ?? "fehlt"}`);
      }
      if (nachfahren(wurzel, SAML_NS.assertion, "EncryptedAssertion").length > 0) {
        throw new SamlFehler("verschlüsselte Assertion wird nicht unterstützt");
      }
      const assertions = nachfahren(wurzel, SAML_NS.assertion, "Assertion");
      const assertion = assertions[0];
      if (assertions.length !== 1 || !assertion || assertion.eltern !== wurzel) {
        throw new SamlFehler("genau eine Assertion als Kind der Antwort verlangt");
      }
      const ids = zaehleIds(wurzel);
      if (
        !pruefeSignatur(assertion, config.idpSchluessel, ids) &&
        !pruefeSignatur(wurzel, config.idpSchluessel, ids)
      ) {
        throw new SamlFehler("weder Assertion noch Antwort signiert");
      }

      if (textVon(einKind(assertion, SAML_NS.assertion, "Issuer")).trim() !== config.idpEntityId) {
        throw new SamlFehler("Aussteller der Assertion passt nicht");
      }
      const subject = einKind(assertion, SAML_NS.assertion, "Subject");
      const nameIdElement = einKind(subject, SAML_NS.assertion, "NameID");
      const nameId = textVon(nameIdElement).trim();
      if (!nameId) {
        throw new SamlFehler("NameID leer");
      }
      const bestaetigt = kinderVon(subject, SAML_NS.assertion, "SubjectConfirmation").some((sc) => {
        if (attributVon(sc, "Method") !== BESTAETIGUNG_BEARER) {
          return false;
        }
        const daten = kinderVon(sc, SAML_NS.assertion, "SubjectConfirmationData")[0];
        if (!daten || attributVon(daten, "Recipient") !== config.acsUrl) {
          return false;
        }
        if (attributVon(daten, "NotBefore") !== undefined) {
          return false;
        }
        const bis = zeitpunkt(attributVon(daten, "NotOnOrAfter"));
        if (bis === undefined || bis <= nun - SAML_UHR_TOLERANZ_MS) {
          return false;
        }
        const antwortAuf = attributVon(daten, "InResponseTo");
        return antwortAuf === undefined || antwortAuf === inResponseTo;
      });
      if (!bestaetigt) {
        throw new SamlFehler("keine gültige Bearer-Bestätigung");
      }
      const bedingungen = einKind(assertion, SAML_NS.assertion, "Conditions");
      const ab = zeitpunkt(attributVon(bedingungen, "NotBefore"));
      if (ab !== undefined && ab > nun + SAML_UHR_TOLERANZ_MS) {
        throw new SamlFehler("Assertion noch nicht gültig");
      }
      const bis = zeitpunkt(attributVon(bedingungen, "NotOnOrAfter"));
      if (bis !== undefined && bis <= nun - SAML_UHR_TOLERANZ_MS) {
        throw new SamlFehler("Assertion abgelaufen");
      }
      const zielgruppen = kinderVon(bedingungen, SAML_NS.assertion, "AudienceRestriction");
      if (
        zielgruppen.length === 0 ||
        !zielgruppen.every((z) =>
          kinderVon(z, SAML_NS.assertion, "Audience").some(
            (a) => textVon(a).trim() === config.spEntityId,
          ),
        )
      ) {
        throw new SamlFehler("Audience passt nicht");
      }
      const assertionId = attributVon(assertion, "ID") ?? "";
      if (verbrauchteAssertions.has(assertionId)) {
        throw new SamlFehler("Assertion bereits verwendet");
      }
      verbrauchteAssertions.set(assertionId, bis ?? nun + SAML_ANFRAGE_FRIST_MS);

      const werte = new Map<string, string[]>();
      for (const aussage of kinderVon(assertion, SAML_NS.assertion, "AttributeStatement")) {
        for (const a of kinderVon(aussage, SAML_NS.assertion, "Attribute")) {
          const name = attributVon(a, "Name");
          if (name === undefined) {
            continue;
          }
          const liste = kinderVon(a, SAML_NS.assertion, "AttributeValue")
            .map((v) => textVon(v).trim())
            .filter(Boolean);
          werte.set(name, [...(werte.get(name) ?? []), ...liste]);
        }
      }
      const email =
        werte.get(config.attributEmail)?.[0] ??
        (attributVon(nameIdElement, "Format") === NAMEID_EMAIL ? nameId : undefined);
      if (!email) {
        throw new SamlFehler("keine E-Mail-Adresse in der Assertion");
      }
      const gruppen = werte.get(config.attributGruppen);
      const claims: OidcClaims = {
        sub: nameId,
        email,
        name: werte.get(config.attributName)?.[0] ?? email,
        roles: gruppen ?? [],
        iss: config.idpEntityId,
        // SAML kennt kein email_verified: „keine Aussage" — derselbe Weg wie ein OIDC-Anbieter
        // ohne den Claim (Verknüpfung mit Vermerk `user.oidc-linked-unverified`, R-0503).
        emailVerified: undefined,
        rolesClaimPresent: gruppen !== undefined,
      };
      return {
        claims,
        rolle: mapOidcRole(claims.roles, { roleClaim: "", ...config.rollen }),
        bindung: anfrage.bindung,
      };
    },

    metadaten(): string {
      return [
        `<md:EntityDescriptor xmlns:md="${SAML_NS.metadata}" entityID="${maskiere(config.spEntityId)}">`,
        `<md:SPSSODescriptor AuthnRequestsSigned="false" WantAssertionsSigned="true"`,
        ` protocolSupportEnumeration="${SAML_NS.protocol}">`,
        `<md:AssertionConsumerService Binding="${BINDUNG_POST}" Location="${maskiere(config.acsUrl)}"`,
        ` index="0" isDefault="true"/></md:SPSSODescriptor></md:EntityDescriptor>`,
      ].join("");
    },
  };
}

/**
 * Der Signaturschlüssel des Anbieters aus der Umgebung: ein Zertifikat als PEM (auch mit `\n` als
 * Zeichenfolge) oder nackt Base64 — so liefern es Entra und ADFS in ihren Metadaten — oder der
 * öffentliche Schlüssel selbst als PEM. Unlesbar heisst `undefined`; der Startbericht nennt es.
 */
export function samlSchluesselAus(roh: string): KeyObject | undefined {
  const text = roh.replace(/\\n/g, "\n");
  try {
    if (text.includes("BEGIN PUBLIC KEY")) {
      return createPublicKey(text);
    }
    if (text.includes("BEGIN CERTIFICATE")) {
      return new X509Certificate(text).publicKey;
    }
    const zeilen = (text.replace(/\s+/g, "").match(/.{1,64}/g) ?? []).join("\n");
    return new X509Certificate(
      `-----BEGIN CERTIFICATE-----\n${zeilen}\n-----END CERTIFICATE-----\n`,
    ).publicKey;
  } catch {
    return undefined;
  }
}

const SAML_GRUPPEN_VORGABE = "http://schemas.microsoft.com/ws/2008/06/identity/claims/groups";

/** Die fünf Werte, ohne die SAML nicht aktiv wird. */
export const SAML_PFLICHTSATZ = [
  "SAML_IDP_ENTITY_ID",
  "SAML_IDP_SSO_URL",
  "SAML_IDP_CERT",
  "SAML_SP_ENTITY_ID",
  "SAML_ACS_URL",
] as const;

export function createSamlProviderFromEnv(
  env: Record<string, string | undefined> = process.env,
  deps: { now?: () => number; genId?: () => string } = {},
): SamlProvider | undefined {
  if (SAML_PFLICHTSATZ.some((name) => !env[name]?.trim())) {
    return undefined;
  }
  const schluessel = samlSchluesselAus(env.SAML_IDP_CERT as string);
  if (!schluessel) {
    // Der Startbericht nennt SAML_IDP_CERT als unlesbar (start-vertrag.ts) — kein stilles Aus.
    return undefined;
  }
  return createSamlProvider(
    {
      idpEntityId: (env.SAML_IDP_ENTITY_ID as string).trim(),
      idpSsoUrl: (env.SAML_IDP_SSO_URL as string).trim(),
      idpSchluessel: schluessel,
      spEntityId: (env.SAML_SP_ENTITY_ID as string).trim(),
      acsUrl: (env.SAML_ACS_URL as string).trim(),
      autoProvision: env.SAML_AUTOPROVISION === "true",
      attributEmail:
        env.SAML_ATTR_EMAIL?.trim() ||
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
      attributName:
        env.SAML_ATTR_NAME?.trim() || "http://schemas.microsoft.com/identity/claims/displayname",
      attributGruppen: env.SAML_ATTR_GROUPS?.trim() || SAML_GRUPPEN_VORGABE,
      rollen: {
        adminGroup: env.SAML_GROUP_ADMIN,
        controllerGroup: env.SAML_GROUP_CONTROLLER,
        expertGroup: env.SAML_GROUP_EXPERTE,
      },
    },
    deps,
  );
}
