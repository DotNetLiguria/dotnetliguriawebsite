// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck
//import logo from './assets/Logo_W400.png';
import logo from './assets/Logo_H200.png';
//import logo from './assets/Logo_H100.png';
import './App.css';
import React, { useState } from 'react';
import { useOidcFetch } from '@axa-fr/react-oidc';
// import { BrowserRouter as Router } from 'react-router-dom';
// import { Routes } from 'react-router-dom';
//import { useAuth } from "@axa-fr/react-oidc";
import { useOidc } from "@axa-fr/react-oidc";
import { useOidcIdToken, useOidcAccessToken } from '@axa-fr/react-oidc';
import { Route, Routes } from 'react-router-dom';
import ShowToken from './components/showToken';
import ShowJson from './components/showJson';
import LoginControl from './components/loginControl';
import Home from './pages/Home/Home';
import HomeAdmin from './pages/HomeAdmin/HomeAdmin';
import AdminWorkshops from './pages/AdminWorkshops/AdminWorkshops';
import AdminUsers from './pages/AdminUsers/AdminUsers';
import AdminHome from './pages/AdminHome/AdminHome';

const acr_to_loa = Object.freeze({
  pwd: 1,
  mfa: 2,
  hwk: 3,
});

function App() {
  const { login, logout, renewTokens, isAuthenticated } = useOidc();
  const { idToken, idTokenPayload } = useOidcIdToken();
  const { accessToken, accessTokenPayload } = useOidcAccessToken();

  const [result, setResult] = useState("");
  const [isError, setIsError] = useState(true);

  const { fetch } = useOidcFetch();

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
      console.log("sono qui dentro");
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

//post solution
// const requestOptions = {
//   method: 'POST',
//   headers: { 'Content-Type': 'application/json' },
//   body: JSON.stringify({ title: 'React POST Request Example' })
// };

// fetch('https://reqres.in/invalid-url', requestOptions)
//   .then(async response => {
//     const isJson = response.headers.get('content-type')?.includes('application/json');
//     const data = isJson && await response.json();

//     // check for error response
//     if (!response.ok) {
//       // get error message from body or default to response status
//       const error = (data && data.message) || response.status;
//       return Promise.reject(error);
//     }

//     this.setState({ postId: data.id })
//   })
//   .catch(error => {
//     this.setState({ errorMessage: error.toString() });
//     console.error('There was an error!', error);
//   });

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
        }
        catch (e) {
          message = `Fetch failed with HTTP status ${response.status} ${response.statusText}`;
        }

        // //if(previousInvocationOk && response.status == 403) {
        // if(response.status == 403) {
        //   console.log("fetch access denied: logout+login in progress: " + loa);
        //   await logout();
        //   await login(null, {
        //     acr_values: loa
        //   });

        //   invokeAPI(resource, loa, false);
        //   return;
        // }

        setResult(message);
        setIsError(true);
        return;
      }

      setResult(await response.json());
      setIsError(false);
    }
    catch (e) {
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
      <div>
        <header className="header">
          <div className="one">
            <a href="#" className="apilink" onClick={() => invokeAPI("ValuesPlain", acr_to_loa.pwd)}>Plain API</a>
            <a href="#" className="apilink" onClick={() => invokeAPI("ValuesMfa", acr_to_loa.mfa)}>TOTP API</a>
            <a href="#" className="apilink" onClick={() => invokeAPI("ValuesHwk", acr_to_loa.hwk)}>Key API</a>
          </div>

          <div className="two"></div>

          <div className="three">
            <LoginControl onLogout={loggedOut} />
          </div>

        </header>

        <div className="content">
          <img src={logo} className="App-logo" alt="logo" />

        </div>

        <div className="apiResult">
          {isError ? result : (<ShowJson label="API result" data={result} />)}
        </div>



        {isAuthenticated ? (
            <div className="tokens">
              <ShowToken></ShowToken>
            </div>
        ) : (<></>)}

        {/* <Router>
        <Routes />
      </Router>
      */}

        <Routes>
          <Route path='/' element={<Home/>} />
          <Route path='/admin' element={<AdminHome />} />
          <Route path='/admin/workshops' element={<AdminWorkshops />} />
          <Route path='/admin/users' element={<AdminUsers />} />
        </Routes>

      </div>
  );
}

export default App;
