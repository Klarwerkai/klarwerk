// Ein selbstsigniertes X.509-v3-Zertifikat (ECDSA P-256, SHA-256) zur Laufzeit, nur mit `node:crypto`.
//
// WARUM SELBST GEBAUT: Das Repository hat weder eine Zertifikatsbibliothek noch Testschlüssel, und
// ein eingecheckter privater Schlüssel wäre genau das, was NFR-SEC-05 („kein Secret im Repo")
// ausschliesst — auch wenn er nur ein Testschlüssel ist. Node kann Schlüssel erzeugen und signieren,
// aber kein Zertifikat ausstellen; die DER-Struktur unten ist deshalb von Hand (RFC 5280, nur die
// Felder, die ein TLS-Server-Zertifikat braucht). `pruefeSelbst` gleicht das Ergebnis gegen Nodes
// eigenen X.509-Leser ab, bevor ein Test es benutzt.
import { X509Certificate, generateKeyPairSync, randomBytes, sign } from "node:crypto";

function laenge(n: number): Buffer {
  if (n < 0x80) {
    return Buffer.from([n]);
  }
  const bytes: number[] = [];
  for (let rest = n; rest > 0; rest = Math.floor(rest / 256)) {
    bytes.unshift(rest % 256);
  }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function tlv(tag: number, inhalt: Buffer): Buffer {
  return Buffer.concat([Buffer.from([tag]), laenge(inhalt.length), inhalt]);
}

const folge = (...teile: Buffer[]): Buffer => tlv(0x30, Buffer.concat(teile));
const menge = (...teile: Buffer[]): Buffer => tlv(0x31, Buffer.concat(teile));
const oktette = (inhalt: Buffer): Buffer => tlv(0x04, inhalt);
const WAHR = Buffer.from([0x01, 0x01, 0xff]);

function oid(text: string): Buffer {
  const z = text.split(".").map(Number);
  const bytes: number[] = [40 * (z[0] ?? 0) + (z[1] ?? 0)];
  for (const n of z.slice(2)) {
    const teil = [n % 128];
    for (let rest = Math.floor(n / 128); rest > 0; rest = Math.floor(rest / 128)) {
      teil.unshift((rest % 128) | 0x80);
    }
    bytes.push(...teil);
  }
  return tlv(0x06, Buffer.from(bytes));
}

function utcZeit(d: Date): Buffer {
  const iso = d.toISOString();
  const t = `${iso.slice(2, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(11, 13)}${iso.slice(14, 16)}${iso.slice(17, 19)}Z`;
  return tlv(0x17, Buffer.from(t, "ascii"));
}

const name = (cn: string): Buffer =>
  folge(menge(folge(oid("2.5.4.3"), tlv(0x0c, Buffer.from(cn, "utf8")))));

function erweiterung(kennung: string, kritisch: boolean, wert: Buffer): Buffer {
  return kritisch ? folge(oid(kennung), WAHR, oktette(wert)) : folge(oid(kennung), oktette(wert));
}

const ECDSA_SHA256 = folge(oid("1.2.840.10045.4.3.2"));

function pem(art: string, der: Buffer): string {
  const zeilen = der.toString("base64").match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${art}-----\n${zeilen.join("\n")}\n-----END ${art}-----\n`;
}

export interface Testzertifikat {
  cert: string;
  key: string;
}

/** Selbstsigniert, CA und Server zugleich, gültig für `dnsName` und 127.0.0.1, eine Stunde lang. */
export function testzertifikat(dnsName: string): Testzertifikat {
  const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const spki = publicKey.export({ type: "spki", format: "der" });

  // Positiv und minimal kodiert: erstes Byte 0x01–0x7f.
  const seriennummer = randomBytes(8);
  seriennummer[0] = ((seriennummer[0] ?? 1) & 0x7f) | 0x01;

  const jetzt = Date.now();
  const tbs = folge(
    tlv(0xa0, tlv(0x02, Buffer.from([0x02]))),
    tlv(0x02, seriennummer),
    ECDSA_SHA256,
    name(dnsName),
    folge(utcZeit(new Date(jetzt - 60_000)), utcZeit(new Date(jetzt + 3_600_000))),
    name(dnsName),
    spki,
    tlv(
      0xa3,
      folge(
        // basicConstraints: cA = TRUE (es ist zugleich der Vertrauensanker des Tests).
        erweiterung("2.5.29.19", true, folge(WAHR)),
        // keyUsage: digitalSignature (0x80) + keyCertSign (0x04); zwei ungenutzte Bits.
        erweiterung("2.5.29.15", true, Buffer.from([0x03, 0x02, 0x02, 0x84])),
        // subjectAltName: dNSName und iPAddress 127.0.0.1.
        erweiterung(
          "2.5.29.17",
          false,
          folge(tlv(0x82, Buffer.from(dnsName, "ascii")), tlv(0x87, Buffer.from([127, 0, 0, 1]))),
        ),
      ),
    ),
  );
  const signatur = sign("sha256", tbs, privateKey);
  const der = folge(tbs, ECDSA_SHA256, tlv(0x03, Buffer.concat([Buffer.from([0x00]), signatur])));
  return {
    cert: pem("CERTIFICATE", der),
    key: String(privateKey.export({ type: "pkcs8", format: "pem" })),
  };
}

/** Kalibrierung: Node liest das Zertifikat und bestätigt Selbstsignatur und Namen. */
export function pruefeSelbst(z: Testzertifikat, dnsName: string): X509Certificate {
  const x = new X509Certificate(z.cert);
  if (
    !x.verify(x.publicKey) ||
    x.checkHost(dnsName) !== dnsName ||
    x.checkIP("127.0.0.1") === undefined
  ) {
    throw new Error("Testzertifikat ist nicht wohlgeformt");
  }
  return x;
}
