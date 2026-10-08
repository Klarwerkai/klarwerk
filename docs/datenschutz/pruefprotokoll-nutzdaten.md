# Prüfprotokoll: Nutzdaten je Aktion (Inventar)

Auftrag `aufnahme:20260922:gesamt-datenschutz-voreinstellung`, Punkt R-0585 (DS6):
„Offen ist, wie viele Nutzdaten das Prüfprotokoll je Aktion mitführt; das ist nie inventarisiert
worden." Dieses Dokument ist dieses Inventar.

**Stand und Methode.** Quelleninspektion der Basis `6ae13f89` (1.0.0-beta.1.731): alle Aufrufe von
`AuditService.record` / `recordOnce` außerhalb von Testdateien unter `services/` (88 Aufrufstellen in
19 Dateien), je Stelle das `payload`-Objekt gelesen. Das Prüfprotokoll ist append-only mit Hash-Kette
(`services/audit`); ein Eintrag lässt sich nachträglich weder ändern noch löschen. Genau deshalb
zählt, was hineingeht.

Ausgeführt gemessen (nicht nur gelesen) ist bisher nur die Zeile `ask.query`:
`tests/datenschutz-voreinstellung/frage-nicht-im-beleg.test.ts` hält ihre Feldmenge fest und prüft,
dass weder Frage- noch Antworttext im Protokoll stehen.

## Einordnung

| Klasse | Bedeutung |
| --- | --- |
| **K** Kennung | technische Kennungen (KO-, Konflikt-, Kandidaten-, Vorschlags-, Nutzer-Id) |
| **Z** Zähler/Schalter | Zahlen, Wahrheitswerte, Einstellungswerte aus geschlossenen Mengen |
| **M** Metadaten | Fassung, Kategorie, Schlagworte, Fachgebiet, Anbieter, Format, Zeitpunkte |
| **P** Personenbezug über die Kennung hinaus | Klarnamen, Aussteller-Adresse |
| **F** Freitext | ungebundene Eingabe eines Menschen |

`actor` (Nutzer-Id oder `system`) und `target` stehen in jedem Eintrag und sind hier nicht
wiederholt.

## Inventar

### Fragen und Wissenslücken (`services/ask`)

| Aktion | Nutzlast | Klasse |
| --- | --- | --- |
| `ask.query` | `answered`, `retrievalMode`, `prefilterCount`, `candidateCount`, `topK`, `prefilterQueries`, `prefilterTermLimit` | Z — **kein Fragetext, keine Suchwörter** (gemessen) |
| `answer.helpful` | `koTitle`, `koAuthor`, `koOriginalAuthor`, `via` (nur `"wissensobjekt"` beim Klick am Objekt) | M, K |
| `gap.created` | — | — (gemessen: leer; Fragetext steht nur in der Lücke selbst) |
| `gap.priority-changed` | — | — |

### Wissensobjekte (`services/knowledge-object`, `services/validation`, `services/lifecycle`)

| Aktion | Nutzlast | Klasse |
| --- | --- | --- |
| `ko.created`, `ko.commented`, `ko.attached`, `ko.attachment-updated`, `ko.detached`, `ko.source-added`, `ko.source-removed` | — | — |
| `ko.document-appended` | `created`/`operationId`, `version`, `revised`, `objectId`, `documents`/`sources` (Anzahl) | K, Z |
| `ko.create-rollback-failed` | `at`, `failedStep`, `rollbackFailure` (nur Fehlerklasse/-code), `marked`, `koRemoved`, `searchProjection*` | Z, M |
| `ko.change-rolled-back` | Nutzlast des zurückgenommenen Schritts + `rolledBackSeqs` | wie Ursprung, K |
| `ko.confidentiality` | `level`, `previous`, `downgrade` | Z |
| `ko.ownership` | `owner`, `reviewers`, `validators`, `previousOwner` | K (Nutzer-Ids) |
| `ko.ownership-role` | `role`, `added` | K |
| `ko.purged` | `reason` (geschlossene Menge) + Zusatz des Aufrufers | Z |
| `ko.restored`, `ko.deleted` | `trash` / leer + Beitrag | Z |
| `ko.revised` | `version`, ggf. `proposalId` | Z, K |
| `ko.admin-validated` | `koVersion`, ggf. `proposalId` | Z, K |
| `ko.proposed`, `ko.proposal-rejected` | `proposalId`, `baseVersion` | K, Z — die Begründung einer Ablehnung steht **nicht** im Protokoll |
| `ko.category-changed`, `ko.tags-changed` | `grund`, `vorher`/`nachher` (Kategorie, Schlagworte), `metadataRevision`, `metadataChanged`, `category` | M |
| `ko.domain-changed` | `vorher`, `nachher` (Fachgebiet, ≤ 120 Zeichen) | M |
| `ko.geltung-changed` | `vorher`, `nachher` (Geltung: Ebene, Werk, Schicht, Rolle — je ≤ 80 Zeichen; nachgetragen mit `gesamt-standortwissen`) | M |
| `ko.conflict-review` | `previousStatus`, `previousTrust`, `trust`, `reason` | Z |
| `ko.author-transferred` | `author` | K |
| `ko.source-removed-in-origin`, `ko.source-restored-in-origin` | `provider`, `externalId`, `at`/`removedAt` | M, K |
| `ko.source-attachments-synced` | `provider`, `externalId`, `added`, `removed` | M, K |
| `ko.source-restriction-synced` | `provider`, `externalId`, `groups`/`users` (nur Anzahl) | M, Z |
| `ko.rated` | `verdict`, `koVersion` | Z |
| `ko.returned-to-owner`, `ko.returned-to-author` | `verdict`, `author`, `responsible`, `responsibleKind`, `koVersion` | Z, K |
| `ko.assigned` | `userIds` | K |
| `ko.revalidated` | `pendingCleared`, `version` | Z |
| `ko.create-followup-failed` | `step`, `reason` (nur Fehlerklasse) | Z |
| `validation.defaultNeeded.set` | `value` | Z |
| Dublette bestätigt (`DUBLETTE_BESTAETIGT_AUDIT`) | `overlapIds`, `weg` | K, Z |

### Konflikte und Überschneidungen (`services/conflicts`)

| Aktion | Nutzlast | Klasse |
| --- | --- | --- |
| `conflict.created`, `conflict.escalated` | `koIds` | K |
| `conflict.auto-created` | `trigger`, `method`, `koIds` | Z, K |
| `conflict.dismissed`, `conflict.resolved` | `koIds`, `resolutionReason` | K, Z |
| `conflict.second-opinion` | — | — |
| `conflict.participant-removed`, `conflict.auto-resolved`, `conflict.superseded` | `koId`/`reason`/`currentVersion`/`via` | K, Z |
| `overlap.auto-created` | `relation`, `method`, `koIds` | Z, K |
| `overlap.superseded`, Schließen/Trennen/Verknüpfen | `koIds`, `resolutionReason` bzw. `koId` | K, Z |
| **`overlap.in-progress`** | **`note`**, `koIds` | **F** — siehe Befund 1 |
| `overlap.settings.set` | `minConfidence` | Z |

Die Begründung und die Zitate eines automatisch erkannten Konflikts (`rationale`, `quotes`) stehen
am Konflikt, **nicht** im Protokoll.

### Import, Bibliothek, Ausgabe (`services/library-analytics`, `services/app`)

| Aktion | Nutzlast | Klasse |
| --- | --- | --- |
| `import.candidates-created` | `count`, `candidateIds` | Z, K |
| `import.cleanup` | Zähler der Aufräumbilanz | Z |
| `import.candidate-<aktion>` | `duplicate`, `koId`, ggf. `retried` | Z, K |
| `import.attachments` | Zähler des Anhangsabgleichs | Z |
| `library.export` | `format`, `count`, `includeConfidential`, `koIds` | M, Z, K |
| `library.import` | `imported`, `skipped` | Z |
| `output.lms-export` | `format`, `exportfassung`, `manifestId`, `empfaenger` (aus der Betreiberliste), `sprache`, `objekte` (Id + Fassung), `paketSha256` | M, K |
| `confluence-import.betreiberschalter` | `vorherAn`, `an`, `version` | Z |
| `examples.load`, `demoPackage.*` | Zähler | Z |
| `upload.limits.set` | Grenzwerte | Z |
| `branding.set` | `vorherProfil`, `vorherAktiv`, `profil`, `aktiv`, `version` | Z |
| `begriff.angelegt`, `begriff.geaendert` | `version`/`vorherVersion`, `geltungsbereich` | Z, M — der Begriffstext steht **nicht** im Protokoll |
| `external.policy.set` | `stage` | Z |
| `reasoner.ki-freigabe` | `vorher`, `nachher` (Freigabestand) | Z |
| `audit.exported` | `count`, `headSeq`, `headHash` | Z |

### Konten und Anmeldung (`services/auth`)

| Aktion | Nutzlast | Klasse |
| --- | --- | --- |
| `auth.login` | — bzw. `method` | Z |
| `auth.logout`, `user.approve`, `user.password-reset`, `user.password-changed`, `user.password-reset-email`, `user.oidc-provisioned` | — | — |
| `user.created` | `via`, `role`, `approved` | Z |
| `user.access-expired`, `user.access-expiry-unreadable`, `user.access-expiry-set` | Ablaufzeitpunkt bzw. `entfernt` | M |
| `user.oidc-linked`, `user.oidc-linked-unverified` | `aussteller` | P (Adresse des Identitätsanbieters; **kein** `sub`, **keine** Mailadresse) |
| `user.role-claim-missing`, `user.role-synced` | `aussteller`, `rolle` bzw. `von`/`nach` | P, Z |
| `notice.acknowledged` | `version` | Z |
| **`user.role-change`** | `role`, `previousRole`, **`actorName`, `targetName`** | **P** — siehe Befund 2 |
| **`user.delete`** | **`targetName`**, **`actorName`** | **P** — siehe Befund 2 |

Keine Aktion trägt eine IP-Adresse, eine Browserkennung, ein Passwort, ein Token oder eine
Mailadresse.

## Befunde

1. **Freitext im unveränderlichen Protokoll: `overlap.in-progress.note`.** Der optionale Vermerk beim
   Übergang „In Bearbeitung" (`services/conflicts/src/overlap-service.ts`, `takeInProgress`) wird
   ungekürzt ins Protokoll geschrieben — und **nur** dorthin: am Überschneidungseintrag selbst wird er
   nicht gespeichert, und kein Lesepfad wertet ihn aus. Damit ist er die einzige ungebundene
   Nutzereingabe im Protokoll und lässt sich nicht mehr löschen. Nicht geändert, weil jede Abhilfe
   (Vermerk am Eintrag ablegen oder ersatzlos verwerfen) eine Produktentscheidung über eine bestehende
   Eingabe ist.
2. **Klarnamen in `user.role-change` und `user.delete`.** Beide Einträge tragen die Anzeigenamen von
   Handelndem und Betroffenem. Nach dem Löschen eines Kontos bleibt dessen Name damit dauerhaft im
   Protokoll (Spannung zu DSGVO Art. 17; Art. 17 Abs. 3 kann die Aufbewahrung rechtfertigen). Nicht
   geändert: der Name ist gerade nach der Löschung die einzige lesbare Zuordnung, und ob er bleiben
   soll, ist eine Entscheidung, keine Korrektur.
3. **Fragetext.** Steht in keinem Protokolleintrag (gemessen, s. oben). Er steht ausschließlich in
   einer Wissenslücke, wenn eine Frage unbeantwortet bleibt; dort regelt `redactGapForViewer`
   (`services/ask/src/gap-visibility.ts`) die Sichtbarkeit.
