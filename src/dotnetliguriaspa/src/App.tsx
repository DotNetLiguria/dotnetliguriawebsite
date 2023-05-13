// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
//import logo from './assets/Logo_W400.png';
import logo from './assets/Logo_H200.png';
//import logo from './assets/Logo_H100.png';
import './App.css';
import React, {useState} from 'react';
import {useOidcFetch} from '@axa-fr/react-oidc';
import {useOidc} from "@axa-fr/react-oidc";
import {useOidcIdToken, useOidcAccessToken} from '@axa-fr/react-oidc';
import {Route, Routes} from 'react-router-dom';
import ShowToken from './components/showToken';
import ShowJson from './components/showJson';
import LoginControl from './components/loginControl';
import Home from './pages/Home/Home';
import HomeAdmin from './pages/HomeAdmin/HomeAdmin';
import AdminWorkshops from './pages/AdminWorkshops/AdminWorkshops';
import AdminUsers from './pages/AdminUsers/AdminUsers';
import AdminHome from './pages/AdminHome/AdminHome';
import AdminNotFound from './pages/AdminNotFound/AdminNotFound'
import TopBar from "./components/TopBar/TopBar";
import SideBar from "./components/SideBar/SideBar";
import HomeHeader from "./components/HomeHeader/HomeHeader";
import PageNotFound from "./pages/PageNotFound/PageNotFound";
import AdminTokens from "./pages/AdminTokens/AdminTokens";

const acr_to_loa = Object.freeze({
    pwd: 1,
    mfa: 2,
    hwk: 3,
});

function App() {
    const {login, logout, renewTokens, isAuthenticated} = useOidc();
    const {idToken, idTokenPayload} = useOidcIdToken();
    const {accessToken, accessTokenPayload} = useOidcAccessToken();

    const [result, setResult] = useState("");
    const [isError, setIsError] = useState(true);

    const {fetch} = useOidcFetch();

    // switch (auth.activeNavigator) {
    //   case "signinSilent":
    //     return <div>Signing you in...</div>;
    //   case "signoutRedirect":
    //     return <div>Signing you out...</div>;
    //   default:
    // }

    // if (auth.isLoading) {
    //   return <div>Loading...</div>;
    // }

    // if (auth.error) {
    //   return <div>Oops... {auth.error.message}</div>;
    // }

    // if (auth.isAuthenticated) {
    //   //console.log(auth.user.profile);
    //   return (
    //     <div>
    //       Hello {auth.user?.profile.name}{" "}
    //       <button onClick={() => void auth.removeUser()}>Log out</button>
    //       <div>Claim sub: {auth.user.profile['sub']}</div>

    //     </div>
    //   );
    // }

    const invokeAPI = async (resource: string, requested_loa: number, previousInvocationOk = true) => {
        try {
            console.log(`requesting ${resource} with loa:${requested_loa}`);
            console.log("I'm here");
            const token = idToken;
            //console.log(token);
            if (!isAuthenticated) {
                setResult("User is not authenticated");
                setIsError(true);
                return;
            }

            const token_loa = acr_to_loa[accessTokenPayload.acr];
            if (token_loa < requested_loa) {
                setResult("User need higher privileges: " + Object.keys(acr_to_loa)[requested_loa - 1]);
                setIsError(true);
                return;
            }

            const loadedUsers = await fetch("https://hello.vevy.com/realms/DotNetLiguria/users", {
                // headers: {
                //   Authorization: `Bearer ${token}`,
                // },
            });
            console.log(loadedUsers);

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
        <div className="App">
            {isAuthenticated ? (
                <>
                    <TopBar/>
                    <div className="container">
                        <SideBar/>
                        <Routes>
                            <Route path='/' element={<Home/>}/>
                            <Route path='/admin' element={<AdminHome/>}/>
                            <Route path='/admin/analytics/' element={<PageNotFound pagename={"Analytics"}/>}/>
                            <Route path='/admin/users/' element={<PageNotFound pagename={"Users"}/>}/>
                            <Route path='/admin/workshops/' element={<PageNotFound pagename={"Workshops"}/>}/>
                            <Route path='/admin/events/' element={<PageNotFound pagename={"Events"}/>}/>
                            <Route path='/admin/reports/' element={<PageNotFound pagename={"Reports"}/>}/>
                            <Route path='/admin/mails/' element={<PageNotFound pagename={"Mails"}/>}/>
                            <Route path='/admin/feedbacks/' element={<PageNotFound pagename={"Feedbacks"}/>}/>
                            <Route path='/admin/messages/' element={<PageNotFound pagename={"Messages"}/>}/>
                            <Route path='/admin/manage/' element={<PageNotFound pagename={"Manage"}/>}/>
                            <Route path='/admin/tokens/' element={<AdminTokens pagename={"tokens"}/>}/>
                        </Routes>
                    </div>
                </>
            ) : (
                <>
                    <HomeHeader/>
                </>
            )}
        </div>
    );

}

export default App;
