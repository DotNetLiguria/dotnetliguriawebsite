import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

import { OidcProvider } from "@axa-fr/react-oidc";

const replaceState = (_user: User | void): void => {
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname
  )

  //console.log(_user);
}

const configuration = {
  //metadataUrl: "https://hello.vevy.com/realms/DotNetLiguria/.well-known/openid-configuration",
  authority: "https://hello.vevy.com/realms/DotNetLiguria",
  client_id: "DotNetLiguriaSpa",
  redirect_uri: window.location.origin + '/authentication/callback',
  silent_redirect_uri: window.location.origin + '/authentication/silent-callback', 
  //scope: 'openid profile email api offline_access',
  scope: 'openid email',
  service_worker_relative_url:'/OidcServiceWorker.js',
  service_worker_only:true,

  //onSigninCallback: replaceState,
  //loadUserInfo: true,

  // mfa => Google Authenticator (TOTP)
  // hwk => Hardware key (FIDO2)
  //
  //acr_values: "pwd",  // just ask username/password
  //acr_values: "mfa",  // force the request of the OTP (requires the custom flow)
  //acr_values: "hwk",  // force the request of the OTP (requires the custom flow)
  extras :{
    acr_values: "pwd"
  }
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <OidcProvider configuration={configuration} >
      <App />
    </OidcProvider>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();



/*
// https://authts.github.io/oidc-client-ts/classes/OidcClientSettingsStore.html
=== List of all the oidcConfig properties ===

acr_values
authority
client_authentication
client_id
client_secret
clockSkewInSeconds
display
extraQueryParams
extraTokenParams
filterProtocolClaims
loadUserInfo
max_age
mergeClaims
metadata
metadataSeed
metadataUrl
post_logout_redirect_uri
prompt
redirect_uri
refreshTokenCredentials
resource
response_mode
response_type
scope
signingKeys
staleStateAgeInSeconds
stateStore
ui_locales
userInfoJwtIssuer
*/
