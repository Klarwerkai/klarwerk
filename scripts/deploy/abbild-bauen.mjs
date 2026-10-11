#!/usr/bin/env node
// ==================================================================================================
// R-1487 (aufnahme:20260922:gesamt-kundenbetrieb) — DAS AUSLIEFERUNGSABBILD ENTSTEHT AUS EINEM
// BENANNTEN STAND, MIT AUSGEWIESENER PRÜFSUMME, OHNE VERÖFFENTLICHUNG.
// ==================================================================================================
//
// Bis hierher entstand das Container-Abbild, mit dem eine Kundeninstanz hochgezogen wird, nur beim
// Bau durch Coolify oder `docker compose … --build` — und hinterher wusste niemand, aus welchem Stand.
// Dieser Bauer leitet alles selbst her und schreibt es zusammen auf:
//
//   1. QUELLFASSUNG  `git rev-parse HEAD` des Repositorys, `version` aus `package.json` DIESES Commits
//                    (`git show <commit>:package.json`), nicht aus dem Arbeitsbaum.
//   2. BAUKONTEXT    `git archive` GENAU dieses Commits in ein Wegwerfverzeichnis — nicht der
//                    Arbeitsbaum. Nicht eingecheckte Änderungen können so nicht ins Abbild geraten;
//                    das Abbild IST der Commit. Ein schmutziger Arbeitsbaum wird gemeldet.
//   3. BAU           `docker build` mit `SOURCE_COMMIT=<commit>` (→ `/health.commit`, Dockerfile) und
//                    den OCI-Etiketten `org.opencontainers.image.revision`/`.version`.
//   4. ABBILD        `docker image inspect` → Abbildkennung (`sha256:…`), `docker save` → Archiv,
//                    daneben `<archiv>.sha256` im `shasum -a 256`-Format (`scripts/insel/paket-pruefsumme.mjs`).
//   5. NACHWEIS      `<name>.json`: Abbildname, Abbildkennung, Version, Commit, Archiv, Prüfsumme.
//
// KEINE VERÖFFENTLICHUNG: dieser Bauer ruft nie `docker push`, `docker login` oder `docker tag` auf
// eine Registry. Das hält `tests/kundenbetrieb-betriebsmodelle/abbild-bauen.test.ts` fest.
//
// Aufruf: node scripts/deploy/abbild-bauen.mjs [--ziel <ordner>]   (Vorgabe: dist/abbild)
// Braucht: git, tar, docker (mit Buildx/BuildKit). Exit 0 gebaut · 1 Bau gescheitert · 2 Aufruf falsch
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { schreibePaketPruefsumme } from "../insel/paket-pruefsumme.mjs";

const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

const argumente = process.argv.slice(2);
let ziel = join(repo, "dist", "abbild");
for (let i = 0; i < argumente.length; i += 1) {
  if (argumente[i] === "--ziel" && argumente[i + 1]) {
    ziel = resolve(argumente[i + 1]);
    i += 1;
  } else {
    process.stderr.write(
      `Abbildbau abgebrochen: unbekanntes Argument „${argumente[i]}". Bekannt ist nur --ziel <ordner>. Es wurde nichts gebaut.\n`,
    );
    process.exit(2);
  }
}

function lauf(befehl, args, cwd = repo) {
  return execFileSync(befehl, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

try {
  const commit = lauf("git", ["rev-parse", "HEAD"]).trim();
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`kein voller Commit: „${commit}"`);
  const schmutzig = lauf("git", ["status", "--porcelain"]).trim().length > 0;
  // Die Version kommt aus DEMSELBEN Commit wie der Baukontext (`git show <commit>:package.json`),
  // nie aus dem Arbeitsbaum: eine nicht eingecheckte Versionsänderung stünde sonst in Abbildname,
  // OCI-Etikett und Nachweis, während das Abbild die Fassung des Commits enthält.
  const version = JSON.parse(lauf("git", ["show", `${commit}:package.json`])).version;
  if (typeof version !== "string" || !version.trim()) {
    throw new Error(`package.json im Commit ${commit} nennt keine Version`);
  }
  let arbeitsbaumVersion = null;
  try {
    arbeitsbaumVersion = JSON.parse(readFileSync(join(repo, "package.json"), "utf8")).version;
  } catch {
    arbeitsbaumVersion = null;
  }
  const name = `klarwerk:${version}-${commit.slice(0, 12)}`;
  const datei = `klarwerk-${version}-${commit.slice(0, 12)}`;

  const kontext = mkdtempSync(join(tmpdir(), "klarwerk-abbild-"));
  try {
    const quellarchiv = join(kontext, "quelle.tar");
    lauf("git", ["archive", "--format=tar", "-o", quellarchiv, commit]);
    const baum = join(kontext, "baum");
    mkdirSync(baum);
    lauf("tar", ["-xf", quellarchiv, "-C", baum]);

    lauf("docker", [
      "build",
      "--build-arg",
      `SOURCE_COMMIT=${commit}`,
      "--label",
      `org.opencontainers.image.revision=${commit}`,
      "--label",
      `org.opencontainers.image.version=${version}`,
      "-t",
      name,
      baum,
    ]);
  } finally {
    rmSync(kontext, { recursive: true, force: true });
  }

  const abbildKennung = lauf("docker", ["image", "inspect", "--format", "{{.Id}}", name]).trim();
  if (!/^sha256:[0-9a-f]{64}$/.test(abbildKennung)) {
    throw new Error(`docker meldet keine Abbildkennung: „${abbildKennung}"`);
  }

  mkdirSync(ziel, { recursive: true });
  const archiv = join(ziel, `${datei}.tar`);
  rmSync(archiv, { force: true });
  rmSync(`${archiv}.sha256`, { force: true });
  lauf("docker", ["save", "-o", archiv, name]);
  const pruefsumme = schreibePaketPruefsumme(archiv);

  const nachweis = {
    abbild: name,
    abbildKennung,
    version,
    commit,
    arbeitsbaumSauber: !schmutzig,
    versionQuelle: "package.json im Commit",
    arbeitsbaumVersion,
    baukontext: "git archive des Commits",
    archiv: basename(archiv),
    sha256: pruefsumme.sha256,
    sha256Datei: basename(pruefsumme.datei),
    gebautAm: new Date().toISOString(),
    veroeffentlicht: false,
  };
  const nachweisDatei = join(ziel, `${datei}.json`);
  writeFileSync(nachweisDatei, `${JSON.stringify(nachweis, null, 2)}\n`, "utf8");
  if (schmutzig) {
    process.stderr.write(
      "Hinweis: der Arbeitsbaum hat nicht eingecheckte Änderungen. Sie sind NICHT im Abbild — gebaut wurde genau der Commit.\n",
    );
  }
  if (arbeitsbaumVersion !== null && arbeitsbaumVersion !== version) {
    process.stderr.write(
      `Hinweis: package.json im Arbeitsbaum nennt ${arbeitsbaumVersion}, der Commit ${version}. Abbild und Nachweis tragen ${version} — die Fassung, die wirklich gebaut wurde.\n`,
    );
  }
  process.stdout.write(
    `${JSON.stringify({ ...nachweis, nachweisDatei: relative(repo, nachweisDatei) }, null, 2)}\n`,
  );
} catch (fehler) {
  process.stderr.write(
    `Abbildbau gescheitert: ${fehler instanceof Error ? fehler.message : String(fehler)}\n`,
  );
  process.exit(1);
}
