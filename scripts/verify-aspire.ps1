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
    questionnaireAdmin = 'https://localhost:5443/admin/questionnaires'
}

foreach ($name in $requests.Keys) {
    $response = Invoke-WebRequest $requests[$name] -TimeoutSec 30
    if ($response.StatusCode -ne 200) { throw "Local Aspire check failed: $name" }
    Write-Host "$name passed."
}
Write-Host 'Local HTTP checks passed. Questionnaire administration and external Keycloak login/MFA require separate authenticated checks.'
