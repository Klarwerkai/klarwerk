// ================================================================================================
// P-WIKI-STELLENBEZUG — DER FINGERABDRUCK EINER STELLE (SHA-256, synchron, ohne Abhängigkeit).
// ================================================================================================
//
// WARUM ÜBERHAUPT: die gespeicherte Textstelle ist auf `STELLE_TEXT_MAX` Zeichen gekürzt und taugt
// deshalb nur zur ANZEIGE. Die IDENTITÄT einer Stelle ist der vollständige normalisierte Inhalt
// samt Art und vollständigem Abschnitt — sonst gälte ein anderer Absatz mit demselben Anfang als
// „eindeutig wiedergefunden" (BEN, Nacharbeit 3). Gespeichert wird davon der Abdruck.
//
// WARUM SELBST GERECHNET: `crypto.subtle.digest` ist asynchron, die Zuordnung läuft im Rendern.
// Der Dienst rechnet mit demselben Verfahren (`services/knowledge-object/src/stellen-fingerabdruck.ts`);
// `tests/wiki-stellenbezug/zuordnung.test.tsx` hält beide gegen `node:crypto`.

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
];

const rotr = (x: number, n: number): number => (x >>> n) | (x << (32 - n));

/** UTF-8 wie `TextEncoder`: ein einzelnes Surrogat wird zu U+FFFD. */
function utf8(text: string): number[] {
  const bytes: number[] = [];
  for (const zeichen of text) {
    let cp = zeichen.codePointAt(0) ?? 0;
    if (cp >= 0xd800 && cp <= 0xdfff) {
      cp = 0xfffd;
    }
    if (cp < 0x80) {
      bytes.push(cp);
    } else if (cp < 0x800) {
      bytes.push(0xc0 | (cp >> 6), 0x80 | (cp & 63));
    } else if (cp < 0x10000) {
      bytes.push(0xe0 | (cp >> 12), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
    } else {
      bytes.push(
        0xf0 | (cp >> 18),
        0x80 | ((cp >> 12) & 63),
        0x80 | ((cp >> 6) & 63),
        0x80 | (cp & 63),
      );
    }
  }
  return bytes;
}

/** SHA-256 eines Textes (UTF-8) als Kleinbuchstaben-Hex. */
export function sha256Hex(text: string): string {
  const bytes = utf8(text);
  const bitLaenge = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) {
    bytes.push(0);
  }
  const hoch = Math.floor(bitLaenge / 0x100000000);
  const tief = bitLaenge >>> 0;
  for (const wort of [hoch, tief]) {
    bytes.push((wort >>> 24) & 255, (wort >>> 16) & 255, (wort >>> 8) & 255, wort & 255);
  }
  const h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const w = new Array<number>(64).fill(0);
  const an = (liste: readonly number[], i: number): number => liste[i] ?? 0;
  for (let block = 0; block < bytes.length; block += 64) {
    for (let t = 0; t < 16; t++) {
      const i = block + 4 * t;
      const oben = (an(bytes, i) << 24) | (an(bytes, i + 1) << 16);
      w[t] = oben | (an(bytes, i + 2) << 8) | an(bytes, i + 3);
    }
    for (let t = 16; t < 64; t++) {
      const x = an(w, t - 15);
      const y = an(w, t - 2);
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = (an(w, t - 16) + s0 + an(w, t - 7) + s1) | 0;
    }
    let a = an(h, 0);
    let b = an(h, 1);
    let c = an(h, 2);
    let d = an(h, 3);
    let e = an(h, 4);
    let f = an(h, 5);
    let g = an(h, 6);
    let k = an(h, 7);
    for (let t = 0; t < 64; t++) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (k + s1 + ch + an(K, t) + an(w, t)) | 0;
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (s0 + maj) | 0;
      k = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    const neu = [a, b, c, d, e, f, g, k];
    for (let i = 0; i < 8; i++) {
      h[i] = (an(h, i) + an(neu, i)) | 0;
    }
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

/**
 * Der Abdruck einer Stelle: Art, VOLLSTÄNDIGER Abschnitt und VOLLSTÄNDIGER normalisierter Inhalt
 * (beim Bild seine Kennung). Das Trennzeichen U+0000 kommt in normalisiertem Text nicht vor.
 */
export function stellenFingerabdruck(
  art: string,
  abschnittVoll: string,
  inhaltVoll: string,
): string {
  return `sha256:${sha256Hex(`${art}\u0000${abschnittVoll}\u0000${inhaltVoll}`)}`;
}
