// ================================================================================================
// FE-002 · DIE PRÜFUMGEBUNG FÜR DIE MENSCHLICHE VERSTÄNDLICHKEITSPROBE (E7).
// ================================================================================================
//
// Stellt die Kandidatenfassung auf einem Rechner bereit, auf dem der Kandidatencommit ausgecheckt
// und gebaut ist (`npm ci`, `npm ci --prefix apps/web`, `./tools/build` → `apps/web/dist`; die
// Oberfläche hat eigene Abhängigkeiten, ohne den zweiten Schritt scheitert der Build), und legt den
// Testbestand an, den die Probe braucht:
//   · einen Administrator und eine Expertin (niedrigere Rolle) — Kennwörter werden bei JEDEM Start
//     zufällig erzeugt und nur am kontrollierenden Terminal (`/dev/tty`) ausgegeben, nicht auf
//     `stdout`/`stderr` (R-1144, s. `meldePruefumgebung`); im Repository steht kein Zugang
//   · zwei ECHTE ungelesene Meldungen: zwei Fragen, auf die der leere Bestand keine Antwort hat,
//     werden über die normale Frage-Route gestellt; daraus entstehen offene Wissenslücken, die
//     `/api/notifications` als Meldungen liefert (keine erfundenen Meldungen)
//   · wahlweise die Firmen-CI (`--firmen-ci`) über den echten Adminweg
//
// Aufruf:   npx tsx scripts/fe002-pruefumgebung.ts [--port 4702] [--host 127.0.0.1] [--firmen-ci]
// Danach die ausgegebene Adresse im Browser öffnen und mit einem der ausgegebenen Zugänge anmelden.
// Der Datenbestand liegt nur im Arbeitsspeicher dieses Prozesses; Strg+C beendet und verwirft ihn.
//
// Geprüft: tests/fe002-kopfband/pruefumgebung.test.ts startet genau diese Funktion.
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { join, resolve } from "node:path";
import { buildApp, buildServices } from "../services/app/src/build-app";
import { TERMINAL, amTerminalUebergeben } from "../services/app/src/kennwort-uebergabe";
import { registerWebStatic } from "../services/app/src/web-static";

export interface Zugang {
  rolle: "admin" | "experte";
  email: string;
  passwort: string;
}

export interface Pruefumgebung {
  adresse: string;
  zugaenge: Zugang[];
  ungeleseneMeldungen: number;
  schliessen: () => Promise<void>;
}

const FRAGEN = ["Wie beantrage ich Sonderurlaub?", "Wer genehmigt Dienstreisen ins Ausland?"];

function kennwort(): string {
  return randomBytes(12).toString("base64url");
}

export async function stellePruefumgebungBereit(
  opts: { port?: number; host?: string; firmenCi?: boolean; wurzel?: string } = {},
): Promise<Pruefumgebung> {
  const dist = join(resolve(opts.wurzel ?? process.cwd()), "apps/web/dist");
  if (!existsSync(join(dist, "index.html"))) {
    throw new Error(`apps/web/dist fehlt (${dist}) — vorher den Kandidaten bauen (./tools/build).`);
  }
  const app = buildApp(buildServices());
  await registerWebStatic(app, dist);
  await app.ready();

  const admin: Zugang = { rolle: "admin", email: "admin@fe002-probe.test", passwort: kennwort() };
  const experte: Zugang = {
    rolle: "experte",
    email: "expertin@fe002-probe.test",
    passwort: kennwort(),
  };
  const pruefe = (was: string, status: number, erwartet: number, rumpf: string): void => {
    if (status !== erwartet) {
      throw new Error(`${was}: HTTP ${status} (erwartet ${erwartet}) — ${rumpf.slice(0, 200)}`);
    }
  };

  const setup = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { name: "Probe Admin", email: admin.email, password: admin.passwort },
  });
  pruefe("Ersteinrichtung", setup.statusCode, 201, setup.body);
  const kopf = { authorization: `Bearer ${(setup.json() as { token: string }).token}` };

  const anlage = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: kopf,
    payload: { name: "Probe Expertin", email: experte.email, password: experte.passwort, role: "experte" },
  });
  pruefe("Expertin anlegen", anlage.statusCode, 201, anlage.body);

  for (const frage of FRAGEN) {
    const antwort = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: kopf,
      payload: { question: frage, locale: "de" },
    });
    pruefe(`Frage „${frage}"`, antwort.statusCode, 200, antwort.body);
  }
  if (opts.firmenCi) {
    const ci = await app.inject({
      method: "PUT",
      url: "/api/admin/branding",
      headers: kopf,
      payload: { profil: "advisor", aktiv: true },
    });
    pruefe("Firmen-CI", ci.statusCode, 200, ci.body);
  }
  const meldungen = await app.inject({ method: "GET", url: "/api/notifications", headers: kopf });
  pruefe("Meldungen", meldungen.statusCode, 200, meldungen.body);
  const ungelesen = (meldungen.json() as Array<{ seen: boolean }>).filter((m) => !m.seen).length;

  await app.listen({ port: opts.port ?? 4702, host: opts.host ?? "127.0.0.1" });
  const adresse = app.server.address() as AddressInfo;
  const host = adresse.address === "0.0.0.0" ? "127.0.0.1" : adresse.address;
  return {
    adresse: `http://${host}:${adresse.port}`,
    zugaenge: [admin, experte],
    ungeleseneMeldungen: ungelesen,
    schliessen: () => app.close(),
  };
}

function wert(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

// ================================================================================================
// R-1144 — DIE ZUGÄNGE GEHEN AUF DAS KONTROLLIERENDE TERMINAL, NICHT AUF `stdout`.
// ================================================================================================
//
// Bis hierher standen die frisch erzeugten Kennwörter der beiden neu angelegten Konten mit
// `process.stdout.write` in der Ausgabe — dem Kanal, den `> log.txt`, `| tee` und jeder
// automatische Lauf mitschreiben. Derselbe Befund wie in `seed.ts` vor mega65, nur in einem
// zweiten Anlegebefehl. Deshalb hier derselbe Helfer (`kennwort-uebergabe.ts`) mit seiner Schleife
// über den Byte-Offset; Adresse und Kennzahlen bleiben auf `stdout`, sie sind kein Geheimnis.
//
// Gelingt die Übergabe nicht (kein Terminal oder nicht vollständig angenommen), gibt es KEINEN
// Rückfall auf einen anderen Kanal. Anders als beim Demo-Seed gibt es hier keinen Adminweg
// zurück — der einzige Administrator ist eines der nicht übergebenen Konten, und der Bestand lebt
// nur in diesem Prozess. Eine Prüfumgebung ohne Zugang ist nutzlos; sie wird deshalb beendet und
// der Lauf endet mit Fehlercode.

/**
 * Meldet die bereitgestellte Prüfumgebung: Adresse und Kennzahlen auf `stdout`, die Zugänge
 * ausschließlich über das kontrollierende Terminal.
 *
 * @returns `true`, wenn die Zugangsliste vollständig am Terminal angenommen wurde.
 */
export function meldePruefumgebung(u: Pruefumgebung): boolean {
  process.stdout.write(
    [
      "FE-002 Prüfumgebung steht (Datenbestand nur im Arbeitsspeicher; Strg+C beendet).",
      `Adresse:  ${u.adresse}/start`,
      `Ungelesene Meldungen des Administrators: ${u.ungeleseneMeldungen}`,
      "",
    ].join("\n"),
  );
  const uebergeben = amTerminalUebergeben([
    ...u.zugaenge.map((z) => `Zugang ${z.rolle.padEnd(8)} ${z.email}  Kennwort: ${z.passwort}`),
    "",
  ]);
  if (!uebergeben) {
    const meldung = [
      `FE-002 Prüfumgebung: Die Übergabe der Zugänge am kontrollierenden Terminal (${TERMINAL})`,
      "hat NICHT stattgefunden: entweder gibt es keines — typisch für CI, Container und",
      "Pipelines — oder der Kanal hat den Text nicht vollständig angenommen. Die Kennwörter werden",
      "hier NICHT nachgereicht, sie würden sonst in einem Protokoll landen; ein abgeschnittener",
      "Anfang am Terminal ist nicht zu verwenden. Ohne Zugang ist die Prüfumgebung nutzlos und wird",
      "beendet. Für die Übergabe: den Befehl in einem Terminal starten.",
    ].join(" ");
    process.stderr.write(`${meldung}\n`);
  }
  return uebergeben;
}

if (process.argv[1]?.endsWith("fe002-pruefumgebung.ts")) {
  stellePruefumgebungBereit({
    port: Number(wert("--port") ?? "4702"),
    host: wert("--host") ?? "127.0.0.1",
    firmenCi: process.argv.includes("--firmen-ci"),
  })
    .then(async (u) => {
      if (!meldePruefumgebung(u)) {
        await u.schliessen();
        process.exitCode = 1;
      }
    })
    .catch((e: unknown) => {
      process.stderr.write(`FE-002 Prüfumgebung: ${String(e)}\n`);
      process.exit(1);
    });
}
