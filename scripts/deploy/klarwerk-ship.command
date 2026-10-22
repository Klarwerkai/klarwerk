#!/usr/bin/env bash
# Versionierter Lieferweg; Versionen vor der Prüfung festlegen, keine nachträgliche Quelländerung.
# check/attest/intent/push/publish/status siehe docs/operations/release-pflicht.md.
set -euo pipefail
cd "$(dirname "$0")/../.."
exec node tools/publish.mjs "$@"
