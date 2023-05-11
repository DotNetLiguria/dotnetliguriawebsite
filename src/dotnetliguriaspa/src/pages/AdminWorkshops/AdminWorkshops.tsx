import React, { FC } from 'react';
import styles from './AdminWorkshops.module.css';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface AdminWorkshopsProps {}

const AdminWorkshops: FC<AdminWorkshopsProps> = () => (
  <div className={styles.AdminWorkshops} data-testid="AdminWorkshops">
    AdminWorkshops Component
  </div>
);

export default AdminWorkshops;
