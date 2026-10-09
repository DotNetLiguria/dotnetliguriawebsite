export function getOidcPublicSettings(
  authority: string | undefined = import.meta.env.VITE_OIDC_AUTHORITY,
  clientId: string | undefined = import.meta.env.VITE_OIDC_CLIENT_ID,
) {
  return {
    authority: authority || 'https://hello.vevy.com/realms/DotNetLiguria',
    client_id: clientId || 'DotNetLiguriaSpa',
  };
}
