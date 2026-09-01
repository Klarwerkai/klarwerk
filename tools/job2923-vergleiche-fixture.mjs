// JOB 2923 D1 — Hilfsskript: vergleicht den INHALT zweier .docx (ZIP), Eintrag für Eintrag.
// Zweck: belegen, dass die in diesem Klon NEU ERZEUGTE Metafile-Fixture inhaltlich dieselbe ist
// wie die in JOB 2912 D3 gebaute — auch wenn die ZIP-Bytes wegen der von JSZip gesetzten
// Zeitstempel abweichen und die Datei-SHA-256 deshalb NICHT gleich sein kann.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import JSZip from "jszip";

const [a, b] = process.argv.slice(2);
const ladeEintraege = async (pfad) => {
  const zip = await JSZip.loadAsync(readFileSync(pfad));
  const namen = Object.keys(zip.files)
    .filter((n) => !zip.files[n].dir)
    .sort();
  const map = new Map();
  for (const name of namen) {
    const bytes = await zip.file(name).async("nodebuffer");
    map.set(name, createHash("sha256").update(bytes).digest("hex"));
  }
  return map;
};

const links = await ladeEintraege(a);
const rechts = await ladeEintraege(b);
const namen = [...new Set([...links.keys(), ...rechts.keys()])].sort();
let abweichungen = 0;
for (const name of namen) {
  const l = links.get(name) ?? "FEHLT";
  const r = rechts.get(name) ?? "FEHLT";
  const gleich = l === r;
  if (!gleich) abweichungen += 1;
  console.log(`${gleich ? "gleich " : "ANDERS "} ${name}  ${l.slice(0, 16)}  ${r.slice(0, 16)}`);
}
console.log(abweichungen === 0 ? "INHALT IDENTISCH" : `ABWEICHUNGEN: ${abweichungen}`);
