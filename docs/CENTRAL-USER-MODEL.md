# Zentrales Benutzermodell – Integrationslücken

Stand: 16.10.2026. Maßgeblicher vorhandener Vertrag:
[AUTH_API_CONTRACT.md](AUTH_API_CONTRACT.md), Stand 15.10.2026.
Dieser beschreibt noch **nicht** das angeforderte zentrale Benutzermodell.
Die lokalen Backend-Checkouts enthalten ebenfalls keine passende Kontaktprofil-API.
Der Benutzer hat bestätigt: Der neue Vertrag wird erst nach Backend-Implementierung
in `tschanni/Gameserver_Dashboard`, Branch `main`, Datei
`docs/AUTH_API_CONTRACT.md` bereitgestellt. Die konkrete API-Integration wartet
auf diesen Vertrag und die zugehörige Commit-ID.

## Vor Implementierung durch das Backend zu bestätigen

| Bereich | Benötigter Vertrag | Vorhandener Stand |
| --- | --- | --- |
| Registrierung | Benutzername als Better Auth `name`, E-Mail, Passwort; keine Personen-/Kontaktdaten; gleiche Namen erlaubt | `name` und eindeutiger, normalisierter `username` erforderlich |
| Session | `user.id`, `user.name`, E-Mail, Verifikationsstatus, Rolle und Ablaufdatum | `name` ist bereits dokumentiert; separater `username` entfällt im Zielmodell |
| Kontakt lesen | Exakte Methode, URL und Response für das eigene optionale Kontaktprofil | Kein Endpunkt dokumentiert |
| Kontakt speichern | Exakte Methode, URL, Body und Response; Vorname, Nachname, Straße, Hausnummer, Postleitzahl, Ort | Kein Endpunkt dokumentiert |
| Leerwerte | Regeln für fehlende Felder, leere Strings und `null`; Löschen bereits gespeicherter Werte; vollständiges Ersetzen oder Teiländerung | Unbekannt |
| Validierung | Feldnamen, erlaubte Länge/Zeichen, Status und maschinenlesbare Feldfehler; keine Pflicht-Kontaktdaten | Unbekannt |
| Eigentum | Backend bestimmt Benutzer ausschließlich aus Cookie-Session; kein Schreiben/Lesen fremder Profile durch übergebene Benutzer-ID | Nachzuweisen, einschließlich negativer Integrationstests |
| Registrierung/Migration | Entfernung der Username-Eindeutigkeit und des Plugins/alter Schreibrechte; Verhalten bestehender und Discord-Konten | Noch zu bestätigen |

Es werden ausdrücklich keine Kontakt-URLs, JSON-Feldnamen oder Längenlimits
als bereits implementierte Backend-Fakten festgelegt. Erforderlich sind Beispiele
für Erfolg, Feldvalidierung, 401, 403 und 5xx sowie Backend-Tests für Eigentum,
vollständig leere Kontakte und zwei Konten mit demselben Namen.

## Frontend bis zur Vertragsaktualisierung

Die Registrierung zeigt die Zielfelder, bleibt beim produktiven Adapter jedoch
gesperrt. Auch direkte Adapter-Aufrufe senden keine alte Registrierung mehr.
Das optionale Kontaktformular zeigt alle sechs Felder deaktiviert mit Hinweis.
Es liest/speichert keine Kontaktdaten und behauptet keinen Speichererfolg.
Login, Discord, E-Mail-Bestätigung und Passwort-Reset verwenden weiter die
bestätigten Endpunkte. Anzeigen verwenden `user.name`; der Name ist nicht editierbar.

## Cookies, CORS und Fehler

Weiterhin `credentials: include`, `cache: no-store`, keine Bearer-Tokens oder
Sessiondaten im Browser-Speicher. Produktion: HTTPS für Frontend und API,
host-only HttpOnly/Secure-Cookie auf `api.mueller-it-mkk.de`, SameSite=Lax.
Beide HTTPS-Subdomains sind same-site. CORS muss die konkrete Frontend-Origin
und Credentials erlauben, einschließlich OPTIONS/Content-Type bei JSON-POSTs;
keine Wildcard. Trusted Origins und Callback-URLs müssen übereinstimmen.
Retry-After-Header müssen bei Cross-Origin-Zugriff exponiert werden.
Andere Hosting-Domains benötigen eine separat bestätigte Cookie-Konfiguration.

Transportfehler (einschließlich vom Browser verborgener CORS-Fehler), HTTP-5xx,
HTTP-401 und bestätigtes Session-Ende erhalten verschiedene Hinweise.
Ein Transport-/Serverfehler entfernt eine bekannte, noch nicht abgelaufene
Session nicht. Nach Reload wird ausschließlich per Cookie wiederhergestellt.
Ohne bestätigte Session bleibt bei Fehlern der Status ungeprüft/nicht verfügbar.
Ein 200 `null`, explizites SESSION_EXPIRED oder erreichtes Ablaufdatum beendet
die lokale Session. Ein 401 bei Session-/geschützten Anfragen verlangt Login.

Kein Deployment ohne separate Freigabe. Die bestehende Main-Push-Pipeline
veröffentlicht automatisch; deshalb gehört auch ein Push nach Main nicht zur
lokalen Umsetzung.
