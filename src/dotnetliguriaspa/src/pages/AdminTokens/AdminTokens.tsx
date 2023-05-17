import React, { FC } from 'react';
import styles from './AdminTokens.module.css';
import ShowToken from "../../components/showToken";

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminTokensProps {}

const AdminTokens: FC<AdminTokensProps> = () => (
    <div className={styles.AdminTokens} data-testid="AdminTokens">
        Tokens Page
        <ShowToken/>
    </div>
);

export default AdminTokens;
