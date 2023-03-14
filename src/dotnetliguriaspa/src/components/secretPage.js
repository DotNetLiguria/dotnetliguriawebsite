import React from 'react';
import './loginControl.css';
import { useOidc } from "@axa-fr/react-oidc";
import { useOidcUser } from '@axa-fr/react-oidc';

function SecretPage() {
    return (
        <div>This secret is protected by the TOTP token</div>
    );
}