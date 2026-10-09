import React, { FC, useEffect, useState } from 'react';
import { useOidcUser } from '@axa-fr/react-oidc';
import { UserProfileModel } from '../../models/UserProfileModel';
import { FormProfileData } from '../../models/FormProfileData';
import { useForm, SubmitHandler } from "react-hook-form";
import { userProfileLocalStorageStore } from '../../store/userProfileLocalStorageStore';
import { KeyCloakUserProfile } from '../../models/KeyCloakUserProfile';
import { useOidcFetch } from "@axa-fr/react-oidc";
// import { jwtDecode } from 'jwt-decode';
import { Box, Button, Grid, TextField, Typography } from "@mui/material";
import styles from './AdminProfile.module.css';
const AdminProfile: FC = () => {

    // const { idToken } = useOidcIdToken();
    // const { accessToken } = useOidcAccessToken();
    const { fetch } = useOidcFetch();
    const { setProfileSaved } = userProfileLocalStorageStore();
    const { oidcUser } = useOidcUser();
    const [loggedUser, setLoggedUser] = useState<UserProfileModel>();
    const profileSaved = userProfileLocalStorageStore((state) => state.profileSaved);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<FormProfileData>();

    useEffect(() => {

        if (oidcUser !== null) {
            const currentUser: UserProfileModel = {
                email: oidcUser?.email,
                family_name: oidcUser.family_name,
                given_name: oidcUser.given_name,
                name: oidcUser.name,
                id: oidcUser.sub
            };
            setLoggedUser(currentUser);

            //const decodedToken = jwtDecode(idToken);
            setValue("city", "citta di prova");
            setValue("prov", "provincia");
            setValue("factory", "azienda");
            setValue("factoryCity", "citta azienda");
            setValue("factoryProv", "provincia azienda");
            setValue("socialTwitter", "twitter");
            setValue("socialLinkedin", "linkedin");
            setValue("socialGitHub", "github");
            setValue("consentData", true);
            setValue("consentPrivacy", true);
            setValue("factoryRoles", "IT Manager");
        }
    }, [oidcUser]);

    const onSubmit: SubmitHandler<FormProfileData> = (data) => {

        data.firstname = loggedUser?.given_name || '';
        data.lastname = loggedUser?.family_name || '';
        data.email = loggedUser?.email || '';

        const keyCloakProfile: KeyCloakUserProfile = {
            id: loggedUser?.id,
            username: data.email,
            firstName: data.firstname,
            email: data.email,
            lastName: data.lastname,
            emailVerified: true,
            userProfileMetadata: {
                attributes: [],
                groups: []
            },
            attributes: {
                d_city: [],
                d_prov: [],
                d_factory_name: [],
                d_factory_city: [],
                d_factory_prov: [],
                d_factory_role: [],
                d_social_twitterX: [],
                d_social_linkedin: [],
                d_social_github: [],
                d_consent: [],
                d_privacy_consent: []
            }
        };

        const dataConsent = data.consentData ? "S" : "N";
        const dataPrivacyConsent = data.consentPrivacy ? "S" : "N";
        keyCloakProfile.attributes.d_city.push(data.city);
        keyCloakProfile.attributes.d_prov.push(data.prov);
        keyCloakProfile.attributes.d_factory_name.push(data.factory);
        keyCloakProfile.attributes.d_factory_city.push(data.factoryCity);
        keyCloakProfile.attributes.d_factory_prov.push(data.factoryProv);
        keyCloakProfile.attributes.d_factory_role.push(data.factoryRoles);
        keyCloakProfile.attributes.d_social_twitterX.push(data.socialTwitter);
        keyCloakProfile.attributes.d_social_linkedin.push(data.socialLinkedin);
        keyCloakProfile.attributes.d_social_github.push(data.socialGitHub);
        keyCloakProfile.attributes.d_consent.push(dataConsent);
        keyCloakProfile.attributes.d_privacy_consent.push(dataPrivacyConsent);

        const jsonBody = JSON.stringify(keyCloakProfile);

        fetch('http://192.168.150.201:8080/realms/TraloSystem/account', {
            method: 'POST',
            body: jsonBody
        }).then(response => response.text());

        setProfileSaved(true);
    };

    return (
        <Box sx={{ width: '100%', p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3 }}>Profile</Typography>
            {!profileSaved &&
                <Box sx={{ mb: 2 }}>
                    <Typography variant={"inherit"}  sx={{ fontSize: 16, ...({ "color": "red" }) }}>I tuoi dati non sono ancora stati confermati.</Typography>
                </Box>
            }
            <form onSubmit={handleSubmit(onSubmit)} autoComplete="off">
                <Box component={"div"}  sx={{ pb: 3 }}><Typography    sx={{ fontSize: 18, fontStyle: 'italic', fontWeight: 600 }}>INFORMAZIONI
                    PERSONALI</Typography></Box>
                <Grid container spacing={2}  sx={{ pb: 3 }}>
                    <Grid
                        size={{
                            xs: 3,
                            md: 3
                        }}><Box component={"div"}
                         sx={{ display: 'flex', flexDirection: 'column' }}>
                        <TextField
                            value={loggedUser?.given_name}
                            {...register("firstname", {
                                required: "Il nome è obbligatorio",
                                minLength: {
                                    value: 3,
                                    message: "Name should be at least 3 characters",
                                },
                                maxLength: {
                                    value: 50,
                                    message: "Name should be at most 10 characters",
                                },
                            })}
                            id="firstname"
                            label="Nome"
                            variant="standard"
                            slotProps={{
                                htmlInput: { style: { fontSize: 18 } },
                                inputLabel: { shrink: true, style: { fontSize: 18 } }
                            }} />
                        {errors.firstname && <Typography variant={"inherit"} color={"red"}
                             sx={{ fontSize: 14 }}>{errors.firstname &&
                                <span>This field is required</span>}</Typography>}

                    </Box></Grid>
                    <Grid
                        size={{
                            xs: 3,
                            md: 3
                        }}><Box component={"div"}
                         sx={{ display: 'flex', flexDirection: 'column' }}>

                        <TextField
                            value={loggedUser?.family_name}
                            {...register("lastname", {
                                required: "Il cognome è obbligatorio.",
                                minLength: {
                                    value: 3,
                                    message: "Name should be at least 3 characters",
                                },
                                maxLength: {
                                    value: 50,
                                    message: "Name should be at most 10 characters",
                                },
                            })}
                            id="lastname"
                            label="Cognome"
                            variant="standard"
                            slotProps={{
                                htmlInput: { style: { fontSize: 18 } },
                                inputLabel: { shrink: true, style: { fontSize: 18 } }
                            }} />
                        {errors.lastname && <Typography variant={"inherit"} color={"red"}
                             sx={{ fontSize: 14 }}>{errors.lastname &&
                                <span>This field is required</span>}</Typography>}


                        {/*<label*/}
                        {/*    htmlFor="lastname"><Typography fontSize={ 12 }>Cognome</Typography></label><input*/}
                        {/*id="lastname"*/}
                        {/*type="text" { ...register("lastname",{maxLength:50}) }*/}
                        {/*value={ loggedUser?.family_name }*/}
                        {/*disabled/>{ errors.lastname &&*/}
                        {/*<span>This field is required</span> }*/}

                    </Box></Grid>
                    <Grid
                        size={{
                            xs: 3,
                            md: 3
                        }}> <Box component={"div"}
                         sx={{ display: 'flex', flexDirection: 'column' }}>

                        <TextField
                            value={loggedUser?.email}
                            {...register("email", {
                                required: "Il cognome è obbligatorio.",
                                minLength: {
                                    value: 3,
                                    message: "Name should be at least 3 characters",
                                },
                                maxLength: {
                                    value: 50,
                                    message: "Name should be at most 10 characters",
                                },
                                pattern: {
                                    value: /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/,
                                    message: 'Indirizzo email non valid',
                                }
                            })}
                            id="email"
                            label="Email"
                            variant="standard"
                            slotProps={{
                                htmlInput: { style: { fontSize: 18 } },
                                inputLabel: { shrink: true, style: { fontSize: 18 } }
                            }} />
                        {errors.email && <Typography variant={"inherit"} color={"red"}
                             sx={{ fontSize: 14 }}>{errors.email &&
                                <span>Campo email obbligatorio</span>}</Typography>}
                    </Box></Grid>
                    <Grid
                        size={{
                            xs: 3,
                            md: 3
                        }}><Box component={"div"}   sx={{ display: 'flex', flexDirection: 'column' }}>
                        <TextField
                            {...register("city", {
                                required: "Il campo città è obbligatorio",
                                minLength: {
                                    value: 3,
                                    message: "Name should be at least 3 characters",
                                },
                                maxLength: {
                                    value: 50,
                                    message: "Name should be at most 10 characters",
                                },
                            })}
                            id="citta"
                            label="Città"
                            variant="standard"
                            slotProps={{
                                htmlInput: { style: { fontSize: 18 } },
                                inputLabel: { shrink: true, style: { fontSize: 18 } }
                            }} />
                        {errors.city && <Typography variant={"inherit"} color={"red"}
                             sx={{ fontSize: 14 }}>{errors.city &&
                                <span>Campo città obbligatorio</span>}</Typography>}

                    </Box></Grid>

                    <Grid
                        size={{
                            xs: 3,
                            md: 3
                        }}><Box component={"div"}   sx={{ display: 'flex', flexDirection: 'column' }}>
                        <TextField
                            {...register("prov", {
                                required: "Il campo provincia è obbligatorio",
                                minLength: {
                                    value: 3,
                                    message: "Name should be at least 3 characters",
                                },
                                maxLength: {
                                    value: 50,
                                    message: "Name should be at most 10 characters",
                                },
                            })}
                            id="provincia"
                            label="Provincia"
                            variant="standard"
                            slotProps={{
                                htmlInput: { style: { fontSize: 18 } },
                                inputLabel: { shrink: true, style: { fontSize: 18 } }
                            }} />
                        {errors.prov && <Typography variant={"inherit"} color={"red"}
                             sx={{ fontSize: 14 }}>{errors.prov &&
                                <span>Campo provincia obbligatorio</span>}</Typography>}

                    </Box></Grid>
                </Grid>
                <Box component={"div"}  sx={{ pb: 1 }}>
                    <Typography    sx={{ fontSize: 18, fontStyle: 'italic', fontWeight: 600 }}>INFORMAZIONI AZIENDALI</Typography>
                    <Grid container spacing={2}   sx={{ pb: 3, pt: 2 }}>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}    sx={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                                <TextField
                                    {...register("factory")}
                                    id="factory"
                                    label="Azienda"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}   sx={{ display: 'flex', flexDirection: 'column' }}>
                                <TextField
                                    {...register("factoryCity")}
                                    id="factoryCity"
                                    label="Città"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}   sx={{ display: 'flex', flexDirection: 'column' }}>

                                <TextField
                                    {...register("factoryProv")}
                                    id="factoryProv"
                                    label="Provincia"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
                <Box component={"div"}  sx={{ pb: 3 }}><Typography    sx={{ fontSize: 18, fontStyle: 'italic', fontWeight: 600 }}>SE VUOI FARTI
                    CONOSCERE...</Typography>
                    <Grid container spacing={2}   sx={{ pb: 3, pt: 2 }}>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}    sx={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>

                                <TextField
                                    {...register("socialTwitter")}
                                    id="socialTwitter"
                                    label="X/Twitter"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}    sx={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>

                                <TextField
                                    {...register("socialLinkedin")}
                                    id="socialLinkedin"
                                    label="Linkedin"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                        <Grid
                            size={{
                                xs: 3,
                                md: 3
                            }}>
                            <Box component={"div"}    sx={{ display: 'flex', flexDirection: 'column', fontSize: 12 }}>
                                <TextField
                                    {...register("socialGitHub")}
                                    id="socialGitHub"
                                    label="Github"
                                    variant="standard"
                                    slotProps={{
                                        htmlInput: { style: { fontSize: 18 } },
                                        inputLabel: { shrink: true, style: { fontSize: 18 } }
                                    }} />
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
                <Box component={"div"}  sx={{ pb: 3 }}><Typography    sx={{ fontSize: 18, fontStyle: 'italic', fontWeight: 600 }}>CONSENSO
                    TRATTAMENTO DEI DATI</Typography>
                    <Grid container spacing={2}   sx={{ pb: 3, pt: 2 }}>
                        <Grid
                            size={{
                                xs: 3,
                                md: 6
                            }}>
                            <Box component={"div"}     sx={{ display: 'flex', flexDirection: 'column', fontSize: 12, alignItems: 'flex-start' }}>
                                <label htmlFor="consentData"><Typography  sx={{ fontSize: 16 }}>Consenso trattamento dei
                                    dati</Typography></label>
                                <input id="consentData"
                                    type="checkbox" {...register("consentData", { required: true })} />
                                {errors.consentData && <span>This field is required</span>}
                            </Box>
                        </Grid>
                        <Grid
                            size={{
                                xs: 3,
                                md: 6
                            }}>
                            <Box component={"div"}     sx={{ display: 'flex', flexDirection: 'column', fontSize: 12, alignItems: 'flex-start' }}>
                                <label htmlFor="consentPrivacy"><Typography  sx={{ fontSize: 16 }}>Consenso
                                    privacy</Typography></label>
                                <input id="consentPrivacy"
                                    type="checkbox" {...register("consentPrivacy", { required: true })} />
                                {errors.consentPrivacy && <span className={styles.alert}>This field is required</span>}
                            </Box>
                        </Grid>
                    </Grid>
                </Box>
                <Box component={"div"}    sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                    {/*<input type="submit" className="btn btn-primary"/>*/}
                    <Button type="submit" variant="contained">Invia</Button>
                </Box>
            </form>
        </Box>
    );
};

export default AdminProfile;
