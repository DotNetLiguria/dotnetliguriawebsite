import React, { lazy, Suspense, useEffect, useRef } from 'react';
import { useOidc, useOidcUser } from "@axa-fr/react-oidc";
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import AdminShell from "./admin/AdminShell";
import DashboardPage from "./admin/pages/DashboardPage";
import SpeakersPage from "./admin/pages/SpeakersPage";
import EventsAdminPage from "./admin/pages/EventsAdminPage";
import PersonalArea from './account/PersonalArea';
import PrivacyAdministration from './admin/pages/PrivacyAdministration';
import { AccountCapabilitiesProvider } from './account/AccountCapabilities';
import VenuesPage from "./admin/pages/VenuesPage";
import BackupPage from "./admin/pages/BackupPage";
import AdminNotFoundPage from "./admin/pages/AdminNotFoundPage";
import QuestionnairesPage from "./admin/pages/QuestionnairesPage";
import HomePage from "./site/home/HomePage";
import EventsPage from "./site/events/EventsPage";
import EventDetailPage from "./site/event/EventDetailPage";
import PrivacyPage from "./site/legal/PrivacyPage";
import TermsPage from "./site/legal/TermsPage";
import CookiePolicyPage from "./site/legal/CookiePolicyPage";
import BoardPage from "./admin/pages/BoardPage";
import EventDetailAdminPage from "./admin/pages/EventDetailAdminPage";
import EventCreatePage from "./admin/pages/EventCreatePage";
import MenuPage from "./admin/pages/MenuPage";
import PublicQuestionnaire from "./components/PublicQuestionnaire/PublicQuestionnaire";
import LegacyRedirect from "./site/legacy/LegacyRedirect";
import { clearPrivateBrowserState } from './questionnaire/drafts';

// The questionnaire designer and results pull in dnd-kit and Recharts: load them on demand.
const QuestionnaireDesigner = lazy(() => import('./components/QuestionnaireDesigner/QuestionnaireDesigner'));
const QuestionnaireResults = lazy(() => import('./components/QuestionnaireResults/QuestionnaireResults'));
const page = (element: React.ReactNode) => <Suspense fallback={null}>{element}</Suspense>;

function ProfileRedirect() {
    const location = useLocation();
    return <Navigate to={`/area-personale${location.search}${location.hash}`} replace />;
}

function App() {
    const { isAuthenticated } = useOidc();
    const { oidcUser } = useOidcUser();
    const account = isAuthenticated ? String(oidcUser?.sub ?? 'authenticated') : null;
    const previousAccount = useRef(account);

    useEffect(() => {
        clearPrivateBrowserState(previousAccount.current !== null && previousAccount.current !== account);
        previousAccount.current = account;
    }, [account]);

    return (
        <AccountCapabilitiesProvider><div key={account ?? 'anonymous'} className="App">
            <Routes>
                {/* The shell asks unauthenticated visitors to sign in instead of rendering a blank page. */}
                <Route element={<AdminShell />}>
                    <Route path='/admin' element={<DashboardPage />} />
                    <Route path='/admin/privacy' element={<PrivacyAdministration />} />
                    <Route path='/admin/board/' element={<BoardPage />} />
                    <Route path='/admin/board/:id' element={<BoardPage />} />
                    <Route path='/admin/speakers/' element={<SpeakersPage />} />
                    <Route path='/admin/speakers/:id' element={<SpeakersPage />} />
                    <Route path='/admin/workshops/' element={<EventsAdminPage />} />
                    <Route path='/admin/workshop/create' element={<EventCreatePage />} />
                    <Route path='/admin/workshop/:id' element={<EventDetailAdminPage />} />
                    <Route path='/admin/events/' element={<Navigate to='/admin/workshops/' replace />} />
                    <Route path='/admin/venues/' element={<VenuesPage />} />
                    <Route path='/admin/feedbacks' element={<Navigate to='/admin/questionnaires' replace />} />
                    <Route path='/admin/questionnaires' element={<QuestionnairesPage />} />
                    <Route path='/admin/questionnaires/:id/edit' element={page(<QuestionnaireDesigner />)} />
                    <Route path='/admin/questionnaires/:id/results' element={page(<QuestionnaireResults />)} />
                    <Route path='/admin/topmenu/' element={<MenuPage />} />
                    <Route path='/admin/topmenu/:id' element={<MenuPage />} />
                    <Route path='/admin/downloads' element={<Navigate to='/admin/import-export/' replace />} />
                    <Route path='/admin/import-export/' element={<BackupPage />} />
                    <Route path='/admin/*' element={<AdminNotFoundPage />} />
                </Route>
                <Route path='/admin/profile/' element={<ProfileRedirect />} />
                <Route path='/area-personale' element={<PersonalArea />} />
                <Route path='/' element={<HomePage />} />
                <Route path="/workshops" element={<EventsPage />} />
                <Route path="/workshop/:id" element={<EventDetailPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="/termini-di-servizio" element={<TermsPage />} />
                <Route path="/cookie" element={<CookiePolicyPage />} />
                <Route path="/feedback/:workshopId" element={<PublicQuestionnaire />} />
                <Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} />
                {/* OIDC callbacks render nothing here (OidcProvider handles them before this tree); unknown /admin
                    addresses stay inside the admin shell above; every other unknown address is redirected when it
                    belongs to the previous site, otherwise it is the public not-found page. */}
                <Route path="/authentication/*" element={null} />
                <Route path="*" element={<LegacyRedirect />} />
            </Routes>
        </div></AccountCapabilitiesProvider>
    );

}

export default App;
