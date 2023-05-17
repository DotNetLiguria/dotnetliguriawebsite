import React, {FC, useState} from 'react';
import styles from './HomeHeader.module.css';
import LoginControl from "../loginControl";
import logo from "../../assets/Logo_H200.png";
import {useOidc, useOidcAccessToken, useOidcFetch, useOidcIdToken} from "@axa-fr/react-oidc";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface HomeHeaderProps {
}

interface tokenLevelType {
    [key: string]: number;
}

const acr_to_loa: tokenLevelType = Object.freeze({
    pwd: 1,
    mfa: 2,
    hwk: 3,
});

const HomeHeader: FC<HomeHeaderProps> = () => {

    const {login, logout, renewTokens, isAuthenticated} = useOidc();
    const {idToken, idTokenPayload} = useOidcIdToken();
    const {accessToken, accessTokenPayload} = useOidcAccessToken();

    const [result, setResult] = useState("");
    const [isError, setIsError] = useState(true);

    const {fetch} = useOidcFetch();

    const invokeAPI = async (resource: string, requested_loa: number, previousInvocationOk = true) => {
        try {
            console.log(`requesting ${resource} with loa:${requested_loa}`);
            const token = idToken;
            //console.log(token);
            if (!isAuthenticated) {
                setResult("User is not authenticated");
                setIsError(true);
                return;
            }

            // console.log("token: ", token);
            
            const token_loa = acr_to_loa[accessTokenPayload.acr];
            if (token_loa < requested_loa) {
                setResult("User need higher privileges: " + Object.keys(acr_to_loa)[requested_loa - 1]);
                setIsError(true);
                return;
            }

            //const loadedUsers = await fetch("https://hello.vevy.com/realms/DotNetLiguria/users", {
                // headers: {
                //   Authorization: `Bearer ${token}`,
                // },
            //});
            //console.log(loadedUsers);

            const response = await fetch(window.location.origin + "/api/values/" + resource, {
                // headers: {
                //   Authorization: `Bearer ${token}`,
                // },
            });

            if (!response.ok) {
                let message;
                try {
                    console.log(response);
                    const authError = response.headers.get("WWW-Authenticate");
                    message = `Fetch failed with HTTP status ${response.status} ${authError}  ${await response.text()}`;
                } catch (e) {
                    message = `Fetch failed with HTTP status ${response.status} ${response.statusText}`;
                }

                setResult(message);
                setIsError(true);
                return;
            }

            setResult(await response.json());
            setIsError(false);
        } catch (e) {
            console.log(e);
            setResult(e.message);
            setIsError(true);
        }
    }

    const loggedOut = () => {
        setResult("");
        setIsError(true);
    }

    return (
        <div className={styles.HomeHeader} data-testid="HomeHeader">
            <header className="header">
                <div className="one">
                    <a href="#" className="apilink" onClick={() => invokeAPI("ValuesPlain", acr_to_loa.pwd)}>Plain
                        API</a>
                    <a href="#" className="apilink" onClick={() => invokeAPI("ValuesMfa", acr_to_loa.mfa)}>TOTP API</a>
                    <a href="#" className="apilink" onClick={() => invokeAPI("ValuesHwk", acr_to_loa.hwk)}>Key API</a>
                </div>
                <div className="two"></div>
                <div className="three">
                    <LoginControl onLogout={loggedOut}/>
                </div>
            </header>
            <div className="content">
                <img src={logo} className="App-logo" alt="logo"/>
            </div>
        </div>
    )
};

export default HomeHeader;
