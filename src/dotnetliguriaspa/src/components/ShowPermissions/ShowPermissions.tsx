import React, { FC } from 'react';
import styles from './ShowPermissions.module.css';
import { useOidcUser } from "@axa-fr/react-oidc";
import { UserInfoExtendedModel } from "../../models/UserInfoExtendedModel";

const ShowPermissions: FC = () => {
    const { oidcUser } = useOidcUser();
    const userInfoExtended = oidcUser as UserInfoExtendedModel;
    return (
        <div className={styles.ShowPermissions} data-testid="ShowPermissions">
            <p>User Roles</p>
            <ul>
                {(userInfoExtended?.roles ?? []).map(name => (
                    <li key={name}>{name}</li>
                ))}
            </ul>
        </div>
    )
};

export default ShowPermissions;
