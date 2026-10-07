# Akquise-Cockpit

Eigene App zur Kundengewinnung für Matrix Architekt: Kontakte mit Status-Pipeline, Postsendungen mit
Kosten und Ablauf, Brief- und E-Mail-Vorlagen, Nachfassen per Gmail-Entwurf, Auswertung je Sendung.

Läuft als privates Claude-Artefakt mit Datenspeicher (`db`), Download (`downloads`) und Gmail (`mcp`).
Ohne diese Laufzeit (z. B. als lokale Datei) speichert die Seite nur im Browser (localStorage).

- Adressrecherche: Claude im Chat bitten, z. B. „Recherchiere 50 Architekturbüros in Oberbayern".
  Claude schreibt die Treffer per ArtifactData in die Sammlung `kontakte` (Status `recherchiert`).
- CSV-Export der Kontakte passt direkt zu `post/briefe-generieren.js`.
- E-Mails nur an Kontakte mit Antwort oder Einwilligung (§ 7 UWG); das Cockpit erzwingt das.

Datenmodell: `kontakte/<id>`, `kampagnen/<id>`, `vorlagen/brief`, `vorlagen/mail`.
