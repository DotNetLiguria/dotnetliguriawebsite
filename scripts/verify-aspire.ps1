#requires -Version 7.4
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$requests = [ordered]@{
    websiteHealth = 'https://localhost:5443/health'
    websiteAlive = 'https://localhost:5443/alive'
    websiteApi = 'https://localhost:5443/api/Workshop/Get?onlyPublished=true'
    websiteContent = 'https://localhost:5443/Contents/workshops/workshop001/workshop.png'
    spa = 'https://localhost:3443/'
    hostedHealth = 'https://localhost:62045/health'
    hostedSample = 'https://localhost:62045/Questionario'
    serverHealth = 'https://localhost:62048/health'
    serverPage = 'https://localhost:62048/'
}

foreach ($name in $requests.Keys) {
    $response = Invoke-WebRequest $requests[$name] -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "Local Aspire check failed: $name" }
    if ($name -eq 'hostedSample') {
        $sample = $response.Content | ConvertFrom-Json
        if ($sample.workshopId -ne 'aspire-local-workshop' -or !$sample.track01WorkshopTrackId) {
            throw 'Expected isolated hosted questionnaire sample data was not returned.'
        }
    }
    Write-Host "$name passed."
}
Write-Host 'Local HTTP checks passed. Browser circuits and external Keycloak login/MFA require separate checks.'
