// ================================================================================================
// ADMIN-09 · FREIGABEREGELN — die Texte der Freigaberegel eines Space (produkt:20261009:admin-freigaberegeln).
// ================================================================================================
//
// Fläche: Space-Detailseite › „Freigaberegel und Prüfzuständigkeit" (`components/SpaceFreigaberegel.tsx`).
// Die Sätze trennen ausdrücklich Entwurf, fachliche Freigabe und Veröffentlichung und nennen eine
// einzelne Zustimmung nie „freigegeben".
//
// Die vier `audit.action.*`-Schlüssel sind Altnamen-Muster: `lib/auditAction.ts` leitet sie aus den
// Protokollvorgängen dieses Auftrags ab.
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "freigaberegeln.",
  legacySchluessel: [
    "audit.action.space_freigaberegel_geaendert",
    "audit.action.freigaberegel_ausnahme",
    "audit.action.freigaberegel_fristlauf",
    "audit.action.ko_needed_validations_raised",
  ],
  de: {
    "audit.action.space_freigaberegel_geaendert": "Freigaberegel geändert",
    "audit.action.freigaberegel_ausnahme": "Freigabe auf Ausnahmeweg",
    "audit.action.freigaberegel_fristlauf": "Vertretungsaufgaben aus Frist angelegt",
    "audit.action.ko_needed_validations_raised": "Erforderliche Zustimmungen angehoben",
    "freigaberegeln.titel": "Freigaberegel und Prüfzuständigkeit",
    "freigaberegeln.erklaerung":
      "Wer Beiträge in diesem Space prüfen darf, wie viele Zustimmungen nötig sind und was noch fehlt. Diese Fläche gibt nichts frei — entschieden wird im Prüfbereich, und der Server prüft dort die Regel.",
    "freigaberegeln.laedt": "Freigaberegel wird geladen …",
    "freigaberegeln.erneut": "Erneut versuchen",
    "freigaberegeln.regel.standard":
      "Keine eigene Regel: Es gilt der Standard — {{anzahl}} Zustimmungen von Personen mit Prüfrecht, die den Inhalt sehen dürfen.",
    "freigaberegeln.regel.zustimmungen":
      "Erforderlich: {{anzahl}} Zustimmungen zur aktuellen Fassung, keine Ablehnung",
    "freigaberegeln.regel.gruppe": "Prüfergruppe: {{namen}}",
    "freigaberegeln.regel.alle": "Prüfergruppe: alle mit Prüfrecht und Zugang zum Space",
    "freigaberegeln.regel.team": "Team {{name}}",
    "freigaberegeln.regel.frist": "Frist je Prüfaufgabe: {{tage}} Tage",
    "freigaberegeln.regel.keineFrist": "Keine Frist",
    "freigaberegeln.regel.vertretung": "Vertretung: {{liste}}",
    "freigaberegeln.regel.vertretungEintrag": "{{durch}} vertritt {{fuer}}",
    "freigaberegeln.regel.keineVertretung": "Keine Vertretung",
    "freigaberegeln.schritte.titel": "Schritte bis zur Veröffentlichung",
    "freigaberegeln.schritte.einreichen": "Entwurf einreichen — erst dann ist es ein Prüfvorgang.",
    "freigaberegeln.schritte.zustimmungen":
      "{{anzahl}} Zustimmungen berechtigter Prüfer zur aktuellen Fassung.",
    "freigaberegeln.schritte.keine_ablehnung": "Keine offene Ablehnung zu dieser Fassung.",
    "freigaberegeln.schritte.freigabe":
      "Fachlich freigegeben — erst wenn alle Zustimmungen da sind; eine einzelne Zustimmung ist keine Freigabe.",
    "freigaberegeln.schritte.veroeffentlichen":
      "Veröffentlichen ist ein eigener Schritt und setzt die Freigabe voraus.",
    "freigaberegeln.selbstpruefung":
      "Den eigenen Beitrag prüft niemand selbst — auch kein Administrator (Mehr-Augen-Prinzip).",
    "freigaberegeln.ausnahmen":
      "Ausnahmewege: Admin-Kennzeichnung und Eigentümerfreigabe sind Einzelentscheidungen. Sie stehen mit Person, Zeitpunkt und Fassung als Ausnahme im Protokoll.",
    "freigaberegeln.pruefer.titel": "Prüfer nach dieser Regel",
    "freigaberegeln.pruefer.niemand": "Niemand kann nach dieser Regel prüfen.",
    "freigaberegeln.pruefer.vertretungBereit":
      "Vertretung bereit — entscheidet erst, wenn die Aufgabe übergeben ist",
    "freigaberegeln.weg.alle": "Prüfrecht",
    "freigaberegeln.weg.konto": "genannt",
    "freigaberegeln.weg.team": "über Team",
    "freigaberegeln.weg.vertretung": "Vertretung",
    "freigaberegeln.hindernis.inaktiv": "nicht aktiv",
    "freigaberegeln.hindernis.ohne_pruefrecht": "ohne Prüfrecht",
    "freigaberegeln.hindernis.ohne_spacezugang": "ohne Zugang zum Space",
    "freigaberegeln.fehlt.titel": "Fehlende Voraussetzungen",
    "freigaberegeln.fehlt.keine_regel":
      "Für diesen Space ist keine eigene Freigaberegel festgelegt.",
    "freigaberegeln.fehlt.space_archiviert":
      "Der Space ist archiviert; die Regel lässt sich erst nach der Wiederaufnahme ändern.",
    "freigaberegeln.fehlt.zuWenige":
      "Nur {{berechtigt}} berechtigte aktive Prüfer, {{erforderlich}} Zustimmungen erforderlich. Beiträge bleiben in Prüfung, bis weitere Prüfer verfügbar sind.",
    "freigaberegeln.fehlt.ohneWirkung": "Genannt, aber ohne Wirkung: {{namen}}",
    "freigaberegeln.fehlt.vertretung": "Vertretung {{durch}} für {{fuer}} wirkt nicht: {{grund}}",
    "freigaberegeln.fehlt.team": "Team {{name}} ist archiviert und trägt keine Prüfer bei.",
    "freigaberegeln.vorgaenge.titel": "Laufende und abgeschlossene Vorgänge",
    "freigaberegeln.vorgaenge.keine":
      "In diesem Space gibt es keinen Vorgang, den du sehen darfst.",
    "freigaberegeln.vorgaenge.verborgen":
      "{{anzahl}} weitere Vorgänge sind für dich nicht sichtbar und zählen nur mit.",
    "freigaberegeln.vorgang.fassung": "Fassung {{version}}",
    "freigaberegeln.vorgang.offen":
      "{{gruen}} von {{erforderlich}} Zustimmungen · {{gelb}} Rückfragen · {{rot}} Ablehnungen — noch nicht freigegeben",
    "freigaberegeln.vorgang.freigegeben":
      "Freigegeben mit {{gruen}} Zustimmungen ({{erforderlich}} erforderlich)",
    "freigaberegeln.vorgang.veraltet": "{{anzahl}} Bewertungen früherer Fassungen zählen nicht",
    "freigaberegeln.zustand.entwurf": "Entwurf",
    "freigaberegeln.zustand.eingereicht": "eingereicht",
    "freigaberegeln.zustand.korrektur_noetig": "Korrektur nötig",
    "freigaberegeln.zustand.freigegeben": "fachlich freigegeben",
    "freigaberegeln.zustand.veroeffentlicht": "veröffentlicht",
    "freigaberegeln.luecke.zustimmungen": "Es fehlen noch {{anzahl}} Zustimmungen.",
    "freigaberegeln.luecke.ablehnung": "{{anzahl}} Ablehnungen zu dieser Fassung sind offen.",
    "freigaberegeln.luecke.unabhaengig":
      "Nur {{verfuegbar}} unabhängige Prüfer verfügbar, {{erforderlich}} erforderlich.",
    "freigaberegeln.luecke.aufgabe": "Prüfaufgabe von {{name}} ist überfällig oder verwaist.",
    "freigaberegeln.aufgabe.zeile": "Aufgabe: {{wer}} seit {{seit}}",
    "freigaberegeln.aufgabe.faellig": "fällig {{zeit}}",
    "freigaberegeln.aufgabe.ueberfaellig": "überfällig seit {{zeit}}",
    "freigaberegeln.aufgabe.vertretung": "Vertretung für {{fuer}}",
    "freigaberegeln.aufgabe.inaktiv": "Konto nicht aktiv",
    "freigaberegeln.entscheidung.zeile": "{{art}} · {{wer}} · {{zeit}} · Fassung {{fassung}}",
    "freigaberegeln.entscheidung.zustimmung": "Zustimmung",
    "freigaberegeln.entscheidung.rueckfrage": "Rückfrage",
    "freigaberegeln.entscheidung.ablehnung": "Ablehnung",
    "freigaberegeln.entscheidung.admin_kennzeichnung": "Admin-Kennzeichnung",
    "freigaberegeln.entscheidung.eigentuemerfreigabe": "Eigentümerfreigabe",
    "freigaberegeln.entscheidung.aeltereFassung": "frühere Fassung, zählt nicht",
    "freigaberegeln.entscheidung.ausnahme": "Ausnahme",
    "freigaberegeln.entscheidung.selbst": "eigener Beitrag",
    "freigaberegeln.verlauf.titel": "Verlauf der Regel",
    "freigaberegeln.verlauf.eintrag": "Space-Fassung {{version}} · {{zeit}} · {{wer}}",
    "freigaberegeln.verlauf.ohneRegel": "Regel entfernt",
    "freigaberegeln.pflege.oeffnen": "Regel ändern …",
    "freigaberegeln.pflege.schliessen": "Schliessen",
    "freigaberegeln.pflege.titel": "Freigaberegel ändern",
    "freigaberegeln.pflege.zustimmungen": "Erforderliche Zustimmungen",
    "freigaberegeln.pflege.pruefer": "Prüfer (Konten)",
    "freigaberegeln.pflege.prueferHinweis":
      "Ohne Auswahl prüfen alle mit Prüfrecht und Zugang. Eine Nennung verleiht weder Prüfrecht noch Zugang.",
    "freigaberegeln.pflege.teams": "Prüferteams",
    "freigaberegeln.pflege.frist": "Frist je Prüfaufgabe in Tagen (leer: keine)",
    "freigaberegeln.pflege.vertretungen": "Vertretungen",
    "freigaberegeln.pflege.fuer": "Vertreten wird",
    "freigaberegeln.pflege.durch": "Vertreten durch",
    "freigaberegeln.pflege.entfernen": "Entfernen",
    "freigaberegeln.pflege.vertretungHinzu": "Vertretung hinzufügen",
    "freigaberegeln.pflege.begruendung": "Begründung (optional, steht im Verlauf)",
    "freigaberegeln.pflege.pruefen": "Wirkung prüfen",
    "freigaberegeln.pflege.erfolg":
      "Die neue Regel gilt. Laufende Vorgänge brauchen mindestens die neue Zahl; erteilte Freigaben bleiben unverändert.",
    "freigaberegeln.vorschau.titel": "Wirkung vor der Bestätigung",
    "freigaberegeln.vorschau.alt": "Bisher",
    "freigaberegeln.vorschau.neu": "Danach",
    "freigaberegeln.vorschau.aenderungen": "Geändert: {{liste}}",
    "freigaberegeln.vorschau.laufend":
      "Laufende Vorgänge: {{gesamt}} — höhere Anforderung: {{angehoben}}, niedrigere: {{gesenkt}}, unverändert: {{unveraendert}}",
    "freigaberegeln.vorschau.vorgang":
      "{{titel}}: bisher {{bisher}}, danach {{danach}} Zustimmungen erforderlich ({{gruen}} vorhanden)",
    "freigaberegeln.vorschau.schwelle":
      "erreicht die Zahl, wird aber erst mit der nächsten Entscheidung neu bewertet",
    "freigaberegeln.vorschau.verborgen":
      "{{anzahl}} weitere laufende Vorgänge sind für dich nicht sichtbar und zählen nur mit.",
    "freigaberegeln.vorschau.freigegeben":
      "Erteilte Freigaben: {{anzahl}} — sie bleiben, wie sie sind; nichts wird rückwirkend freigegeben oder aufgehoben.",
    "freigaberegeln.vorschau.prueferNeu": "Neu prüfberechtigt: {{namen}}",
    "freigaberegeln.vorschau.prueferWeg": "Nicht mehr prüfberechtigt: {{namen}}",
    "freigaberegeln.vorschau.prueferWegEintrag": "{{name}} ({{anzahl}} offene Aufgaben)",
    "freigaberegeln.vorschau.danachFehlt": "Danach fehlt:",
    "freigaberegeln.vorschau.bleibt":
      "Die Regel wird eine neue Fassung des Space. Inhalte, Fassungen der Beiträge und bisherige Entscheidungen bleiben unverändert.",
    "freigaberegeln.vorschau.uebernehmen": "Regel übernehmen",
    "freigaberegeln.vorschau.abbrechen": "Abbrechen",
    "freigaberegeln.aenderung.neu": "erste eigene Regel",
    "freigaberegeln.aenderung.zustimmungen": "Zustimmungen",
    "freigaberegeln.aenderung.pruefer": "Prüfer",
    "freigaberegeln.aenderung.teams": "Prüferteams",
    "freigaberegeln.aenderung.frist": "Frist",
    "freigaberegeln.aenderung.vertretung": "Vertretung",
    "freigaberegeln.frist.starten": "Fristen und Vertretungen prüfen",
    "freigaberegeln.frist.ergebnis":
      "Neue Vertretungsaufgaben: {{neu}} · bereits vorhanden: {{bestehend}} · überfällig oder verwaist: {{faellig}} · ohne Vertretung: {{ohne}}",
    "freigaberegeln.frist.neu": "{{titel}}: {{durch}} prüft an Stelle von {{fuer}}",
    "freigaberegeln.frist.ohne":
      "{{titel}}: für {{fuer}} ist keine geeignete Vertretung festgelegt",
    "freigaberegeln.frist.nichtEinsehbar": "Ein für dich nicht sichtbarer Beitrag",
    "freigaberegeln.fehler.allgemein": "Das hat nicht geklappt. Bitte erneut versuchen.",
    "freigaberegeln.fehler.ungueltig":
      "Die Regel ist so nicht zulässig: 1 bis 5 Zustimmungen, Frist 1 bis 90 Tage, nur bestehende Konten und Teams.",
    "freigaberegeln.fehler.vorschauVeraltet":
      "Vorgänge, Prüfer oder Regel haben sich seit der Vorschau geändert. Bitte die neue Wirkung prüfen.",
    "freigaberegeln.fehler.veraltet": "Der Space wurde inzwischen geändert. Bitte neu laden.",
    "freigaberegeln.fehler.archiviert":
      "Dieser Space ist archiviert. Erst wiederaufnehmen, dann die Regel ändern.",
    "freigaberegeln.fehler.keineAenderung": "Die Regel entspricht der geltenden.",
    "freigaberegeln.fehler.recht": "Dafür fehlt dir das Recht.",
  },
  en: {
    "audit.action.space_freigaberegel_geaendert": "Approval rule changed",
    "audit.action.freigaberegel_ausnahme": "Approval via exception path",
    "audit.action.freigaberegel_fristlauf": "Deputy tasks created from deadline",
    "audit.action.ko_needed_validations_raised": "Required approvals raised",
    "freigaberegeln.titel": "Approval rule and review responsibility",
    "freigaberegeln.erklaerung":
      "Who may review contributions in this space, how many approvals are needed and what is still missing. This panel approves nothing — decisions are made in the review area, and the server checks the rule there.",
    "freigaberegeln.laedt": "Loading approval rule …",
    "freigaberegeln.erneut": "Try again",
    "freigaberegeln.regel.standard":
      "No own rule: the default applies — {{anzahl}} approvals from people with review rights who may see the content.",
    "freigaberegeln.regel.zustimmungen":
      "Required: {{anzahl}} approvals of the current version, no rejection",
    "freigaberegeln.regel.gruppe": "Reviewer group: {{namen}}",
    "freigaberegeln.regel.alle":
      "Reviewer group: everyone with review rights and access to the space",
    "freigaberegeln.regel.team": "Team {{name}}",
    "freigaberegeln.regel.frist": "Deadline per review task: {{tage}} days",
    "freigaberegeln.regel.keineFrist": "No deadline",
    "freigaberegeln.regel.vertretung": "Deputies: {{liste}}",
    "freigaberegeln.regel.vertretungEintrag": "{{durch}} stands in for {{fuer}}",
    "freigaberegeln.regel.keineVertretung": "No deputy",
    "freigaberegeln.schritte.titel": "Steps until publication",
    "freigaberegeln.schritte.einreichen": "Submit the draft — only then is it a review case.",
    "freigaberegeln.schritte.zustimmungen":
      "{{anzahl}} approvals from authorised reviewers of the current version.",
    "freigaberegeln.schritte.keine_ablehnung": "No open rejection of this version.",
    "freigaberegeln.schritte.freigabe":
      "Professionally approved — only once all approvals are in; a single approval is not an approval of the whole.",
    "freigaberegeln.schritte.veroeffentlichen":
      "Publishing is a separate step and requires the approval.",
    "freigaberegeln.selbstpruefung":
      "Nobody reviews their own contribution — not even an administrator (four-eyes principle).",
    "freigaberegeln.ausnahmen":
      "Exception paths: admin marking and owner approval are single decisions. They appear in the audit trail as an exception, with person, time and version.",
    "freigaberegeln.pruefer.titel": "Reviewers under this rule",
    "freigaberegeln.pruefer.niemand": "Nobody can review under this rule.",
    "freigaberegeln.pruefer.vertretungBereit":
      "deputy on standby — decides only once the task is handed over",
    "freigaberegeln.weg.alle": "review right",
    "freigaberegeln.weg.konto": "named",
    "freigaberegeln.weg.team": "via team",
    "freigaberegeln.weg.vertretung": "deputy",
    "freigaberegeln.hindernis.inaktiv": "not active",
    "freigaberegeln.hindernis.ohne_pruefrecht": "without review right",
    "freigaberegeln.hindernis.ohne_spacezugang": "without access to the space",
    "freigaberegeln.fehlt.titel": "Missing prerequisites",
    "freigaberegeln.fehlt.keine_regel": "No own approval rule is set for this space.",
    "freigaberegeln.fehlt.space_archiviert":
      "The space is archived; the rule can only be changed after reopening it.",
    "freigaberegeln.fehlt.zuWenige":
      "Only {{berechtigt}} authorised active reviewers, {{erforderlich}} approvals required. Contributions stay in review until more reviewers are available.",
    "freigaberegeln.fehlt.ohneWirkung": "Named, but without effect: {{namen}}",
    "freigaberegeln.fehlt.vertretung": "Deputy {{durch}} for {{fuer}} has no effect: {{grund}}",
    "freigaberegeln.fehlt.team": "Team {{name}} is archived and contributes no reviewers.",
    "freigaberegeln.vorgaenge.titel": "Open and completed cases",
    "freigaberegeln.vorgaenge.keine": "There is no case in this space that you may see.",
    "freigaberegeln.vorgaenge.verborgen":
      "{{anzahl}} further cases are not visible to you and are only counted.",
    "freigaberegeln.vorgang.fassung": "Version {{version}}",
    "freigaberegeln.vorgang.offen":
      "{{gruen}} of {{erforderlich}} approvals · {{gelb}} queries · {{rot}} rejections — not yet approved",
    "freigaberegeln.vorgang.freigegeben":
      "Approved with {{gruen}} approvals ({{erforderlich}} required)",
    "freigaberegeln.vorgang.veraltet": "{{anzahl}} ratings of earlier versions do not count",
    "freigaberegeln.zustand.entwurf": "draft",
    "freigaberegeln.zustand.eingereicht": "submitted",
    "freigaberegeln.zustand.korrektur_noetig": "correction needed",
    "freigaberegeln.zustand.freigegeben": "professionally approved",
    "freigaberegeln.zustand.veroeffentlicht": "published",
    "freigaberegeln.luecke.zustimmungen": "{{anzahl}} approvals are still missing.",
    "freigaberegeln.luecke.ablehnung": "{{anzahl}} rejections of this version are open.",
    "freigaberegeln.luecke.unabhaengig":
      "Only {{verfuegbar}} independent reviewers available, {{erforderlich}} required.",
    "freigaberegeln.luecke.aufgabe": "Review task of {{name}} is overdue or orphaned.",
    "freigaberegeln.aufgabe.zeile": "Task: {{wer}} since {{seit}}",
    "freigaberegeln.aufgabe.faellig": "due {{zeit}}",
    "freigaberegeln.aufgabe.ueberfaellig": "overdue since {{zeit}}",
    "freigaberegeln.aufgabe.vertretung": "deputy for {{fuer}}",
    "freigaberegeln.aufgabe.inaktiv": "account not active",
    "freigaberegeln.entscheidung.zeile": "{{art}} · {{wer}} · {{zeit}} · version {{fassung}}",
    "freigaberegeln.entscheidung.zustimmung": "Approval",
    "freigaberegeln.entscheidung.rueckfrage": "Query",
    "freigaberegeln.entscheidung.ablehnung": "Rejection",
    "freigaberegeln.entscheidung.admin_kennzeichnung": "Admin marking",
    "freigaberegeln.entscheidung.eigentuemerfreigabe": "Owner approval",
    "freigaberegeln.entscheidung.aeltereFassung": "earlier version, does not count",
    "freigaberegeln.entscheidung.ausnahme": "exception",
    "freigaberegeln.entscheidung.selbst": "own contribution",
    "freigaberegeln.verlauf.titel": "Rule history",
    "freigaberegeln.verlauf.eintrag": "Space version {{version}} · {{zeit}} · {{wer}}",
    "freigaberegeln.verlauf.ohneRegel": "rule removed",
    "freigaberegeln.pflege.oeffnen": "Change rule …",
    "freigaberegeln.pflege.schliessen": "Close",
    "freigaberegeln.pflege.titel": "Change approval rule",
    "freigaberegeln.pflege.zustimmungen": "Required approvals",
    "freigaberegeln.pflege.pruefer": "Reviewers (accounts)",
    "freigaberegeln.pflege.prueferHinweis":
      "Without a selection, everyone with review rights and access reviews. Naming someone grants neither review rights nor access.",
    "freigaberegeln.pflege.teams": "Reviewer teams",
    "freigaberegeln.pflege.frist": "Deadline per review task in days (empty: none)",
    "freigaberegeln.pflege.vertretungen": "Deputies",
    "freigaberegeln.pflege.fuer": "Stand in for",
    "freigaberegeln.pflege.durch": "Deputy",
    "freigaberegeln.pflege.entfernen": "Remove",
    "freigaberegeln.pflege.vertretungHinzu": "Add deputy",
    "freigaberegeln.pflege.begruendung": "Reason (optional, shown in the history)",
    "freigaberegeln.pflege.pruefen": "Review effect",
    "freigaberegeln.pflege.erfolg":
      "The new rule applies. Open cases need at least the new number; granted approvals stay unchanged.",
    "freigaberegeln.vorschau.titel": "Effect before confirming",
    "freigaberegeln.vorschau.alt": "Before",
    "freigaberegeln.vorschau.neu": "After",
    "freigaberegeln.vorschau.aenderungen": "Changed: {{liste}}",
    "freigaberegeln.vorschau.laufend":
      "Open cases: {{gesamt}} — higher requirement: {{angehoben}}, lower: {{gesenkt}}, unchanged: {{unveraendert}}",
    "freigaberegeln.vorschau.vorgang":
      "{{titel}}: before {{bisher}}, after {{danach}} approvals required ({{gruen}} present)",
    "freigaberegeln.vorschau.schwelle":
      "reaches the number, but is only re-evaluated with the next decision",
    "freigaberegeln.vorschau.verborgen":
      "{{anzahl}} further open cases are not visible to you and are only counted.",
    "freigaberegeln.vorschau.freigegeben":
      "Granted approvals: {{anzahl}} — they stay as they are; nothing is approved or revoked retroactively.",
    "freigaberegeln.vorschau.prueferNeu": "Newly authorised to review: {{namen}}",
    "freigaberegeln.vorschau.prueferWeg": "No longer authorised to review: {{namen}}",
    "freigaberegeln.vorschau.prueferWegEintrag": "{{name}} ({{anzahl}} open tasks)",
    "freigaberegeln.vorschau.danachFehlt": "Missing afterwards:",
    "freigaberegeln.vorschau.bleibt":
      "The rule becomes a new version of the space. Content, versions of the contributions and earlier decisions stay unchanged.",
    "freigaberegeln.vorschau.uebernehmen": "Apply rule",
    "freigaberegeln.vorschau.abbrechen": "Cancel",
    "freigaberegeln.aenderung.neu": "first own rule",
    "freigaberegeln.aenderung.zustimmungen": "approvals",
    "freigaberegeln.aenderung.pruefer": "reviewers",
    "freigaberegeln.aenderung.teams": "reviewer teams",
    "freigaberegeln.aenderung.frist": "deadline",
    "freigaberegeln.aenderung.vertretung": "deputies",
    "freigaberegeln.frist.starten": "Check deadlines and deputies",
    "freigaberegeln.frist.ergebnis":
      "New deputy tasks: {{neu}} · already present: {{bestehend}} · overdue or orphaned: {{faellig}} · without deputy: {{ohne}}",
    "freigaberegeln.frist.neu": "{{titel}}: {{durch}} reviews instead of {{fuer}}",
    "freigaberegeln.frist.ohne": "{{titel}}: no suitable deputy is set for {{fuer}}",
    "freigaberegeln.frist.nichtEinsehbar": "A contribution not visible to you",
    "freigaberegeln.fehler.allgemein": "That did not work. Please try again.",
    "freigaberegeln.fehler.ungueltig":
      "This rule is not permitted: 1 to 5 approvals, deadline 1 to 90 days, only existing accounts and teams.",
    "freigaberegeln.fehler.vorschauVeraltet":
      "Cases, reviewers or rule have changed since the preview. Please review the new effect.",
    "freigaberegeln.fehler.veraltet": "The space has changed in the meantime. Please reload.",
    "freigaberegeln.fehler.archiviert":
      "This space is archived. Reopen it first, then change the rule.",
    "freigaberegeln.fehler.keineAenderung": "The rule matches the current one.",
    "freigaberegeln.fehler.recht": "You do not have the right to do this.",
  },
  nl: {
    "audit.action.space_freigaberegel_geaendert": "Vrijgaveregel gewijzigd",
    "audit.action.freigaberegel_ausnahme": "Vrijgave via uitzonderingsweg",
    "audit.action.freigaberegel_fristlauf": "Vervangingstaken uit termijn aangemaakt",
    "audit.action.ko_needed_validations_raised": "Vereiste goedkeuringen verhoogd",
    "freigaberegeln.titel": "Vrijgaveregel en controleverantwoordelijkheid",
    "freigaberegeln.erklaerung":
      "Wie bijdragen in deze space mag controleren, hoeveel goedkeuringen nodig zijn en wat nog ontbreekt. Dit vlak geeft niets vrij — er wordt beslist in het controlegedeelte, en de server controleert daar de regel.",
    "freigaberegeln.laedt": "Vrijgaveregel wordt geladen …",
    "freigaberegeln.erneut": "Opnieuw proberen",
    "freigaberegeln.regel.standard":
      "Geen eigen regel: de standaard geldt — {{anzahl}} goedkeuringen van personen met controlerecht die de inhoud mogen zien.",
    "freigaberegeln.regel.zustimmungen":
      "Vereist: {{anzahl}} goedkeuringen van de huidige versie, geen afwijzing",
    "freigaberegeln.regel.gruppe": "Controleursgroep: {{namen}}",
    "freigaberegeln.regel.alle":
      "Controleursgroep: iedereen met controlerecht en toegang tot de space",
    "freigaberegeln.regel.team": "Team {{name}}",
    "freigaberegeln.regel.frist": "Termijn per controletaak: {{tage}} dagen",
    "freigaberegeln.regel.keineFrist": "Geen termijn",
    "freigaberegeln.regel.vertretung": "Vervanging: {{liste}}",
    "freigaberegeln.regel.vertretungEintrag": "{{durch}} vervangt {{fuer}}",
    "freigaberegeln.regel.keineVertretung": "Geen vervanging",
    "freigaberegeln.schritte.titel": "Stappen tot publicatie",
    "freigaberegeln.schritte.einreichen": "Concept indienen — pas dan is het een controlezaak.",
    "freigaberegeln.schritte.zustimmungen":
      "{{anzahl}} goedkeuringen van bevoegde controleurs van de huidige versie.",
    "freigaberegeln.schritte.keine_ablehnung": "Geen openstaande afwijzing van deze versie.",
    "freigaberegeln.schritte.freigabe":
      "Inhoudelijk vrijgegeven — pas als alle goedkeuringen er zijn; één goedkeuring is geen vrijgave.",
    "freigaberegeln.schritte.veroeffentlichen":
      "Publiceren is een aparte stap en veronderstelt de vrijgave.",
    "freigaberegeln.selbstpruefung":
      "Niemand controleert de eigen bijdrage — ook geen beheerder (vier-ogenprincipe).",
    "freigaberegeln.ausnahmen":
      "Uitzonderingswegen: beheerdersmarkering en eigenaarsvrijgave zijn losse beslissingen. Ze staan met persoon, tijdstip en versie als uitzondering in het logboek.",
    "freigaberegeln.pruefer.titel": "Controleurs volgens deze regel",
    "freigaberegeln.pruefer.niemand": "Niemand kan volgens deze regel controleren.",
    "freigaberegeln.pruefer.vertretungBereit":
      "vervanging paraat — beslist pas als de taak is overgedragen",
    "freigaberegeln.weg.alle": "controlerecht",
    "freigaberegeln.weg.konto": "genoemd",
    "freigaberegeln.weg.team": "via team",
    "freigaberegeln.weg.vertretung": "vervanging",
    "freigaberegeln.hindernis.inaktiv": "niet actief",
    "freigaberegeln.hindernis.ohne_pruefrecht": "zonder controlerecht",
    "freigaberegeln.hindernis.ohne_spacezugang": "zonder toegang tot de space",
    "freigaberegeln.fehlt.titel": "Ontbrekende voorwaarden",
    "freigaberegeln.fehlt.keine_regel": "Voor deze space is geen eigen vrijgaveregel vastgelegd.",
    "freigaberegeln.fehlt.space_archiviert":
      "De space is gearchiveerd; de regel kan pas na heropening worden gewijzigd.",
    "freigaberegeln.fehlt.zuWenige":
      "Slechts {{berechtigt}} bevoegde actieve controleurs, {{erforderlich}} goedkeuringen vereist. Bijdragen blijven in controle tot er meer controleurs beschikbaar zijn.",
    "freigaberegeln.fehlt.ohneWirkung": "Genoemd, maar zonder effect: {{namen}}",
    "freigaberegeln.fehlt.vertretung": "Vervanging {{durch}} voor {{fuer}} werkt niet: {{grund}}",
    "freigaberegeln.fehlt.team": "Team {{name}} is gearchiveerd en levert geen controleurs.",
    "freigaberegeln.vorgaenge.titel": "Lopende en afgeronde zaken",
    "freigaberegeln.vorgaenge.keine": "In deze space is er geen zaak die je mag zien.",
    "freigaberegeln.vorgaenge.verborgen":
      "{{anzahl}} andere zaken zijn voor jou niet zichtbaar en tellen alleen mee.",
    "freigaberegeln.vorgang.fassung": "Versie {{version}}",
    "freigaberegeln.vorgang.offen":
      "{{gruen}} van {{erforderlich}} goedkeuringen · {{gelb}} vragen · {{rot}} afwijzingen — nog niet vrijgegeven",
    "freigaberegeln.vorgang.freigegeben":
      "Vrijgegeven met {{gruen}} goedkeuringen ({{erforderlich}} vereist)",
    "freigaberegeln.vorgang.veraltet": "{{anzahl}} beoordelingen van eerdere versies tellen niet",
    "freigaberegeln.zustand.entwurf": "concept",
    "freigaberegeln.zustand.eingereicht": "ingediend",
    "freigaberegeln.zustand.korrektur_noetig": "correctie nodig",
    "freigaberegeln.zustand.freigegeben": "inhoudelijk vrijgegeven",
    "freigaberegeln.zustand.veroeffentlicht": "gepubliceerd",
    "freigaberegeln.luecke.zustimmungen": "Er ontbreken nog {{anzahl}} goedkeuringen.",
    "freigaberegeln.luecke.ablehnung": "{{anzahl}} afwijzingen van deze versie staan open.",
    "freigaberegeln.luecke.unabhaengig":
      "Slechts {{verfuegbar}} onafhankelijke controleurs beschikbaar, {{erforderlich}} vereist.",
    "freigaberegeln.luecke.aufgabe": "Controletaak van {{name}} is verlopen of verweesd.",
    "freigaberegeln.aufgabe.zeile": "Taak: {{wer}} sinds {{seit}}",
    "freigaberegeln.aufgabe.faellig": "vervalt {{zeit}}",
    "freigaberegeln.aufgabe.ueberfaellig": "verlopen sinds {{zeit}}",
    "freigaberegeln.aufgabe.vertretung": "vervanging voor {{fuer}}",
    "freigaberegeln.aufgabe.inaktiv": "account niet actief",
    "freigaberegeln.entscheidung.zeile": "{{art}} · {{wer}} · {{zeit}} · versie {{fassung}}",
    "freigaberegeln.entscheidung.zustimmung": "Goedkeuring",
    "freigaberegeln.entscheidung.rueckfrage": "Vraag",
    "freigaberegeln.entscheidung.ablehnung": "Afwijzing",
    "freigaberegeln.entscheidung.admin_kennzeichnung": "Beheerdersmarkering",
    "freigaberegeln.entscheidung.eigentuemerfreigabe": "Eigenaarsvrijgave",
    "freigaberegeln.entscheidung.aeltereFassung": "eerdere versie, telt niet",
    "freigaberegeln.entscheidung.ausnahme": "uitzondering",
    "freigaberegeln.entscheidung.selbst": "eigen bijdrage",
    "freigaberegeln.verlauf.titel": "Geschiedenis van de regel",
    "freigaberegeln.verlauf.eintrag": "Spaceversie {{version}} · {{zeit}} · {{wer}}",
    "freigaberegeln.verlauf.ohneRegel": "regel verwijderd",
    "freigaberegeln.pflege.oeffnen": "Regel wijzigen …",
    "freigaberegeln.pflege.schliessen": "Sluiten",
    "freigaberegeln.pflege.titel": "Vrijgaveregel wijzigen",
    "freigaberegeln.pflege.zustimmungen": "Vereiste goedkeuringen",
    "freigaberegeln.pflege.pruefer": "Controleurs (accounts)",
    "freigaberegeln.pflege.prueferHinweis":
      "Zonder selectie controleert iedereen met controlerecht en toegang. Een vermelding geeft geen controlerecht en geen toegang.",
    "freigaberegeln.pflege.teams": "Controleursteams",
    "freigaberegeln.pflege.frist": "Termijn per controletaak in dagen (leeg: geen)",
    "freigaberegeln.pflege.vertretungen": "Vervangingen",
    "freigaberegeln.pflege.fuer": "Wordt vervangen",
    "freigaberegeln.pflege.durch": "Vervangen door",
    "freigaberegeln.pflege.entfernen": "Verwijderen",
    "freigaberegeln.pflege.vertretungHinzu": "Vervanging toevoegen",
    "freigaberegeln.pflege.begruendung": "Reden (optioneel, staat in de geschiedenis)",
    "freigaberegeln.pflege.pruefen": "Effect bekijken",
    "freigaberegeln.pflege.erfolg":
      "De nieuwe regel geldt. Lopende zaken hebben minstens het nieuwe aantal nodig; verleende vrijgaven blijven ongewijzigd.",
    "freigaberegeln.vorschau.titel": "Effect vóór bevestiging",
    "freigaberegeln.vorschau.alt": "Vooraf",
    "freigaberegeln.vorschau.neu": "Daarna",
    "freigaberegeln.vorschau.aenderungen": "Gewijzigd: {{liste}}",
    "freigaberegeln.vorschau.laufend":
      "Lopende zaken: {{gesamt}} — hogere eis: {{angehoben}}, lagere: {{gesenkt}}, ongewijzigd: {{unveraendert}}",
    "freigaberegeln.vorschau.vorgang":
      "{{titel}}: vooraf {{bisher}}, daarna {{danach}} goedkeuringen vereist ({{gruen}} aanwezig)",
    "freigaberegeln.vorschau.schwelle":
      "bereikt het aantal, maar wordt pas bij de volgende beslissing opnieuw beoordeeld",
    "freigaberegeln.vorschau.verborgen":
      "{{anzahl}} andere lopende zaken zijn voor jou niet zichtbaar en tellen alleen mee.",
    "freigaberegeln.vorschau.freigegeben":
      "Verleende vrijgaven: {{anzahl}} — ze blijven zoals ze zijn; niets wordt met terugwerkende kracht vrijgegeven of ingetrokken.",
    "freigaberegeln.vorschau.prueferNeu": "Nieuw bevoegd om te controleren: {{namen}}",
    "freigaberegeln.vorschau.prueferWeg": "Niet langer bevoegd om te controleren: {{namen}}",
    "freigaberegeln.vorschau.prueferWegEintrag": "{{name}} ({{anzahl}} open taken)",
    "freigaberegeln.vorschau.danachFehlt": "Daarna ontbreekt:",
    "freigaberegeln.vorschau.bleibt":
      "De regel wordt een nieuwe versie van de space. Inhoud, versies van de bijdragen en eerdere beslissingen blijven ongewijzigd.",
    "freigaberegeln.vorschau.uebernehmen": "Regel toepassen",
    "freigaberegeln.vorschau.abbrechen": "Annuleren",
    "freigaberegeln.aenderung.neu": "eerste eigen regel",
    "freigaberegeln.aenderung.zustimmungen": "goedkeuringen",
    "freigaberegeln.aenderung.pruefer": "controleurs",
    "freigaberegeln.aenderung.teams": "controleursteams",
    "freigaberegeln.aenderung.frist": "termijn",
    "freigaberegeln.aenderung.vertretung": "vervanging",
    "freigaberegeln.frist.starten": "Termijnen en vervangingen controleren",
    "freigaberegeln.frist.ergebnis":
      "Nieuwe vervangingstaken: {{neu}} · al aanwezig: {{bestehend}} · verlopen of verweesd: {{faellig}} · zonder vervanging: {{ohne}}",
    "freigaberegeln.frist.neu": "{{titel}}: {{durch}} controleert in plaats van {{fuer}}",
    "freigaberegeln.frist.ohne": "{{titel}}: voor {{fuer}} is geen geschikte vervanging vastgelegd",
    "freigaberegeln.frist.nichtEinsehbar": "Een bijdrage die voor jou niet zichtbaar is",
    "freigaberegeln.fehler.allgemein": "Dat is niet gelukt. Probeer het opnieuw.",
    "freigaberegeln.fehler.ungueltig":
      "Deze regel is niet toegestaan: 1 tot 5 goedkeuringen, termijn 1 tot 90 dagen, alleen bestaande accounts en teams.",
    "freigaberegeln.fehler.vorschauVeraltet":
      "Zaken, controleurs of regel zijn sinds de voorvertoning gewijzigd. Controleer het nieuwe effect.",
    "freigaberegeln.fehler.veraltet": "De space is intussen gewijzigd. Laad opnieuw.",
    "freigaberegeln.fehler.archiviert":
      "Deze space is gearchiveerd. Eerst heropenen, dan de regel wijzigen.",
    "freigaberegeln.fehler.keineAenderung": "De regel komt overeen met de geldende.",
    "freigaberegeln.fehler.recht": "Daarvoor ontbreekt je het recht.",
  },
} satisfies Textmodul;
