import React from 'react';
import { useOidc } from '@axa-fr/react-oidc';
import { useLocation } from 'react-router-dom';
import { Button } from 'react-aria-components';
import SiteLayout from '../site/SiteLayout';
import PageMeta from '../site/PageMeta';
import ProfilePage from '../admin/pages/ProfilePage';
import { btn } from '../admin/ui';
import { accountReturnPath } from './returnPath';

export default function PersonalArea() {
  const { isAuthenticated, login } = useOidc();
  const location = useLocation();
  return <SiteLayout><PageMeta title="Area personale" description="Gestisci account, consensi e diritti privacy." noindex /><div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
    {isAuthenticated ? <ProfilePage /> : <>
      <h1 className="text-3xl font-bold">Area personale</h1>
      <p className="my-6">Accedi per consultare i tuoi dati, gestire i consensi e i diritti privacy.</p>
      <Button className={btn.primary} onPress={() => void login(accountReturnPath(location))}>Accedi</Button>
    </>}
  </div></SiteLayout>;
}
