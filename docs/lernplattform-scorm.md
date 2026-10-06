# Lerninhalte an eine Lernplattform übergeben (SCORM 1.2)

*Auftrag `produkt:wettbewerb:20261003:lernplattform`. Code: `services/output/src/scorm.ts`,
`services/output/src/scorm-laufzeit.ts`, `services/app/src/routes/lms-export-routes.ts`,
Oberfläche `apps/web/src/components/ScormUebergabe.tsx`.*

## Technischer Lieferumfang

| Punkt | Festlegung |
| --- | --- |
| Format | SCORM 1.2 Content Package (PIF, ZIP) mit genau einem SCO |
| Standardversion | ADL SCORM 1.2 (`<schema>ADL SCORM</schema>`, `<schemaversion>1.2</schemaversion>`), Laufzeit RTE 1.2 (`window.API`) |
| Referenz-LMS | Moodle 4.5 LTS, Aktivität „SCORM-Paket“ (mod_scorm) |
| Art des Pakets | portabel: alle Dateien im ZIP (`imsmanifest.xml`, `index.html`, `sco.js`, `sco.css`, `klarwerk-export.json`, `medien/*`) |
| Netzabhängigkeit | keine. Das Paket lädt nur eigene Dateien; eine Content-Security-Policy im `index.html` (`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:`) verhindert Nachladen von fremden Servern. Externe Quellenverweise bleiben als Link erhalten und öffnen nur auf Klick. Kein KI-Dienst, kein Microsoft-365-Datenfluss. |
| Rückkanal | keiner — Klarwerk liest keine Lernergebnisse aus der Lernplattform zurück |
| Sprachen | Paketoberfläche Deutsch oder Englisch (Wahl beim Export); Klarwerk-Oberfläche DE/EN/NL |

Andere Lernplattformen sind nicht zugesagt (keine universelle Kompatibilitätszusage, keine
Zertifizierung). SCORM 2004, xAPI/cmi5 und LTI sind nicht Teil dieser Lieferung.

## Kurzer Bedienweg

1. Betreiber: die zugelassenen Lernplattformen in `KLARWERK_LMS_EMPFAENGER` eintragen, z. B.
   `moodle-schulung=Moodle Schulungsportal`. Ohne Eintrag lehnt Klarwerk jeden Export mit dem
   Befund „keine Lernplattform freigegeben“ ab.
2. In Klarwerk **Output → Typ „Schulung“** wählen, die validierten Wissensobjekte ankreuzen und in
   die gewünschte Reihenfolge bringen.
3. Im Kasten **„An Lernplattform übergeben (SCORM 1.2)“** Paketsprache und Empfänger wählen,
   **„Export prüfen“** klicken. Blockierende Befunde und Hinweise (was nicht ins Paket geht)
   erscheinen getrennt nach Inhaltsfreigabe, Medien, Quellen und Empfängerfreigabe.
4. Ist der Export freigegeben: **„SCORM-Paket herunterladen“**. Dateiname und Paket nennen die
   Exportfassung (`klarwerk-scorm12-<titel>-<kennung>.zip`).
5. In Moodle: Kurs → Aktivität hinzufügen → „SCORM-Paket“ → ZIP hochladen → speichern. Als
   Abschlussbedingung „Status erforderlich: abgeschlossen“ einstellen.

Schnittstelle: `POST /api/output/scorm/pruefen` und `POST /api/output/scorm/paket`, Recht
`ko.read` (siehe `docs/architektur/http-api-referenz.md`).

## Drei getrennte Dinge

### 1. Inhaltsübergabe (Klarwerk)

Erfolgreich ist die Inhaltsübergabe, wenn Klarwerk ein Paket ausgeliefert hat. Das heißt nur: der
Inhalt hat Klarwerk in genau dieser Fassung verlassen. Jeder ausgelieferte Export steht als eigener
Auditeintrag `output.lms-export` (Exportfassung, Objektfassungen, Empfänger, SHA-256 des Pakets)
im Auditprotokoll. Das Paket ist damit noch **nicht** in der Lernplattform veröffentlicht.

Was hinein darf (Inhaltsfreigabe): nur validierte, nicht vertrauliche Wissensobjekte ohne
Schutzdaten-Quarantäne, ohne zugriffsbeschränkte Fremdquelle, mit vollständig vorhandenen und
nicht vertraulichen Bildern in PNG, JPEG, GIF oder WebP, die nicht aus einem Fremdsystem stammen.
An wen (Empfängerfreigabe): nur an eine vom Betreiber eingetragene Lernplattform. Beide Prüfungen
laufen getrennt; keine ersetzt die andere. Ein neues Freigaberecht gibt es nicht — es gelten die
bestehenden Kontoregeln (Export mit `ko.read`, Inhalte nur nach der regulären Validierung).

Nicht im Paket, aber als Hinweis gemeldet: Anhänge, die keine eingebetteten Bilder sind; interne
Klarwerk-Verweise (bleiben als Text stehen). Wörtliche Auszüge aus Fremdquellen werden nie
übernommen; je Quelle gehen nur Bezeichnung, Anbieter, Quellfassung und Adresse mit.

### 2. Lernabschluss in der Lernplattform (Paket ↔ LMS)

Den Lernabschluss meldet das **Paket** an die Lernplattform (SCORM 1.2 `cmi.core.lesson_status`):

* beim ersten Öffnen `incomplete`;
* `completed` nur, wenn jede Lerneinheit angezeigt wurde **und** die lernende Person auf der letzten
  Einheit „Abschließen“ gewählt hat;
* wird vorher geschlossen, bleibt `incomplete` mit `cmi.core.exit = suspend`; beim nächsten Öffnen
  geht es an derselben Einheit weiter;
* ein bereits gemeldetes `completed` wird nie zurückgestuft;
* lehnt die Plattform den Abschluss ab, zeigt das Paket das ausdrücklich an und behauptet keinen
  Abschluss.
* bestätigt ist der Abschluss erst, wenn die Plattform ihn auch gespeichert hat (`LMSCommit`
  erfolgreich); scheitert das Speichern, etwa bei einer Netzunterbrechung, meldet das Paket
  „nicht angenommen“, und „Abschließen“ kann erneut gewählt werden.
* meldet der Browser keine Netzverbindung (`navigator.onLine === false`), bestätigt das Paket
  keinen Abschluss und setzt auch keinen; es bittet, nach Wiederherstellung der Verbindung erneut
  „Abschließen“ zu wählen. Hintergrund: Moodle 4.5 antwortet in diesem Zustand auf
  `LMSSetValue`/`LMSCommit` mit „true“ und Fehlercode „0“, speichert aber nichts.
  Grenze: Einen Ausfall, den auch der Browser nicht erkennt, kann das Paket nicht von einem
  erfolgreichen Speichern unterscheiden — es gibt in SCORM 1.2 keine Rückfrage beim Server.

Es gibt keine Punktzahl und keine Verständnisprüfung (die Verständnisprüfung aus Auftrag 02 ist
nicht Teil dieser Lieferung). Ohne Lernplattform (Datei direkt geöffnet) wird der Inhalt gezeigt
und ausdrücklich gesagt, dass nichts gemeldet wird.

### 3. Rückkanal nach Klarwerk

Es gibt **keinen** Rückkanal. Klarwerk liest aus der Lernplattform weder Abschlüsse noch
Lernergebnisse zurück und zeigt deshalb keine an. Ob jemand ein Paket abgeschlossen hat, steht
ausschließlich in der Lernplattform.

## Fassungen

Jede Änderung an der Klarwerk-Quelle (neue Fassung eines Wissensobjekts, anderes Bild, andere
Sprache, anderer Titel) ergibt eine neue **Exportfassung** mit eigener Kennung, eigenem
Manifest-Bezeichner (`KLARWERK-SCORM12-<kennung>`) und eigenem Dateinamen. Gleicher Inhalt ergibt
ein byte-gleiches Paket. Klarwerk legt Pakete nicht ab und überschreibt deshalb nichts: frühere
Exporte bleiben als Auditeinträge, frühere Objektfassungen in der Versionsliste erhalten. In der
Lernplattform ersetzt Klarwerk nichts — ob ein neues Paket eine veröffentlichte Aktivität ersetzt
oder als neue Aktivität daneben angelegt wird, entscheidet die verantwortliche Person in der
Lernplattform bewusst.

Im Paket nennt `klarwerk-export.json` Exportfassung, Titel, Sprache, Empfänger, je Lerneinheit
Wissensobjekt-Kennung, Fassung, Stand und Quellen sowie je Bild Pfad und SHA-256.

## Fehlerfälle

| Befund | Bedeutung | Folge |
| --- | --- | --- |
| `NOT_VALIDATED`, `UNKNOWN_KO`, `NO_SOURCES`, `TOO_MANY_SOURCES` | Inhalt nicht freigegeben bzw. Auswahl ungültig | kein Paket |
| `CONFIDENTIAL`, `SCHUTZDATEN`, `SOURCE_RESTRICTED` | geschützter Inhalt | kein Paket |
| `MEDIA_MISSING`, `MEDIA_UNSUPPORTED`, `MEDIA_CONFIDENTIAL`, `MEDIA_FOREIGN` | Bild fehlt, falsches Format, vertraulich oder aus Fremdsystem | kein Paket |
| `RECIPIENTS_NOT_CONFIGURED`, `RECIPIENT_NOT_ALLOWED` | Empfänger nicht freigegeben | kein Paket |
| `ATTACHMENTS_NOT_INCLUDED`, `LINK_INTERNAL_REMOVED`, `EXTERNAL_LINK` | Hinweis: was nicht oder nur als Link mitgeht | Paket wird erzeugt |

Die Paket-Route antwortet bei blockierenden Befunden mit HTTP 422 `EXPORT_BLOCKED` und derselben
Prüfung; ein unlesbarer Rumpf ist HTTP 400 `BAD_REQUEST`.

## Abnahme am Referenzsystem (offen)

Automatisiert belegt sind Paketaufbau, Manifest, Inhalte, Fassungen, Fehlerfälle, fehlende
Netzabhängigkeit und das Abschlussverhalten gegen eine SCORM-1.2-Laufzeitattrappe
(`tests/lernplattform-scorm/`). **Nicht** belegt ist der Import in ein echtes Moodle 4.5 LTS. Dafür
offen:

1. Neutrales Beispielpaket aus Klarwerk erzeugen und in Moodle 4.5 LTS als SCORM-Aktivität
   importieren (Import ohne Fehlermeldung).
2. Als lernende Person öffnen: Titel, Reihenfolge, Texte, Bild und Herkunftsangaben sichtbar.
3. Vollständig durchlaufen und abschließen → Moodle-Bericht zeigt „abgeschlossen“.
4. Zweite Person: nach Einheit 2 schließen → Moodle zeigt „unvollständig“, Wiederaufnahme an
   Einheit 2.
5. Netzwerkmitschnitt im Browser während 2–4: keine Anfrage an einen anderen Server als die
   Moodle-Instanz.
