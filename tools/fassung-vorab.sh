#!/usr/bin/env bash
# REGISTER I17 (R-2033) — DIE ANGEKOMMENE FASSUNG PRÜFEN, BEVOR SIE BENUTZT WIRD.
#
# AUFGERUFEN VON tools/build als ERSTER Schritt — vor Typprüfung, Bau und Tests. Wer Dateien auf
# diese Maschine überträgt, liefert die quellseitige Fassungsliste mit
# (`node tools/fassung-pruefen.ts melden <wurzel> <pfad…>` auf der Quellmaschine) und nennt sie in
# KLARWERK_FASSUNG_MANIFEST. Dann wird jede gelistete Datei gegen Bytezahl UND SHA-256 geprüft;
# eine Abweichung beendet den Lauf, statt eine Altfassung zu bauen und zu testen.
#
# OHNE LISTE wird NICHTS behauptet: die Meldung sagt ausdrücklich, dass die Übertragung ungeprüft
# ist. Mit KLARWERK_FASSUNG_PFLICHT=1 ist das fehlende Manifest selbst ein Abbruch — für Abläufe,
# die eine Übertragung durchführen und deshalb immer eine Liste mitliefern müssen.
#
# Kein `chmod` nötig: tools/build ruft diese Datei über `bash` auf.
#
# EXITCODES: 0 = geprüft und gleich, ODER keine Liste (ohne Pflicht) · 1 = Abweichung oder fehlende
# Pflichtliste · 2 = Liste unlesbar
set -euo pipefail
cd "$(dirname "$0")/.."
manifest="${KLARWERK_FASSUNG_MANIFEST:-}"
if [ -z "$manifest" ]; then
  if [ "${KLARWERK_FASSUNG_PFLICHT:-0}" = "1" ]; then
    echo "fassung-vorab: KLARWERK_FASSUNG_PFLICHT=1, aber keine Fassungsliste gemeldet — Abbruch." >&2
    exit 1
  fi
  echo "fassung-vorab: keine Fassungsliste gemeldet (KLARWERK_FASSUNG_MANIFEST leer) — Übertragung ungeprüft." >&2
  exit 0
fi
exec node tools/fassung-pruefen.ts pruefen . "$manifest"
