#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repo = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const version = "klarwerk-insel-2026-07-09-current-01";
const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repo, encoding: "utf8" }).trim();
const shortCommit = commit.slice(0, 8);
const builtAt = new Date().toISOString();
const outDir = join(repo, "dist", "insel");
const stagingRoot = join(outDir, "staging");
const releaseDir = join(stagingRoot, version);
const zipPath = join(outDir, `${version}.zip`);
const marker = `KW-MAC-ISLAND-03 - ${version} - ${shortCommit}`;

const skipNames = new Set(["node_modules", ".git", ".localdb", "dist", ".DS_Store"]);
const skipSuffixes = [".test.ts", ".test.tsx", ".spec.ts", ".spec.tsx", ".log"];

function run(command, args, cwd = repo) {
  execFileSync(command, args, { cwd, stdio: "inherit" });
}

function copyFiltered(src, dest) {
  const name = basename(src);
  if (skipNames.has(name)) return;
  if (skipSuffixes.some((suffix) => name.endsWith(suffix))) return;
  const stats = statSync(src);
  if (stats.isDirectory()) {
    mkdirSync(dest, { recursive: true });
    for (const child of readdirSync(src)) {
      copyFiltered(join(src, child), join(dest, child));
    }
    return;
  }
  cpSync(src, dest);
}

function writeExecutable(path, body) {
  writeFileSync(path, body, { encoding: "utf8", mode: 0o755 });
}

rmSync(stagingRoot, { recursive: true, force: true });
rmSync(zipPath, { force: true });
mkdirSync(releaseDir, { recursive: true });

for (const file of ["package.json", "package-lock.json"]) {
  cpSync(join(repo, file), join(releaseDir, file));
}
copyFiltered(join(repo, "services"), join(releaseDir, "services"));
mkdirSync(join(releaseDir, "apps", "web"), { recursive: true });
cpSync(join(repo, "apps", "web", "dist"), join(releaseDir, "apps", "web", "dist"), {
  recursive: true,
});

const serverPath = join(releaseDir, "services", "app", "src", "server.ts");
let serverTs = readFileSync(serverPath, "utf8");
serverTs = serverTs.replace(
  "defaultSrc: [\"'self'\"],",
  "defaultSrc: [\"'self'\"],\n        upgradeInsecureRequests: null,",
);
serverTs = serverTs.replace(
  "hsts: { maxAge: 31_536_000, includeSubDomains: true, preload: true },",
  "hsts: false,",
);
writeFileSync(serverPath, serverTs);

const indexPath = join(releaseDir, "apps", "web", "dist", "index.html");
if (!existsSync(indexPath)) {
  throw new Error("apps/web/dist/index.html fehlt nach dem Web-Build.");
}
const markerHtml = `<div id="klarwerk-island-marker" style="position:fixed;right:10px;bottom:10px;z-index:2147483647;padding:5px 8px;border:1px solid #9ca3af;border-radius:6px;background:#111827;color:#f9fafb;font:12px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;box-shadow:0 4px 14px rgba(0,0,0,.22)">${marker}</div>`;
let indexHtml = readFileSync(indexPath, "utf8");
indexHtml = indexHtml.includes("</body>")
  ? indexHtml.replace("</body>", `${markerHtml}\n</body>`)
  : `${indexHtml}\n${markerHtml}\n`;
writeFileSync(indexPath, indexHtml);

writeFileSync(
  join(releaseDir, "BUILD_INFO"),
  [
    `version=${version}`,
    `built_at=${builtAt}`,
    `commit=${commit}`,
    `source=${repo}`,
    `ui_marker=${marker}`,
    "web_build=apps/web/dist",
    "service_entry=services/app/src/server.ts",
    "port=3002",
    "llm_url=http://127.0.0.1:11434/v1",
    "llm_model=mistral:latest",
    "llm_key=",
    "",
  ].join("\n"),
);

writeExecutable(
  join(releaseDir, "start.command"),
  `#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SHARED_ROOT="\${KLARWERK_SHARED_ROOT:-/Users/Shared/Klarwerk_Insel}"
PORT="\${PORT:-3002}"
STATE_FILE="\${KLARWERK_DEV_PERSIST_FILE:-$SHARED_ROOT/data/state.jsonl}"

mkdir -p "$SHARED_ROOT/data" "$SHARED_ROOT/logs"
if [ ! -f "$STATE_FILE" ]; then
  : > "$STATE_FILE"
fi

export PORT
export NODE_ENV=production
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
unset DATABASE_URL
export KLARWERK_DEV_PERSIST=1
export KLARWERK_DEV_PERSIST_FILE="$STATE_FILE"
export KLARWERK_LOCAL_LLM_URL="\${KLARWERK_LOCAL_LLM_URL:-http://127.0.0.1:11434/v1}"
export KLARWERK_LOCAL_LLM_MODEL="\${KLARWERK_LOCAL_LLM_MODEL:-mistral:latest}"
export KLARWERK_LOCAL_LLM_KEY="\${KLARWERK_LOCAL_LLM_KEY:-}"

cd "$ROOT"
NODE_BIN="\${NODE_BIN:-$(command -v node || true)}"
if [ -z "$NODE_BIN" ]; then
  echo "node not found; expected Homebrew Node under /opt/homebrew/bin/node" >&2
  exit 1
fi
exec "$NODE_BIN" "$ROOT/node_modules/tsx/dist/cli.mjs" "$ROOT/services/app/src/server.ts"
`,
);

writeExecutable(
  join(releaseDir, "install.command"),
  `#!/bin/bash
set -euo pipefail

VERSION="${version}"
SHARED_ROOT="/Users/Shared/Klarwerk_Insel"
RELEASES="$SHARED_ROOT/releases"
TARGET="$RELEASES/$VERSION"
CURRENT="$SHARED_ROOT/current"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$SHARED_ROOT/backups/$STAMP"
SOURCE="$(cd "$(dirname "$0")" && pwd)"
PID_FILE="$SHARED_ROOT/logs/server-3002.pid"
LOG_FILE="$SHARED_ROOT/logs/server-3002.log"
STATE_FILE="$SHARED_ROOT/data/state.jsonl"

echo "AUF MAC STUDIO: install $VERSION"
mkdir -p "$RELEASES" "$SHARED_ROOT/backups" "$SHARED_ROOT/logs"
if [ ! -f "$STATE_FILE" ]; then
  echo "AUF MAC STUDIO: STOPP - $STATE_FILE fehlt; Daten-Invariante nicht blind erzeugt." >&2
  exit 1
fi
mkdir -p "$BACKUP_DIR"
cp "$STATE_FILE" "$BACKUP_DIR/state.jsonl"
echo "AUF MAC STUDIO: backup $BACKUP_DIR/state.jsonl"

rm -rf "$TARGET"
mkdir -p "$TARGET"
tar -C "$SOURCE" --exclude "./install.command" -cf - . | tar -C "$TARGET" -xf -
echo "AUF MAC STUDIO: release entpackt $TARGET"

PREVIOUS=""
if [ -L "$CURRENT" ]; then
  PREVIOUS="$(readlink "$CURRENT" || true)"
fi
ln -sfn "$TARGET" "$CURRENT"
echo "AUF MAC STUDIO: current -> $(readlink "$CURRENT")"

if [ -f "$PID_FILE" ]; then
  OLD_PID="$(cat "$PID_FILE" 2>/dev/null || true)"
  if [ -n "$OLD_PID" ] && kill -0 "$OLD_PID" >/dev/null 2>&1; then
    kill "$OLD_PID" || true
    for _ in $(seq 1 20); do
      kill -0 "$OLD_PID" >/dev/null 2>&1 || break
      sleep 0.5
    done
  fi
fi
if lsof -ti tcp:3002 >/dev/null 2>&1; then
  lsof -ti tcp:3002 | xargs kill || true
  sleep 1
fi

nohup "$CURRENT/start.command" >"$LOG_FILE" 2>&1 &
NEW_PID="$!"
echo "$NEW_PID" > "$PID_FILE"
echo "AUF MAC STUDIO: server pid $NEW_PID log $LOG_FILE"

for _ in $(seq 1 60); do
  if curl -fsS -m 2 "http://127.0.0.1:3002/health" >/dev/null 2>&1; then
    echo "AUF MAC STUDIO: health ok"
    curl -sI "http://127.0.0.1:3002/" | sed -n '1,8p'
    exit 0
  fi
  sleep 1
done

echo "AUF MAC STUDIO: healthcheck fehlgeschlagen; previous=$PREVIOUS" >&2
tail -80 "$LOG_FILE" >&2 || true
exit 1
`,
);

writeFileSync(
  join(releaseDir, "ROLLBACK.md"),
  `# Rollback ${version}

AUF MAC STUDIO:

\`\`\`bash
SHARED_ROOT=/Users/Shared/Klarwerk_Insel
readlink "$SHARED_ROOT/current"
ls -1dt "$SHARED_ROOT/releases"/* | sed -n '1,10p'
ln -sfn /Users/Shared/Klarwerk_Insel/releases/<VORVERSION> "$SHARED_ROOT/current"
if [ -f "$SHARED_ROOT/logs/server-3002.pid" ]; then
  OLD_PID="$(cat "$SHARED_ROOT/logs/server-3002.pid" 2>/dev/null || true)"
  [ -n "$OLD_PID" ] && kill "$OLD_PID" || true
fi
nohup "$SHARED_ROOT/current/start.command" >"$SHARED_ROOT/logs/server-3002.log" 2>&1 &
echo $! > "$SHARED_ROOT/logs/server-3002.pid"
curl -sI http://127.0.0.1:3002/ | sed -n '1,8p'
\`\`\`

Die Daten-Datei bleibt unter \`/Users/Shared/Klarwerk_Insel/data/state.jsonl\`.
Beim Install wurde zusaetzlich ein Backup unter \`/Users/Shared/Klarwerk_Insel/backups/<zeitstempel>/state.jsonl\` geschrieben.
`,
);

run("npm", ["ci", "--omit=dev", "--ignore-scripts"], releaseDir);
run("zip", ["-qr", zipPath, version], stagingRoot);

const size = statSync(zipPath).size;
const relativeZip = relative(repo, zipPath);
console.log(JSON.stringify({ version, commit, marker, zipPath, relativeZip, size }, null, 2));
