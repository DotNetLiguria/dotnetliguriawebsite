# Tema di login Keycloak "dotnetliguria"

Login nello stile del sito per il realm `DotNetLiguria` su hello.vevy.com, che usa Keycloak **26.6.3** (il tema richiede almeno 26.6).

![Login](keycloak-theme/login-desktop.png)

## Installazione

```bash
keycloak/build-theme.sh                          # crea keycloak/dist/dotnetliguria-login-theme.jar
sudo cp keycloak/dist/dotnetliguria-login-theme.jar /opt/keycloak/providers/
sudo -u keycloak /opt/keycloak/bin/kc.sh build   # solo se Keycloak parte con "start --optimized"
sudo systemctl restart keycloak
```

Il riavvio ferma per qualche decina di secondi tutti i realm di quel Keycloak: va concordato con Vevy.

## Attivazione

1. Annota il tema attuale: *Realm settings* → *Themes* → *Login theme* (oggi `keycloak`).
2. Scegli `dotnetliguria` e salva. Per provarlo prima solo sul sito: *Clients* → `DotNetLiguriaSpa` → *Login settings* → *Login theme*.
3. Italiano: *Realm settings* → *Localization* → *Internationalization* On, *Default locale* Italiano. Vale anche per console account ed email.

## Tornare indietro

Rimetti il tema annotato al punto 1 e salva: nessun riavvio.

## Da decidere

- Italiano come lingua del realm (punto 3).
- Tema su tutto il realm o prima solo sul client del sito.
- Temi per email e console account: non inclusi.

Prova in locale: `keycloak/dev/compose.yaml`. Dopo un aggiornamento di Keycloak: `keycloak/check-upstream.sh`.
