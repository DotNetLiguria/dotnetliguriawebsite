# Running locally the website





## The .env file

Even if ASP.NET Core does not use `.env` files, there is a small class offering the opportunity to set some environment variables.

> For no reason this file should contain any secrets 

Since the Identity Provider must know the complete URL of the trusted application, when debugging pages that are subject to authentication, the `.env` file should at least contain the following line:

```
ASPNETCORE_URLS=https://0.0.0.0:5443/
```

## The secrets.json file

The standard `secrets.json` file is required to set the `ClientId` and `ClientSecret` data:

```json
{
    "AuthServer": {
        "ClientId": "DotNetLiguriaCore",
        "ClientSecret": "the client secret goes here"
    }
}
```

They are the needed to correctly qualify the running application as trusted from the Keycloak Identity Provider.

## Certificates

The self-signed certificate automatically provided by ASP.NET Core is good to go for ASP.NET Core. The same certificate will also be used by React after it has been "deployed" with:

```
npm run build
```

This is because the script deploys all the file inside the `wwwroot` folder of ASP.NET Core.

If instead the React application is run into its separate web host (typically https://localhost:3443), React needs its own certificate but may point to the same `localhost` certificate created by ASP.NET Core.

See the React folder on how to set the certificate files exported from the ASP.NET Core certificate.



