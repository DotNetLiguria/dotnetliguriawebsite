import React from 'react';
import { useOidcIdToken, useOidcAccessToken } from '@axa-fr/react-oidc';
import { JSONTree } from 'react-json-tree';


function ShowToken() {
    const { idToken, idTokenPayload } = useOidcIdToken();
    const { accessToken, accessTokenPayload } = useOidcAccessToken();

    function parseJwt (token) {
        if(token == null) return "";
        //console.log("token", token);
        var base64Url = token.split('.')[1];
        if(base64Url == null) return;
        //console.log("base64Url", base64Url);
        var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        //console.log("base64", base64);
        var jsonPayload = decodeURIComponent(window.atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
    
        return JSON.parse(jsonPayload);
    };

    const theme = {
        scheme: 'monokai',
        author: 'wimer hazenberg (http://www.monokai.nl)',
        base00: '#272822',
        base01: '#383830',
        base02: '#49483e',
        base03: '#75715e',
        base04: '#a59f85',
        base05: '#f8f8f2',
        base06: '#f5f4f1',
        base07: '#f9f8f5',
        base08: '#f92672',
        base09: '#fd971f',
        base0A: '#f4bf75',
        base0B: '#a6e22e',
        base0C: '#a1efe4',
        base0D: '#66d9ef',
        base0E: '#ae81ff',
        base0F: '#cc6633',
      };

    const shouldExpandId = (keyPath, data, level) =>  true;
    const shouldExpandAccess = (keyPath, data, level) =>  false;
    const shouldExpandRefresh = (keyPath, data, level) =>  false;

    let pidToken = parseJwt(idToken);
    let paccessToken = parseJwt(accessToken);
    let prefreshToken = parseJwt(idToken);

    return (
    <>
        <JSONTree
            labelRenderer={([key]) => <strong>{key==="root" ?  "ID Token" : key}</strong>}
            data={pidToken}
            shouldExpandNode={shouldExpandId}
            theme={theme}
            invertTheme={true} />

        <JSONTree
            labelRenderer={([key]) => <strong>{key==="root" ?  "Access Token" : key}</strong>}
            data={paccessToken}
            shouldExpandNode={shouldExpandAccess}
            theme={theme}
            invertTheme={true} />

        <JSONTree
            labelRenderer={([key]) => <strong>{key==="root" ?  "Refresh Token" : key}</strong>}
            data={prefreshToken}
            shouldExpandNode={shouldExpandRefresh}
            theme={theme}
            invertTheme={true} />
    </>)
}

export default ShowToken;