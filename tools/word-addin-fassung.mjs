import assert from "node:assert/strict";

const ASSETS = "apps/web/public/word-addin/";
const STATIC = "services/app/src/web-static.ts";
const MANIFEST = "docs/word-addin/klara-manifest.xml";
const meldung = "Word-Add-in: Assetänderung erfordert eine konsistent erhöhte Fassung";

function einzig(text, muster) {
  const treffer = [...text.matchAll(muster)];
  assert.equal(treffer.length, 1, meldung);
  return treffer[0][1];
}

function teile(wert) {
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(wert), meldung);
  return wert.split(".").map((teil) => BigInt(teil));
}

function fassungen(root, stand, git) {
  const server = git(root, "show", `${stand}:${STATIC}`);
  const manifest = git(root, "show", `${stand}:${MANIFEST}`);
  const konstante = einzig(
    server,
    /^\s*export\s+const\s+KLARA_TASKPANE_FASSUNG\s*=\s*["']([^"']+)["']/gm,
  );
  const version = einzig(manifest, /<Version>\s*([^<]+?)\s*<\/Version>/g);
  const adresse = einzig(manifest, /<SourceLocation\b[^>]*\bDefaultValue\s*=\s*["']([^"']+)["']/g);
  const query = new URL(adresse.replaceAll("&amp;", "&")).searchParams.getAll("v");
  assert.equal(query.length, 1, meldung);
  const werte = [konstante, version, query[0]];
  for (const wert of werte) teile(wert);
  return werte;
}

/** Liest beide echten Git-Stände; keine behaupteten ChangedPaths oder aktuellen Zahlen als Basis. */
export function assertWordAddinFassung(root, base, commit, git) {
  const beruehrt = git(
    root,
    "diff",
    "--name-only",
    "--no-renames",
    "-z",
    base,
    commit,
    "--",
    ASSETS,
  )
    .split("\0")
    .filter(Boolean);
  if (beruehrt.length === 0) return;

  const vorher = fassungen(root, base, git);
  const nachher = fassungen(root, commit, git);
  assert(
    nachher.every((wert) => wert === nachher[0]),
    meldung,
  );
  const neu = teile(nachher[0]);
  for (const alt of vorher) {
    const basis = teile(alt);
    const stelle = neu.findIndex((wert, i) => wert !== basis[i]);
    assert(stelle >= 0 && neu[stelle] > basis[stelle], meldung);
  }
}
