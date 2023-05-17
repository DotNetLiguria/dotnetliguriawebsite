/* eslint-disable react/prop-types */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import './loginControl.css';
import {useOidc} from "@axa-fr/react-oidc";
import {useOidcUser} from '@axa-fr/react-oidc';
import {Link} from "react-router-dom";

function LoginControl(props) {
    const {login, logout, isAuthenticated} = useOidc();
    const {oidcUser, oidcUserLoadingState} = useOidcUser();

    // const removeSessionStorageOidc = () => {
    //     var oidcKeys = Object.keys(sessionStorage)
    //         .filter((key) => key.startsWith('oidc.user'));
    //     //console.log(oidcKeys);
    //     oidcKeys.forEach(k => sessionStorage.removeItem(k));
    // }

    const loginPlain = async () => {
        await login("/admin");
    }

    const loginMfa = async () => {
        console.log("loginMfa");
        await login("/admin", {
            acr_values: "mfa"
        });
        // await auth.signinRedirect({
        //     acr_values: "mfa"
        // });
    }

    const loginHwk = async () => {
        console.log("loginHwk");
        await login("/admin", {
            acr_values: "hwk"
        });

        // await auth.signinRedirect({
        //     acr_values: "hwk"
        // });
    }

    const logoutPlain = async () => {
        await logout();
        //await auth.removeUser();
        // eslint-disable-next-line react/prop-types
        props.onLogout();
    }

    const logoutAndRevoke = async () => {
        await logout();
        //await auth.revokeTokens(["access_token", "refresh_token"]);
        //await auth.removeUser();
        //removeSessionStorageOidc();
        props.onLogout();
    }

    // if (auth.isLoading) {
    //     return <div>Loading...</div>;
    // }

    // if (auth.error) {
    //     return <div>Authentication error: {auth.error.message}</div>;
    // }
    if (isAuthenticated) {
        //console.log(oidcUser);
        let name = oidcUser == null ? "(none)" : oidcUser.name;
        return (
            <div className="auth">
                <span className="helloUser"><Link to={"/admin"}>Admin</Link></span>
                <span className="helloUser">Hello {name}</span>
                <span className="helloUser"><a href="#" onClick={logoutPlain}>Log out</a></span>
                <span className="helloUser"><a href="#" onClick={logoutAndRevoke}>Log out and Revoke</a></span>
            </div>
        );
    } else {
        return (
            <div className="auth">
                <span className="helloUser"><a href="#" onClick={loginPlain}>Log in</a></span>
                <span className="helloUser"><a href="#" onClick={loginMfa}>Log in [MFA]</a></span>

                {/*
                    The following link is used for the "Super Secret" page
                    The scenario is when using three levels of Step-Up auth which are:
                    - Password (pwd)
                    - TOTP Google Authenticator (mfa)
                    - Hardware FIDO2 key (hwk)
                 */}

                {/* <span className="helloUser"><a href="#" onClick={loginHwk}>Log in [HWK]</a></span> */}
            </div>
        );
    }
}


export default LoginControl; 