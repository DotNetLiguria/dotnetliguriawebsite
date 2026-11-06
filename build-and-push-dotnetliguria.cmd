@echo off
setlocal

if "%~1"=="" (
  echo Usage: %~nx0 ^<version^>
  echo Example: %~nx0 1.0.1
  exit /b 1
)

set "REGISTRY=dockerhub.ge.vevy.com"
set "IMAGE_NAME=dotnetliguria"
set "IMAGE_TAG=%~1"
set "REGISTRY_IMAGE=%REGISTRY%/%IMAGE_NAME%:%IMAGE_TAG%"

pushd "%~dp0" || exit /b 1

echo.
echo Sign in to %REGISTRY% when prompted.
docker login "%REGISTRY%"
if errorlevel 1 goto :error

docker manifest inspect "%REGISTRY_IMAGE%" >nul 2>&1
if not errorlevel 1 (
  echo.
  echo %REGISTRY_IMAGE% already exists. Choose a new version.
  popd
  exit /b 1
)

echo.
echo Building Release solution...
dotnet build DotNetLiguria.slnx -c Release
if errorlevel 1 goto :error

echo.
echo Building %REGISTRY_IMAGE%...
docker build --pull -f src\dotnetliguriawebsite\DotNetLiguriaCore\Dockerfile -t "%REGISTRY_IMAGE%" .
if errorlevel 1 goto :error

echo.
echo Pushing %REGISTRY_IMAGE%...
docker push "%REGISTRY_IMAGE%"
if errorlevel 1 goto :error

echo.
echo Successfully pushed %REGISTRY_IMAGE%.
popd
exit /b 0

:error
set "EXIT_CODE=%ERRORLEVEL%"
popd
echo.
echo Build or push failed with exit code %EXIT_CODE%.
exit /b %EXIT_CODE%
