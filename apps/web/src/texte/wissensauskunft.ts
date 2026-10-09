// ================================================================================================
// WISSENSAUSKUNFT · die Texte der Auskunft „Wer hat was gewusst und wann" (R-1644).
// ================================================================================================
//
// Die Texte sagen nur, was belegt ist, und nennen ausdrücklich, was die Auskunft NICHT belegen
// kann: bloßes Öffnen wird nicht mitgeschrieben, und ein fehlender Beleg heißt nicht „nicht gesehen".
import type { Textmodul } from "./intern/pruefung";

export default {
  praefix: "wissensauskunft.",
  legacySchluessel: [],
  de: {
    "wissensauskunft.titel": "Wer wusste was wann",
    "wissensauskunft.einleitung":
      "Zeigt für einen Zeitpunkt, welche Fassung dieses Eintrags damals galt und wer bis dahin nachweislich damit zu tun hatte.",
    "wissensauskunft.zeitpunkt": "Zeitpunkt",
    "wissensauskunft.abfragen": "Auskunft abrufen",
    "wissensauskunft.laeuft": "Wird abgerufen …",
    "wissensauskunft.stand": "Stand am {{datum}}",
    "wissensauskunft.nichtVorhanden": "Diesen Eintrag gab es zu diesem Zeitpunkt noch nicht.",
    "wissensauskunft.papierkorb": "Der Eintrag lag zu diesem Zeitpunkt im Papierkorb.",
    "wissensauskunft.fassung": "Damals galt Fassung V{{version}} — seit {{datum}}, von {{name}}.",
    "wissensauskunft.keineFassung": "Für diesen Zeitpunkt ist keine Fassung gespeichert.",
    "wissensauskunft.freigabe": "Freigabe dieser Fassung belegt am {{datum}} durch {{name}}.",
    "wissensauskunft.keineFreigabe": "Für diese Fassung ist bis dahin keine Freigabe belegt.",
    "wissensauskunft.heute": "Heute gilt Fassung V{{version}}.",
    "wissensauskunft.personen": "Belegt bis zu diesem Zeitpunkt",
    "wissensauskunft.keinePersonen":
      "Bis zu diesem Zeitpunkt ist keine Person mit einem Beleg verzeichnet.",
    "wissensauskunft.beleg.fassung": "V{{fassung}}",
    "wissensauskunft.beleg.zurueckgenommen": "zurückgenommen, nicht wirksam geblieben",
    "wissensauskunft.art.angelegt": "angelegt",
    "wissensauskunft.art.ueberarbeitet": "überarbeitet",
    "wissensauskunft.art.vorgeschlagen": "Änderung vorgeschlagen",
    "wissensauskunft.art.kommentiert": "kommentiert",
    "wissensauskunft.art.geprueft": "geprüft",
    "wissensauskunft.art.freigegeben": "freigegeben",
    "wissensauskunft.art.antwortquelle": "als Quelle einer Antwort erhalten",
    "wissensauskunft.art.kenntnisnahme_verteilt": "Kenntnisnahme angefordert (bei anderen)",
    "wissensauskunft.art.kenntnisnahme_angefordert":
      "zur Kenntnisnahme aufgefordert, nicht bestätigt",
    "wissensauskunft.art.kenntnisnahme_bestaetigt": "Kenntnisnahme bestätigt",
    "wissensauskunft.art.sonstige_bearbeitung": "sonstige Bearbeitung",
    "wissensauskunft.grenzen": "Was diese Auskunft nicht belegt",
    "wissensauskunft.grenze.oeffnen":
      "Bloßes Öffnen oder Lesen wird nicht protokolliert. Fehlt eine Person, heißt das nicht, dass sie den Eintrag nicht gesehen hat.",
    "wissensauskunft.grenze.pruefstatus":
      "Der Prüfstatus wird nicht je Zeitpunkt gespeichert; belegt sind Freigaben und Prüfungen.",
    "wissensauskunft.grenze.antwortquellen":
      "Aus Antworten ist nur die jeweils erste Quelle protokolliert, ohne ihre Fassung.",
    "wissensauskunft.fehler.zeitpunkt_ungueltig": "Bitte einen gültigen Zeitpunkt wählen.",
    "wissensauskunft.fehler.zeitpunkt_zukunft": "Der Zeitpunkt darf nicht in der Zukunft liegen.",
    "wissensauskunft.fehler.allgemein": "Die Auskunft konnte nicht abgerufen werden.",
  },
  en: {
    "wissensauskunft.titel": "Who knew what and when",
    "wissensauskunft.einleitung":
      "Shows, for a point in time, which version of this entry applied then and who had demonstrably dealt with it up to then.",
    "wissensauskunft.zeitpunkt": "Point in time",
    "wissensauskunft.abfragen": "Get report",
    "wissensauskunft.laeuft": "Loading …",
    "wissensauskunft.stand": "As of {{datum}}",
    "wissensauskunft.nichtVorhanden": "This entry did not exist yet at that point in time.",
    "wissensauskunft.papierkorb": "The entry was in the trash at that point in time.",
    "wissensauskunft.fassung": "Version V{{version}} applied then — since {{datum}}, by {{name}}.",
    "wissensauskunft.keineFassung": "No version is stored for this point in time.",
    "wissensauskunft.freigabe": "Approval of this version recorded on {{datum}} by {{name}}.",
    "wissensauskunft.keineFreigabe": "No approval of this version is recorded up to then.",
    "wissensauskunft.heute": "Version V{{version}} applies today.",
    "wissensauskunft.personen": "Recorded up to this point in time",
    "wissensauskunft.keinePersonen": "No person with a record is listed up to this point in time.",
    "wissensauskunft.beleg.fassung": "V{{fassung}}",
    "wissensauskunft.beleg.zurueckgenommen": "rolled back, did not take effect",
    "wissensauskunft.art.angelegt": "created",
    "wissensauskunft.art.ueberarbeitet": "revised",
    "wissensauskunft.art.vorgeschlagen": "proposed a change",
    "wissensauskunft.art.kommentiert": "commented",
    "wissensauskunft.art.geprueft": "reviewed",
    "wissensauskunft.art.freigegeben": "approved",
    "wissensauskunft.art.antwortquelle": "received as the source of an answer",
    "wissensauskunft.art.kenntnisnahme_verteilt": "requested acknowledgement (from others)",
    "wissensauskunft.art.kenntnisnahme_angefordert": "asked to acknowledge, not confirmed",
    "wissensauskunft.art.kenntnisnahme_bestaetigt": "acknowledgement confirmed",
    "wissensauskunft.art.sonstige_bearbeitung": "other change",
    "wissensauskunft.grenzen": "What this report does not show",
    "wissensauskunft.grenze.oeffnen":
      "Merely opening or reading is not logged. If a person is missing, that does not mean they did not see the entry.",
    "wissensauskunft.grenze.pruefstatus":
      "The review status is not stored per point in time; approvals and reviews are recorded.",
    "wissensauskunft.grenze.antwortquellen":
      "For answers, only the first source of each answer is logged, without its version.",
    "wissensauskunft.fehler.zeitpunkt_ungueltig": "Please choose a valid point in time.",
    "wissensauskunft.fehler.zeitpunkt_zukunft": "The point in time must not be in the future.",
    "wissensauskunft.fehler.allgemein": "The report could not be loaded.",
  },
  nl: {
    "wissensauskunft.titel": "Wie wist wat en wanneer",
    "wissensauskunft.einleitung":
      "Toont voor een tijdstip welke versie van dit item toen gold en wie er tot dan aantoonbaar mee te maken had.",
    "wissensauskunft.zeitpunkt": "Tijdstip",
    "wissensauskunft.abfragen": "Overzicht opvragen",
    "wissensauskunft.laeuft": "Wordt opgevraagd …",
    "wissensauskunft.stand": "Stand op {{datum}}",
    "wissensauskunft.nichtVorhanden": "Dit item bestond op dat tijdstip nog niet.",
    "wissensauskunft.papierkorb": "Het item lag op dat tijdstip in de prullenbak.",
    "wissensauskunft.fassung": "Toen gold versie V{{version}} — sinds {{datum}}, door {{name}}.",
    "wissensauskunft.keineFassung": "Voor dit tijdstip is geen versie opgeslagen.",
    "wissensauskunft.freigabe": "Vrijgave van deze versie vastgelegd op {{datum}} door {{name}}.",
    "wissensauskunft.keineFreigabe": "Voor deze versie is tot dan geen vrijgave vastgelegd.",
    "wissensauskunft.heute": "Vandaag geldt versie V{{version}}.",
    "wissensauskunft.personen": "Vastgelegd tot dit tijdstip",
    "wissensauskunft.keinePersonen": "Tot dit tijdstip staat geen persoon met een bewijs vermeld.",
    "wissensauskunft.beleg.fassung": "V{{fassung}}",
    "wissensauskunft.beleg.zurueckgenommen": "teruggedraaid, niet van kracht gebleven",
    "wissensauskunft.art.angelegt": "aangemaakt",
    "wissensauskunft.art.ueberarbeitet": "bewerkt",
    "wissensauskunft.art.vorgeschlagen": "wijziging voorgesteld",
    "wissensauskunft.art.kommentiert": "becommentarieerd",
    "wissensauskunft.art.geprueft": "gecontroleerd",
    "wissensauskunft.art.freigegeben": "vrijgegeven",
    "wissensauskunft.art.antwortquelle": "als bron van een antwoord ontvangen",
    "wissensauskunft.art.kenntnisnahme_verteilt": "kennisname aangevraagd (bij anderen)",
    "wissensauskunft.art.kenntnisnahme_angefordert": "om kennisname gevraagd, niet bevestigd",
    "wissensauskunft.art.kenntnisnahme_bestaetigt": "kennisname bevestigd",
    "wissensauskunft.art.sonstige_bearbeitung": "overige wijziging",
    "wissensauskunft.grenzen": "Wat dit overzicht niet aantoont",
    "wissensauskunft.grenze.oeffnen":
      "Alleen openen of lezen wordt niet vastgelegd. Ontbreekt een persoon, dan betekent dat niet dat die het item niet heeft gezien.",
    "wissensauskunft.grenze.pruefstatus":
      "De controlestatus wordt niet per tijdstip opgeslagen; vrijgaven en controles zijn vastgelegd.",
    "wissensauskunft.grenze.antwortquellen":
      "Bij antwoorden is alleen de eerste bron van elk antwoord vastgelegd, zonder versie.",
    "wissensauskunft.fehler.zeitpunkt_ungueltig": "Kies een geldig tijdstip.",
    "wissensauskunft.fehler.zeitpunkt_zukunft": "Het tijdstip mag niet in de toekomst liggen.",
    "wissensauskunft.fehler.allgemein": "Het overzicht kon niet worden opgevraagd.",
  },
} satisfies Textmodul;
