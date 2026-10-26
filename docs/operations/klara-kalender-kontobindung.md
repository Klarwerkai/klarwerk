# Kalenderfreigabe an Konto-IDs

Die Betreiber-Einspeisung verwendet ausschließlich KLARWERK_KALENDER_M365_KONTO_IDS: eine kommagetrennte Liste der unveränderlichen Klarwerk-Konto-IDs. Eine Mailadresse, ein SSO-Subjekt oder die alte KLARWERK_KALENDER_M365_KONTEN-Liste erteilt keine Freigabe. Bestehende Listen müssen ausdrücklich durch bestätigte Konto-IDs ersetzt werden; sonst bleibt der Kalender nicht verbunden. Es gibt keinen Adress- oder Tenant-Fallback. BASE_URL und TOKEN bleiben die vorhandenen Betreiberwerte.

Eine neue persönliche Mailadresse wird im Profil erst nach einmaliger Bestätigung an genau diese neue Adresse wirksam. Die Bestätigung ist 15 Minuten gültig, an das angemeldete Konto sowie die bisherige und neue Adresse gebunden und nur über die normale Bestätigungsmail erreichbar. Name, Rollen, Identitätsbindung und vorhandene Sitzung bleiben erhalten.

Ohne versandfähigen Mailer oder bekannte Instanzadresse bleibt die Adressänderung gesperrt. Ein reiner Konsolen-Mailer genügt nicht als Eigentumsnachweis.
