## Deploying Notes
December 11, 2019 - @raffaeler

### Publishing on Linux
1. Create a publishing folder
```
dotnet publish -c Release -r linux-x64 --self-contained true
```

2. Modify the Blazor configuration named `BlazorAppTest.Client.blazor.config`. The last line must specify a full qualified folder.
For example:
```
/home/username/BlazorAppTest/BlazorAppTest.Client.dll
```

3. Using SSH copy the published application to Linux

4. Enter the linux folder and give the execution permissions to the executable:
```
chmod +x BlazorAppTest.Server
```

5. On Linux copy the dist folder in the application root:
```
Source: /home/username/BlazorAppTest/BlazorAppTest.Client/dist
Target: /home/username/BlazorAppTest/dist
```

6. On Windows, create a self-signed certificate:

```
dotnet dev-certs https -ep .\cert.pfx -p ComplexPassword 
```

7. Copy the certificate in a location on the Linux machine (than the publishing folder)
For example: /home/secure/cert.pfx

8. Create a json file in the `/home/secure/` folder with the https configuration:
```
{
  "HttpServer": {
    "Endpoints": {
      "Http": {
        "Host": "0.0.0.0",
        "Port": 5000,
        "Scheme": "http"
      },
      "Https": {
        "Host": "0.0.0.0",
        "Port": 5001,
        "Scheme": "https",
        "FilePath": "/home/secure/cert.pfx",
        "Password": "ComplexPassword"
      }
    }
  }
}
```

9. Right before running the server, instruct the app about the existence of the new configuration file:
```
export BlazorAppTestServerConfig="/home/secure/BlazorAppTest.Server.json"
```

Please note that the "BlazorAppTestServerConfig" environment variable is computed dynamically.
It is the AssemblyName without '.' or '-' with "Config" appended at the end.

10. If the file does **not** exist, the normal ASP.NET Core configuration is used.
In this case, you can change the listening URLS and ports with
  * ASPNETCORE_URLS="https://0.0.0.0:5001;http://0.0.0.0:5000"

11. Optional: make the app terminal log verbose or silent with either of the two:
```
export ASPNETCORE_ENVIRONMENT=Development
export ASPNETCORE_ENVIRONMENT=Production
```

12. Run the app


