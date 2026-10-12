import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useOidc } from "@axa-fr/react-oidc";
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminShell from "./admin/AdminShell";
import DashboardPage from "./admin/pages/DashboardPage";
import SpeakersPage from "./admin/pages/SpeakersPage";
import EventsAdminPage from "./admin/pages/EventsAdminPage";
import ProfilePage from "./admin/pages/ProfilePage";
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

// The questionnaire designer and results pull in dnd-kit and Recharts: load them on demand.
const QuestionnaireDesigner = lazy(() => import('./components/QuestionnaireDesigner/QuestionnaireDesigner'));
const QuestionnaireResults = lazy(() => import('./components/QuestionnaireResults/QuestionnaireResults'));
const page = (element: React.ReactNode) => <Suspense fallback={null}>{element}</Suspense>;

function App() {
    const { isAuthenticated } = useOidc();

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [result, setResult] = useState("");

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isError, setIsError] = useState(true);

    useEffect(() => {
        if (!isAuthenticated) {
            localStorage.removeItem("profileStore");
        }
    }, [isAuthenticated]);

    return (
        <div className="App">
            <Routes>
                {/* The shell asks unauthenticated visitors to sign in instead of rendering a blank page. */}
                <Route element={<AdminShell />}>
                    <Route path='/admin' element={<DashboardPage />} />
                    <Route path='/admin/profile/' element={<ProfilePage />} />
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
        </div>
    );

}

export default App;
