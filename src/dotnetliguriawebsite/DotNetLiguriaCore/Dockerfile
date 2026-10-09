FROM mcr.microsoft.com/dotnet/aspnet:10.0.12 AS base
WORKDIR /app
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

FROM node:24.21.0-alpine AS frontend
WORKDIR /spa
COPY src/dotnetliguriaspa/package.json src/dotnetliguriaspa/package-lock.json ./
COPY src/dotnetliguriaspa/scripts/ ./scripts/
RUN npm ci
COPY src/dotnetliguriaspa/ ./
ARG VITE_API_BASE_URL=/api
ARG VITE_API_URL=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run sync:oidc && npm run typecheck && npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0.401 AS build
WORKDIR /src
COPY global.json Directory.Build.props .editorconfig ./
COPY src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj src/dotnetliguriawebsite/DotNetLiguriaCore/
COPY src/dotnetliguriawebsite/CommonAuth/CommonAuth.csproj src/dotnetliguriawebsite/CommonAuth/
COPY src/dotnetliguriawebsite/CommonWeb/CommonWeb.csproj src/dotnetliguriawebsite/CommonWeb/
COPY src/dotnetliguriawebsite/DotNetLiguriaCore.Model/DotNetLiguriaCore.Model.csproj src/dotnetliguriawebsite/DotNetLiguriaCore.Model/
RUN dotnet restore src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj
COPY src/dotnetliguriawebsite/ src/dotnetliguriawebsite/
COPY --from=frontend /spa/dist/ src/dotnetliguriaspa/dist/

FROM build AS publish
RUN dotnet publish src/dotnetliguriawebsite/DotNetLiguriaCore/DotNetLiguriaCore.csproj -c Release --no-restore -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
USER $APP_UID
ENTRYPOINT ["dotnet", "DotNetLiguriaCore.dll"]