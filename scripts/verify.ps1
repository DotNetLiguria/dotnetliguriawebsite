#requires -Version 7.4
[CmdletBinding()]
param(
    [switch]$NoBuild,
    [switch]$NoFrontendChecks,
    [switch]$Native,
    [switch]$Measure,
    [ValidateRange(1, 10)][int]$Runs = 1
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$root = Split-Path $PSScriptRoot -Parent
$frontend = Join-Path $root 'src/dotnetliguriaspa'
$results = Join-Path $root '.artifacts/test-results'
New-Item -ItemType Directory -Path $results -Force | Out-Null
$dotnet = (Get-Command dotnet).Source
$node = (Get-Command node).Source
$budgetPath = Join-Path $PSScriptRoot 'timing-budgets.json'
if ($Measure -and $env:CI -eq 'true') { throw 'Measurement mode cannot bypass budgets in CI.' }
if (!$Measure -and !(Test-Path $budgetPath)) { throw 'Record measured timing budgets before running the gate.' }
$budgets = if ($Measure) { $null } else { Get-Content $budgetPath -Raw | ConvertFrom-Json -AsHashtable }

function Invoke-CheckedProcess {
    param([string]$Executable, [string[]]$Arguments, [string]$Directory = $root, [int]$TimeoutSeconds = 600)
    $start = [System.Diagnostics.ProcessStartInfo]::new()
    $start.FileName = $Executable
    $start.WorkingDirectory = $Directory
    $start.UseShellExecute = $false
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($argument in $Arguments) { $start.ArgumentList.Add($argument) }
    $process = [System.Diagnostics.Process]::new()
    $process.StartInfo = $start
    $watch = [System.Diagnostics.Stopwatch]::StartNew()
    try {
        if (!$process.Start()) { throw "Could not start $Executable" }
        $output = $process.StandardOutput.ReadToEndAsync()
        $errors = $process.StandardError.ReadToEndAsync()
        if (!$process.WaitForExit($TimeoutSeconds * 1000)) {
            $process.Kill($true)
            $process.WaitForExit()
            throw "Execution exceeded ${TimeoutSeconds}s: $Executable $($Arguments -join ' ')"
        }
        $stdout = $output.GetAwaiter().GetResult()
        $stderr = $errors.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) {
            Write-Host $stdout
            Write-Host $stderr
            throw "Command failed with exit code $($process.ExitCode): $Executable $($Arguments -join ' ')"
        }
        return $watch.Elapsed.TotalSeconds
    }
    finally { $watch.Stop(); $process.Dispose() }
}

$projects = [ordered]@{
    repository = 'tests/RepositoryRules.Tests/RepositoryRules.Tests.csproj'
    backend = 'tests/DotNetLiguriaCore.Tests/DotNetLiguriaCore.Tests.csproj'
    hostedQuestionnaire = 'tests/Questionnaire.Tests/Questionnaire.Tests.csproj'
    serverQuestionnaire = 'tests/ServerQuestionnaire.Tests/ServerQuestionnaire.Tests.csproj'
}

if (!$NoBuild) {
    $builds = @(
        'src/dotnetliguriawebsite/dotnetliguriawebsite.slnx',
        'src/BlazorQuestionario/BlazorAppQuestionario.sln',
        'src/BlazorQuestionarioServer/BlazorQuestionarioServer.sln',
        'src/BlazorQuestionarioServer/BlazorQuestionarioServer.Tests/BlazorQuestionarioServer.Tests.csproj'
    ) + @($projects.Values)
    foreach ($build in $builds) {
        Write-Host "Build: $build"
        Invoke-CheckedProcess $dotnet @('build', $build, '-c', 'Release', '--nologo', '-v', 'minimal') | Out-Null
    }
}

if (!$NoFrontendChecks) {
    Push-Location $frontend
    try {
        Write-Host 'Frontend: clean install'
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }
        foreach ($command in @('typecheck', 'lint', 'build')) {
            Write-Host "Frontend: $command"
            Invoke-CheckedProcess $node @('--run', $command) $frontend | Out-Null
        }
    }
    finally { Pop-Location }
}

$records = [System.Collections.Generic.List[object]]::new()
$first = if ($Measure) { 0 } else { 1 }
for ($run = $first; $run -le $Runs; $run++) {
    foreach ($suite in $projects.Keys) {
        $report = Join-Path $results "$suite-$run.trx"
        Remove-Item $report -ErrorAction SilentlyContinue
        $limit = if ($Measure) { 120 } else { [int]$budgets.suites[$suite].ceilingSeconds }
        $elapsed = Invoke-CheckedProcess $dotnet @('test', $projects[$suite], '-c', 'Release', '--no-build', '--no-restore', '--nologo',
            '--filter', 'Category!=Native&Category!=Browser', '--logger', "trx;LogFileName=$suite-$run.trx", '--results-directory', $results) $root $limit
        [xml]$trxReport = Get-Content $report -Raw
        $counters = $trxReport.SelectSingleNode("/*[local-name()='TestRun']/*[local-name()='ResultSummary']/*[local-name()='Counters']")
        if (!$counters -or [int]$counters.total -eq 0 -or [int]$counters.passed -ne [int]$counters.total -or
            [int]$counters.executed -ne [int]$counters.total) { throw "$suite must pass every discovered unit test without skips" }
        if (!$Measure -and [int]$counters.total -lt [int]$budgets.suites[$suite].minimumTests) { throw "$suite test count fell below its recorded baseline" }
        Write-Host ('{0}: {1} passed in {2:N2}s (run {3})' -f $suite, $counters.total, $elapsed, $run)
        if ($run -gt 0) { $records.Add([ordered]@{ suite = $suite; run = $run; tests = [int]$counters.total; seconds = [Math]::Round($elapsed, 3) }) }
    }
    $report = Join-Path $results "frontend-$run.json"
    Remove-Item $report -ErrorAction SilentlyContinue
    $limit = if ($Measure) { 120 } else { [int]$budgets.suites.frontend.ceilingSeconds }
    $elapsed = Invoke-CheckedProcess $node @('--run', 'test:unit', '--', '--reporter=json', '--outputFile', $report, '--silent') $frontend $limit
    $frontendReport = Get-Content $report -Raw | ConvertFrom-Json
    if ($frontendReport.numTotalTests -eq 0 -or $frontendReport.numPassedTests -ne $frontendReport.numTotalTests -or !$frontendReport.success) { throw 'Frontend must pass every discovered unit test without skips' }
    if (!$Measure -and $frontendReport.numTotalTests -lt $budgets.suites.frontend.minimumTests) { throw 'Frontend test count fell below its recorded baseline' }
    Write-Host ('frontend: {0} passed in {1:N2}s (run {2})' -f $frontendReport.numTotalTests, $elapsed, $run)
    if ($run -gt 0) { $records.Add([ordered]@{ suite = 'frontend'; run = $run; tests = $frontendReport.numTotalTests; seconds = [Math]::Round($elapsed, 3) }) }
}
$records | ConvertTo-Json -Depth 5 | Set-Content (Join-Path $results 'timings.json') -Encoding utf8

if ($Native) {
    Write-Host 'Separate native QR checks'
    $report = Join-Path $results 'native.trx'
    Remove-Item $report -ErrorAction SilentlyContinue
    Invoke-CheckedProcess $dotnet @('test', $projects.hostedQuestionnaire, '-c', 'Release', '--no-build', '--no-restore', '--nologo',
        '--filter', 'Category=Native', '--logger', 'trx;LogFileName=native.trx', '--results-directory', $results) $root 120 | Out-Null
    [xml]$nativeReport = Get-Content $report -Raw
    $counters = $nativeReport.SelectSingleNode("/*[local-name()='TestRun']/*[local-name()='ResultSummary']/*[local-name()='Counters']")
    if (!$counters -or [int]$counters.total -lt 2 -or [int]$counters.passed -ne [int]$counters.total -or
        [int]$counters.executed -ne [int]$counters.total) { throw 'Both native QR checks must pass without skips' }
    Write-Host "Native QR: $($counters.passed) passed."
}
Write-Host 'Verification passed.'