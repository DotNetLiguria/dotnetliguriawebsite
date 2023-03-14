import React from 'react';
import './loginControl.css';
import { useOidc } from "@axa-fr/react-oidc";
import { useOidcUser } from '@axa-fr/react-oidc';


function SuperSecretPage() {
    return (
        <div>This secret is protected by the HW token</div>
    );
}