import './App.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useOidc } from "@axa-fr/react-oidc";
import { Navigate, Route, Routes } from 'react-router-dom';

import AdminVenues from './components/AdminVenues/AdminVenues';
import AdminShell from "./admin/AdminShell";
import DashboardPage from "./admin/pages/DashboardPage";
import SpeakersPage from "./admin/pages/SpeakersPage";
import EventsAdminPage from "./admin/pages/EventsAdminPage";
import ProfilePage from "./admin/pages/ProfilePage";
import HomePage from "./site/home/HomePage";
import EventsPage from "./site/events/EventsPage";
import EventDetailPage from "./site/event/EventDetailPage";
import AdminDownloads from "./components/AdminDownloads/AdminDownloads";
import AdminImportExport from "./components/AdminImportExport/AdminImportExport";
import BoardPage from "./admin/pages/BoardPage";
import AdminWorkshopDetail from "./components/AdminWorkshopDetail/AdminWorkshopDetail";
import AdminWorkshopCreate from "./components/AdminWorkshopCreate/AdminWorkshopCreate";
import MenuPage from "./admin/pages/MenuPage";
import PublicQuestionnaire from "./components/PublicQuestionnaire/PublicQuestionnaire";

// Admin questionnaire tools pull in dnd-kit, Recharts and the DataGrid: load them on demand.
const AdminQuestionnaires = lazy(() => import('./components/AdminQuestionnaires/AdminQuestionnaires'));
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
                    <Route path='/admin/workshop/create' element={<AdminWorkshopCreate />} />
                    <Route path='/admin/workshop/:id' element={<AdminWorkshopDetail pageName={"Workshop Detail"} />} />
                    <Route path='/admin/events/' element={<Navigate to='/admin/workshops/' replace />} />
                    <Route path='/admin/venues/' element={<AdminVenues />} />
                    <Route path='/admin/feedbacks' element={<Navigate to='/admin/questionnaires' replace />} />
                    <Route path='/admin/questionnaires' element={page(<AdminQuestionnaires pageName={"Questionari"} />)} />
                    <Route path='/admin/questionnaires/:id/edit' element={page(<QuestionnaireDesigner />)} />
                    <Route path='/admin/questionnaires/:id/results' element={page(<QuestionnaireResults />)} />
                    <Route path='/admin/topmenu/' element={<MenuPage />} />
                    <Route path='/admin/topmenu/:id' element={<MenuPage />} />
                    <Route path='/admin/downloads' element={<AdminDownloads pageName={"Downloads"} />} />
                    <Route path='/admin/import-export/' element={<AdminImportExport />} />
                </Route>
                <Route path='/' element={<HomePage />} />
                <Route path="/workshops" element={<EventsPage />} />
                <Route path="/workshop/:id" element={<EventDetailPage />} />
                <Route path="/feedback/:workshopId" element={<PublicQuestionnaire />} />
                <Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} />
            </Routes>
        </div>
    );

}

export default App;
