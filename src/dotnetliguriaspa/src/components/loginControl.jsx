/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import './loginControl.css';
import { useOidc, useOidcIdToken } from "@axa-fr/react-oidc";
import { useOidcUser } from '@axa-fr/react-oidc';
import { Avatar, Box, Button, Typography } from "@mui/material";
import { Link as RouterLink } from 'react-router-dom';
function LoginControl(props) {
    const { login, logout, isAuthenticated } = useOidc();
    const { oidcUser, oidcUserLoadingState } = useOidcUser();

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
        localStorage.removeItem("profileStore");
        props.onLogout();
    }

    const stringAvatar = (name) => {
        const currentName = String(name);
        console.log(currentName);
        if (currentName === null || currentName === undefined || currentName === '') {
            return "DN";
        }
        return {
            children: `${currentName.split(' ')[0][0]}${currentName.split(' ')[1][0]}`,
        };
    }

    const logoutAndRevoke = async () => {
        await logout();
        //await auth.revokeTokens(["access_token", "refresh_token"]);
        //await auth.removeUser();
        //removeSessionStorageOidc();
        localStorage.removeItem("profileStore");
        props.onLogout();
    }

    if (isAuthenticated) {
        let name = oidcUser == null ? "(none)" : oidcUser.name;
        return (
            <Box     component={"div"} sx={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 1 }}>
                <Typography    color="primary" sx={{ fontSize: "1.1rem", fontFamily: "Titillium Web", fontWeight: 600 }}>
                    Benvenuto,{' '}
                </Typography>
                <RouterLink
                    to="/admin"
                    style={{
                        color: '#083d73',
                        textDecoration: 'none',
                        fontSize: '1.1rem',
                        fontFamily: 'Titillium Web',
                        fontWeight: 600
                    }}
                    className="user-name-link"
                >
                    {name}
                </RouterLink>
                <Button color="inherit" sx={{ padding: "0", minWidth: 'auto', ml: 1 }} onClick={logoutPlain}>
                    <Typography    color="primary" sx={{ fontSize: "1.1rem", fontFamily: "Titillium Web", fontWeight: 600 }}>Logout</Typography>
                </Button>
            </Box>
        );
    } else {
        return (
            <Box    component={"div"} sx={{ display: "flex", flexDirection: "row", alignItems: 'center' }}>
                <Button color="inherit" onClick={loginPlain} sx={{ padding: "0", minWidth: 'auto', lineHeight: 1 }}>
                    <Typography    color="primary" sx={{ fontSize: "1.1rem", fontFamily: "Titillium Web", fontWeight: 600 }}>Area Personale</Typography>
                </Button>
            </Box>
        );
    }
}


export default LoginControl; 