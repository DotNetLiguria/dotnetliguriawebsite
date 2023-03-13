import logo from './logo.svg';
import './App.css';

import React, { useState } from 'react';

// import { BrowserRouter as Router } from 'react-router-dom';
// import { Routes } from 'react-router-dom';

//import { useAuth } from "@axa-fr/react-oidc";
import { useOidc } from "@axa-fr/react-oidc";
import { useOidcIdToken } from '@axa-fr/react-oidc';

import ShowToken from './components/showToken';
import ShowJson from './components/showJson';
import LoginControl from './components/loginControl';


function App() {
  const { login, logout, isAuthenticated} = useOidc();
  const{ idToken, idTokenPayload } = useOidcIdToken();

  const [result, setResult] = useState("");
  const [isError, setIsError] = useState(true);

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

  const invokeAPI = async () => {
    try {
      const token = idToken;
      console.log(token);
      if (!isAuthenticated) {
        setResult("User is not authenticated");
        setIsError(true);
        return;
      }
      const response = await fetch("https://localhost:5443/api/values", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if(!response.ok) {
        let message;
        try {
          console.log(response);
          var authError = response.headers.get("WWW-Authenticate");
          message = `Fetch failed with HTTP status ${response.status} ${authError}  ${await response.text()}`;
        }
        catch(e) {
          message = `Fetch failed with HTTP status ${response.status} ${response.statusText}`;
        }

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
          <a href="#" onClick={invokeAPI}>Invoke API</a>
        </div>

        <div className="two"></div>

        <div className="three">
          <LoginControl onLogout={loggedOut}/>
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
    </div>
  );
}

export default App;
