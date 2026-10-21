# FRONTEND-CODEX-ÜBERGABE AN CHATGPT – MINECRAFT-WHITELIST

**Nachtrag:** Der hier beschriebene Avatar-Übergang und der vorgeschlagene Proxy-Vertrag wurden durch die [Avatar-Proxy-Umstellung](MINECRAFT_AVATAR_PROXY_HANDOFF.md) abgelöst. Die folgenden Angaben dokumentieren den damaligen Whitelist-Commit.

Stand: 21.10.2026. Repository: tschanni/mueller-it-mkk.
Ausgangscommit: a7da57bc011e5afa14e70919a5fbf16172e802ca.
Implementierungscommit: siehe Commit dieser Datei (`git log -1 --format=%H -- docs/MINECRAFT_WHITELIST_HANDOFF.md`).
Backend-Vertrag laut Auftrag: d8a5a0f15c72c3c171c94559279b54717f87dda9, noch nicht produktiv deployed.
Keine Veröffentlichung, kein Push und kein produktives Deployment durchgeführt.

## Aktivierung und UI

`REACT_APP_MINECRAFT_LIVE_WHITELIST` ist standardmäßig deaktiviert; `.env.example` enthält `false`.
Erst nach Backend-Deployment und gemeinsamer Freigabe beim Build auf `true` setzen.
Ohne Aktivierung bleibt der bisherige Whitelist-Ablauf aktiv und die neuen Lese-Endpunkte werden nicht aufgerufen.

Bei Aktivierung ist ausschließlich GET `/whitelist-status` für die neue Statusanzeige maßgeblich:

- WHITELISTED: bestehender Checkmark-Erfolgsdialog, vollständige Liste einschließlich manuell hinzugefügter Spieler, UUID-basierte Kopf-Avatare, Benutzername, „Du“, Anzahl. Freischaltungsschritte ausgeblendet.
- NOT_WHITELISTED: bisherige Discord-, Profil- und Freischaltungsprüfungen bleiben erhalten; keine vollständige Liste laden.
- Nicht verknüpft: bestehende Verknüpfung anbieten; keine Liste laden.
- UNKNOWN/RCON-Ausfall: keine Erfolgsmeldung; bei bestehender Verknüpfung keine erneute Registrierung anbieten; „Erneut prüfen“.
- Leere Liste: verständlicher Leerzustand mit Anzahl null.
- Manuelle Aktualisierung über „Status aktualisieren“; nach Schreibaktionen Status und Liste erneut prüfen. Während Aktionen werden private Listendaten ausgeblendet und laufende Leseanfragen abgebrochen.
- 401/403 entfernen Liste und Berechtigungsbestätigung; 403 prüft den eigenen Status erneut, ohne die Liste automatisch erneut anzufordern. Fehler ohne code/JSON, 429, 500/503 und Netzwerkfehler sind berücksichtigt.
- Der vorhandene Auth-Gate entfernt die Ansicht bei Logout, Benutzerwechsel oder unbestätigter E-Mail. AbortController plus Generationsprüfung verwerfen verspätete Antworten. Kein lokaler Speicher und kein persistenter Listen-Cache.

## API

Basis: `${apiBase}/api/v1/me/minecraft`, einschließlich Deployment-Präfix wie `/games`.
Neue GETs: `/whitelist-status`, `/whitelist`. Cookie-Session: `credentials: include`, `cache: no-store`, `redirect: error`, Timeout und Abbruch.
GET `/whitelist` wird nur nach bestätigtem WHITELISTED angefragt. Backend bleibt für E-Mail, `services:use`, Verknüpfung und tatsächliche Whitelist-Zugehörigkeit verantwortlich.
Bestehende GET-Basis sowie POST `/link`, `/unlink`, `/check-discord`, `/whitelist` bleiben erhalten. Kein automatisches Wiederholen von Schreibbefehlen.

## Avatar-Prüfung und Übergang

Die bisherigen Profil- und Bild-Blob-Anfragen verwendeten optional einen Browser-API-Key. Dieser Schlüsselpfad wurde entfernt, ebenso die Schlüsselkonfiguration aus `.env.example` und der lokalen `.env.local`, soweit vorhanden. Ein zuvor eingecheckter Beispielschlüssel sollte vom Betreiber beim Anbieter widerrufen werden.

`MinecraftHead` ist jetzt die gemeinsame Komponente für Profil und Liste. UUIDs werden normalisiert und validiert. Übergangsweise bleibt ausschließlich der bereits vorhandene öffentliche, schlüssellose `https://mc-api.io/render/FACE/{uuid}?size=64`-Bildpfad erhalten. Keine neuen externen Anbieter, keine Übernahme des Backend-Felds `avatarUrl`, keine Profilauflösung oder API-Key-Header im Browser. Profilnamen stammen aus dem bestehenden Backend-Status; Listennamen aus der Live-Liste. Der bisherige lokale Profil-Icon-Fallback wird für ungültige UUIDs und Bildfehler verwendet. Das bestehende FACE-Rendering und seine äußere Skin-Ebene bleiben im Übergang beim bisherigen Renderer; die CSS-Darstellung bleibt erhalten.

In `.backend-contract/src` und `.backend-oidc-work/src` wurde kein Minecraft-Avatar-Proxy gefunden. Der übergebene Backend-Commit ist im lokalen `.backend-contract`-Objektspeicher nicht vorhanden. Deshalb ist keine Aussage über zusätzliche, nicht vorliegende Backend-Änderungen möglich. `/me/avatar` wird nicht verwendet.

**Vollständige Umstellung auf Backend-Avatare: blockiert bis ein geeigneter Backend-Endpunkt verfügbar und getestet ist.** Der Resolver `minecraftHeadUrl` bildet die zentrale Austauschstelle. Bei Cookie-geschütztem Cross-Origin-Proxy muss die Komponente zusätzlich einen internen Fetch-/Blob-Pfad mit `credentials: include`, Abbruch und Object-URL-Freigabe erhalten; keine Secrets im Frontend.

### Benötigter Backend-Vertrag (Vorschlag, kein existierender Endpunkt)

- Vorgeschlagene URL: GET `${URL_PATH_PREFIX}/api/v1/me/minecraft/avatars/:uuid?size=64`. Mit dem Backend abstimmen, bevor sie im Frontend verwendet wird.
- Authentifizierung: Better-Auth-Cookie, bestätigte E-Mail und `services:use`; nur eigene verknüpfte UUID oder durch berechtigten Whitelist-Lesezugriff zugängliche Spieler. CORS mit expliziter Website-Origin und Credentials.
- Erfolg: 200 `Content-Type: image/png`, 64×64 Pixel, transparenter Minecraft-Kopf einschließlich äußerer Skin-Ebene. UUID statt Benutzername als Identität. Größen und zulässige Upstream-Hosts serverseitig begrenzen; Renderer-Secrets ausschließlich serverseitig.
- Fehler: 401/403 für Zugriff, 404 bei fehlendem Skin, 429 bei Limit, 503 bei Upstream-Ausfall. Keine externen Redirects. Personenbezogene Antworten privat cachen und Cache-Schlüssel nicht zwischen Berechtigungen vermischen.
- Fallback: Backend darf einen neutralen Kopf als PNG liefern; bei Fehler/ungültigem Bild zeigt das Frontend dasselbe lokale Icon wie bisher. Nach bestätigter Migration kein direkter externer Browser-Fallback.
- Vor Abschaltung des Übergangspfads echte Avatare mit und ohne äußere Ebene, fehlende Skins, PNG-MIME, Sessionverlust, CORS, Timeout, Blob-Freigabe und beide UI-Stellen testen.

## Geänderte Dateien

- `.env.example`: abgeschalteter Rollout-Schalter, kein Avatar-Key.
- `src/apps/GameserverManager/MinecraftAccess.tsx`: Integration, Zustände, Abbruch auch für bestehende Anfragen.
- `src/apps/GameserverManager/useLiveWhitelist.ts`: neue Status-/Listenabfragen, Validierung, Fehler, Lebenszyklus.
- `src/apps/GameserverManager/MinecraftWhitelist.tsx`: neue Spielerliste.
- `src/apps/GameserverManager/MinecraftHead.tsx`: gemeinsamer UUID-Avatar und Fallback.
- `src/apps/GameserverManager/MinecraftProfile.tsx`: verwendet gemeinsamen Avatar und gespeicherten Profilnamen.
- `src/apps/GameserverManager/minecraft-access.css`: flexible Spielerzeilen im bestehenden Stil.
- `src/apps/GameserverManager/MinecraftWhitelist.test.tsx`, `MinecraftProfile.test.tsx`, `MinecraftAccess.test.tsx`: neue und angepasste Tests.
- `src/auth/ContactProfile.test.tsx`: bestehende DOM-Prüfung mit begründeter lokaler ESLint-Ausnahme; Verhalten unverändert. Damit passiert der bestehende Test die projektweite Lint-Prüfung.
- Diese Übergabe. Die lokale `.env.local` ist ignoriert und kein Bestandteil des Commits.

## Validierung und Freigabe

Typecheck erfolgreich; ESLint ohne Fehler/Warnungen; gesamte Jest-Suite mit 202 bestandenen Tests in 12 Suites; Produktionsbuild einschließlich fünf statischer Auth-Einstiegsseiten erfolgreich.
Automatisiert abgedeckt: Whitelist-Zustände, mehrere/manuelle Spieler, leere Liste, eigener Account, Avatar/Fallback/ungültige UUID, 401/403/429/500/503 ohne code, Netzwerkfehler, verspätete Antworten, Link-Wechsel, Logout während Listenrequest und Freischaltung mit Status-Refresh. Bestehende Discord- und Auth-Tests bleiben Teil der Gesamtsuite.
Die Bildnetzwerkanfragen werden im DOM-Test über `onError` simuliert; kein Live-Renderer-, RCON- oder Backend-Integrationstest und keine visuelle Browserabnahme durchgeführt.
Bekannte Tool-Hinweise: veraltete Browserslist-Daten, Node-punycode-Deprecation und ein bestehender Fake-Timer-Hinweis in Auth-Tests.

Offene Schritte: Backend-Commit und tatsächliche Routen im Zielsystem prüfen; Staging mit Session, Rollen, manuellen Accounts, RCON-Ausfall und Verknüpfungswechsel testen; mobile/Windows-98-Optik sowie reale Skin-Ebene visuell abnehmen; Avatar-Proxy-Vertrag vereinbaren und umsetzen; Frontend mit aktiviertem Rollout-Schalter neu bauen; koordinierte Backend-/Frontend-/OpenClaw-Freigabe einholen. Erst danach produktiv deployen.
