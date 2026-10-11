import './App.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useOidc } from "@axa-fr/react-oidc";
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminWorkshops from "./components/AdminWorkshops/AdminWorkshops";
import AdminProfile from './components/AdminProfile/AdminProfile';

import AdminEvents from './components/AdminEvents/AdminEvents';
import AdminShell from "./admin/AdminShell";
import DashboardPage from "./admin/pages/DashboardPage";
import SpeakersPage from "./admin/pages/SpeakersPage";
import VenuesPage from "./admin/pages/VenuesPage";
import BackupPage from "./admin/pages/BackupPage";
import QuestionnairesPage from "./admin/pages/QuestionnairesPage";
import HomePage from "./site/home/HomePage";
import EventsPage from "./site/events/EventsPage";
import EventDetailPage from "./site/event/EventDetailPage";
import AdminDownloads from "./components/AdminDownloads/AdminDownloads";
import AdminBoard from "./components/AdminBoard/AdminBoard";
import AdminBoardDetail from "./components/AdminBoardDetail/AdminBoardDetail";
import AdminWorkshopDetail from "./components/AdminWorkshopDetail/AdminWorkshopDetail";
import AdminWorkshopCreate from "./components/AdminWorkshopCreate/AdminWorkshopCreate";
import AdminTopMenu from "./components/AdminTopMenu/AdminTopMenu";
import AdminTopMenuDetail from "./components/AdminTopMenuDetail/AdminTopMenuDetail";
import PublicQuestionnaire from "./components/PublicQuestionnaire/PublicQuestionnaire";

// The questionnaire designer and results pull in dnd-kit, Recharts and the DataGrid: load them on demand.
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
                    <Route path='/admin/profile/' element={<AdminProfile />} />
                    <Route path='/admin/board/' element={<AdminBoard pageName={"Board"} />} />
                    <Route path='/admin/board/:id' element={<AdminBoardDetail pageName={"Board Detail"} />} />
                    <Route path='/admin/speakers/' element={<SpeakersPage />} />
                    <Route path='/admin/speakers/:id' element={<SpeakersPage />} />
                    <Route path='/admin/workshops/' element={<AdminWorkshops pageName={"Workshops"} />} />
                    <Route path='/admin/workshop/create' element={<AdminWorkshopCreate />} />
                    <Route path='/admin/workshop/:id' element={<AdminWorkshopDetail pageName={"Workshop Detail"} />} />
                    <Route path='/admin/events/' element={<AdminEvents pageName={"Events"} />} />
                    <Route path='/admin/venues/' element={<VenuesPage />} />
                    <Route path='/admin/feedbacks' element={<Navigate to='/admin/questionnaires' replace />} />
                    <Route path='/admin/questionnaires' element={<QuestionnairesPage />} />
                    <Route path='/admin/questionnaires/:id/edit' element={page(<QuestionnaireDesigner />)} />
                    <Route path='/admin/questionnaires/:id/results' element={page(<QuestionnaireResults />)} />
                    <Route path='/admin/topmenu/' element={<AdminTopMenu pageName={"Top Menu"} />} />
                    <Route path='/admin/topmenu/:id' element={<AdminTopMenuDetail />} />
                    <Route path='/admin/downloads' element={<AdminDownloads pageName={"Downloads"} />} />
                    <Route path='/admin/import-export/' element={<BackupPage />} />
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
