// ==================================================================================================
// DIE KUNDENINSTALLATION SELBST — so, wie sie in docs/operations/kundeninstanz-neuinstallation.md steht.
// ==================================================================================================
//
// Ein Installationsordner aus genau dem gepruefter Commit (`git archive`), eine `.env` daneben,
// `docker compose -f docker-compose.prod.yml up -d --build`. Der einzige Zusatz zur Anleitung ist
// der eindeutige Projektname (`-p`), damit auf dem Pruefplatz nichts mit einem fremden Bestand
// zusammenfallen kann.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Containerstand, Dienstmessung } from "./nachweise";
import { type Ergebnis, fuehreAus, mussGelingen, warte } from "./pruefplatz";

export interface Instanz {
  docker: string[];
  projekt: string;
  ordner: string;
}

export function compose(
  i: Instanz,
  args: string[],
  zeitMs = 600_000,
  spiegel?: string,
): Promise<Ergebnis> {
  return fuehreAus(
    [...i.docker, "compose", "-p", i.projekt, "-f", "docker-compose.prod.yml", ...args],
    {
      cwd: i.ordner,
      zeitMs,
      ...(spiegel ? { spiegel } : {}),
    },
  );
}

/** Legt den Installationsordner aus dem gepruefter Commit an — ohne Arbeitsbaum-Reste, ohne node_modules. */
export async function installationsordner(
  wurzel: string,
  commit: string,
  ziel: string,
): Promise<void> {
  mkdirSync(ziel, { recursive: true });
  await mussGelingen(
    [
      "sh",
      "-c",
      `git -C "$1" archive --format=tar "$2" | tar -x -C "$3"`,
      "sh",
      wurzel,
      commit,
      ziel,
    ],
    "git archive",
  );
}

/**
 * Der Codeblock, der in der Anleitung unmittelbar auf `<!-- marke -->` folgt — woertlich. So faehrt
 * die Strecke genau das, was dort steht, statt eine zweite Fassung davon zu pflegen.
 */
export function dokumentierterBlock(anleitung: string, marke: string): string {
  const ab = anleitung.indexOf(`<!-- ${marke} -->`);
  const block = /```[a-z]*\n([\s\S]*?)\n```/.exec(anleitung.slice(ab));
  if (ab < 0 || !block?.[1]) {
    throw new Error(`Die Anleitung traegt keinen Codeblock hinter <!-- ${marke} -->.`);
  }
  return `${block[1]}\n`;
}

export function schreibeEnv(ordner: string, werte: Record<string, string>): void {
  const text = Object.entries(werte)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(join(ordner, ".env"), `${text}\n`, { mode: 0o600 });
}

/** Alles, was dieses Projekt auf dem Docker-Wirt besitzt — ueber die Compose-Projektkennzeichnung. */
export async function projektbestand(
  i: Instanz,
): Promise<{ container: string[]; volumes: string[]; netze: string[]; abbild: boolean }> {
  const filter = `label=com.docker.compose.project=${i.projekt}`;
  const liste = async (args: string[]): Promise<string[]> =>
    (await mussGelingen([...i.docker, ...args, "--filter", filter, "-q"], "Projektbestand"))
      .split("\n")
      .filter(Boolean);
  const abbild = await fuehreAus([...i.docker, "image", "inspect", `${i.projekt}-app`]);
  return {
    container: await liste(["ps", "-a"]),
    volumes: await liste(["volume", "ls"]),
    netze: await liste(["network", "ls"]),
    abbild: abbild.code === 0,
  };
}

export async function containerId(i: Instanz, dienst: "app" | "db"): Promise<string> {
  const id = (await compose(i, ["ps", "-a", "-q", dienst], 60_000)).stdout.trim();
  if (!id) {
    throw new Error(`kein Container fuer den Dienst ${dienst} im Projekt ${i.projekt}`);
  }
  return id;
}

export async function containerstand(i: Instanz, id: string): Promise<Containerstand> {
  const aus = await mussGelingen(
    [
      ...i.docker,
      "inspect",
      "--format",
      "{{.Id}}|{{.State.Status}}|{{.State.StartedAt}}|{{.State.Pid}}",
      id,
    ],
    "docker inspect",
  );
  const [voll = "", status = "", startedAt = "", pid = "0"] = aus.trim().split("|");
  return { id: voll, status, startedAt, pid: Number(pid) };
}

export async function pgStartzeit(i: Instanz): Promise<string> {
  const r = await compose(
    i,
    [
      "exec",
      "-T",
      "db",
      "psql",
      "-U",
      "klarwerk",
      "-d",
      "klarwerk_prod",
      "-Atc",
      "select pg_postmaster_start_time()",
    ],
    60_000,
  );
  if (r.code !== 0) {
    throw new Error(`pg_postmaster_start_time nicht lesbar: ${r.stderr.slice(-500)}`);
  }
  return r.stdout.trim();
}

export async function volumestand(i: Instanz): Promise<{ name: string; createdAt: string }> {
  const name = `${i.projekt}_pgdata`;
  const aus = await mussGelingen(
    [...i.docker, "volume", "inspect", "--format", "{{.Name}}|{{.CreatedAt}}", name],
    "docker volume inspect",
  );
  const [n = "", createdAt = ""] = aus.trim().split("|");
  return { name: n, createdAt };
}

export async function dienstmessung(i: Instanz): Promise<Dienstmessung> {
  return {
    app: await containerstand(i, await containerId(i, "app")),
    db: await containerstand(i, await containerId(i, "db")),
    pgStart: await pgStartzeit(i),
    volume: await volumestand(i),
  };
}

/** Wartet, bis der Healthcheck des Abbilds den Anwendungscontainer `healthy` meldet. */
export async function warteAufGesund(i: Instanz, fristMs = 300_000): Promise<void> {
  const id = await containerId(i, "app");
  const ende = Date.now() + fristMs;
  let zuletzt = "";
  while (Date.now() < ende) {
    const r = await fuehreAus([
      ...i.docker,
      "inspect",
      "--format",
      "{{.State.Status}}|{{.State.Health.Status}}",
      id,
    ]);
    zuletzt = r.stdout.trim();
    if (zuletzt === "running|healthy") {
      return;
    }
    if (zuletzt.startsWith("exited") || zuletzt.startsWith("dead")) {
      break;
    }
    await warte(2_000);
  }
  const protokoll = await compose(i, ["logs", "--no-color", "--tail", "80", "app"], 60_000);
  throw new Error(
    `Anwendung wurde nicht gesund (${zuletzt}).\n${protokoll.stdout}${protokoll.stderr}`,
  );
}
