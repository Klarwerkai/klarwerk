#!/usr/bin/env python3
"""Alle öffentlichen Tabellen messen; Backup und Messung teilen einen PG-Snapshot."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def sql(query):
    return subprocess.check_output(
        ["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query], text=True
    ).strip()


def bestand(snapshot=None):
    prefix = "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;"
    if snapshot:
        prefix += "SET TRANSACTION SNAPSHOT '" + snapshot + "';"
    tables = sql(prefix + "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;ROLLBACK;").splitlines()
    result = {}
    for table in tables:
        quoted = '"public"."' + table.replace('"', '""') + '"'
        query = prefix + "COPY (SELECT to_jsonb(t)::text FROM " + quoted + " t ORDER BY to_jsonb(t)::text) TO STDOUT;ROLLBACK;"
        proc = subprocess.Popen(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1", "-c", query], stdout=subprocess.PIPE)
        digest = hashlib.sha256()
        rows = 0
        for line in proc.stdout:
            digest.update(line)
            rows += 1
        if proc.wait():
            raise RuntimeError("Inhaltsmessung fehlgeschlagen: " + table)
        result[table] = {"zeilen": rows, "sha256_kanonische_zeilen": digest.hexdigest()}
    return result


def main():
    mode, output = sys.argv[1:3]
    holder = subprocess.Popen(["psql", "-X", "-qAt", "-v", "ON_ERROR_STOP=1"],
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True)
    try:
        holder.stdin.write("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;SELECT pg_export_snapshot();\n")
        holder.stdin.flush()
        snapshot = holder.stdout.readline().strip()
        if not re.fullmatch(r"[0-9A-Fa-f]+-[0-9A-Fa-f]+-[0-9]+", snapshot):
            raise RuntimeError("PostgreSQL-Snapshot fehlt")
        measured = bestand(snapshot)
        if mode == "sichern":
            root = Path(__file__).resolve().parents[2]
            env = dict(os.environ, PGDUMP_SNAPSHOT=snapshot,
                       PATH=str(root / "scripts/backup/native") + os.pathsep + os.environ["PATH"])
            subprocess.run(["bash", str(root / "scripts/backup/backup.sh"), sys.argv[3]], env=env, check=True)
        elif mode != "pruefen":
            raise ValueError("sichern oder pruefen angeben")
        Path(output).write_text(json.dumps({"tabellen": measured, "snapshot": snapshot}, indent=2) + "\n")
    finally:
        try:
            holder.stdin.write("ROLLBACK;\n")
            holder.stdin.close()
        except BrokenPipeError:
            pass
        holder.wait()


if __name__ == "__main__":
    main()
