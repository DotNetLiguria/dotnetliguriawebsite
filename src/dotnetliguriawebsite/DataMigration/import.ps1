$c    = "change-to-mongo-db-containerName"
$pw   = docker exec $c printenv MONGO_INITDB_ROOT_PASSWORD
$port = ((docker port $c 27017) -split ':')[-1]
$env:DotNetLiguriaDatabase__DatabaseName = 'DotNetLiguriaAspire'
$env:DotNetLiguriaDatabase__ConnectionString =
    "mongodb://admin:$([uri]::EscapeDataString($pw))@127.0.0.1:$port/?authSource=admin&tls=true&tlsInsecure=true"

dotnet run -c Release -- --from-json