import React, { FC } from 'react';
import styles from './AdminUsers.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminUsersProps {}

const AdminUsers: FC<AdminUsersProps> = () => (
  <div className={styles.AdminUsers} data-testid="AdminUsers">
    AdminUsers Component
  </div>
);

export default AdminUsers;
