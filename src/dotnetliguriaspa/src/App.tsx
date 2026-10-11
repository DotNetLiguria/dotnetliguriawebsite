import './App.css';
import React, { lazy, Suspense, useEffect, useState } from 'react';
import { useOidc } from "@axa-fr/react-oidc";
import { Navigate, Route, Routes } from 'react-router-dom';
import AdminWorkshops from "./components/AdminWorkshops/AdminWorkshops";
import AdminSpeakers from "./components/AdminSpeakers/AdminSpeakers";
import AdminHome from './components/AdminHome/AdminHome';
import AdminProfile from './components/AdminProfile/AdminProfile';

import AdminEvents from './components/AdminEvents/AdminEvents';
import AdminVenues from './components/AdminVenues/AdminVenues';
import AdminLayout from "./components/AdminLayout/AdminLayout";
import HomePage from "./site/home/HomePage";
import EventsPage from "./site/events/EventsPage";
import EventDetailPage from "./site/event/EventDetailPage";
import AdminDownloads from "./components/AdminDownloads/AdminDownloads";
import AdminImportExport from "./components/AdminImportExport/AdminImportExport";
import AdminBoard from "./components/AdminBoard/AdminBoard";
import AdminBoardDetail from "./components/AdminBoardDetail/AdminBoardDetail";
import AdminSpeakerDetail from "./components/AdminSpeakerDetail/AdminSpeakerDetail";
import AdminWorkshopDetail from "./components/AdminWorkshopDetail/AdminWorkshopDetail";
import AdminWorkshopCreate from "./components/AdminWorkshopCreate/AdminWorkshopCreate";
import AdminTopMenu from "./components/AdminTopMenu/AdminTopMenu";
import AdminTopMenuDetail from "./components/AdminTopMenuDetail/AdminTopMenuDetail";
import PublicQuestionnaire from "./components/PublicQuestionnaire/PublicQuestionnaire";
import LegacyRedirect from "./site/legacy/LegacyRedirect";

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
                {isAuthenticated && (
                    <Route element={<AdminLayout />}>
                        <Route path='/admin' element={<AdminHome pageName={"Admin Dashboard"} />} />
                        <Route path='/admin/profile/' element={<AdminProfile />} />
                        <Route path='/admin/board/' element={<AdminBoard pageName={"Board"} />} />
                        <Route path='/admin/board/:id' element={<AdminBoardDetail pageName={"Board Detail"} />} />
                        <Route path='/admin/speakers/' element={<AdminSpeakers pageName={"Speakers"} />} />
                        <Route path='/admin/speakers/:id' element={<AdminSpeakerDetail />} />
                        <Route path='/admin/workshops/' element={<AdminWorkshops pageName={"Workshops"} />} />
                        <Route path='/admin/workshop/create' element={<AdminWorkshopCreate />} />
                        <Route path='/admin/workshop/:id' element={<AdminWorkshopDetail pageName={"Workshop Detail"} />} />
                        <Route path='/admin/events/' element={<AdminEvents pageName={"Events"} />} />
                        <Route path='/admin/venues/' element={<AdminVenues />} />
                        <Route path='/admin/feedbacks' element={<Navigate to='/admin/questionnaires' replace />} />
                        <Route path='/admin/questionnaires' element={page(<AdminQuestionnaires pageName={"Questionari"} />)} />
                        <Route path='/admin/questionnaires/:id/edit' element={page(<QuestionnaireDesigner />)} />
                        <Route path='/admin/questionnaires/:id/results' element={page(<QuestionnaireResults />)} />
                        <Route path='/admin/topmenu/' element={<AdminTopMenu pageName={"Top Menu"} />} />
                        <Route path='/admin/topmenu/:id' element={<AdminTopMenuDetail />} />
                        <Route path='/admin/downloads' element={<AdminDownloads pageName={"Downloads"} />} />
                        <Route path='/admin/import-export/' element={<AdminImportExport />} />
                    </Route>
                )}
                <Route path='/' element={<HomePage />} />
                <Route path="/workshops" element={<EventsPage />} />
                <Route path="/workshop/:id" element={<EventDetailPage />} />
                <Route path="/feedback/:workshopId" element={<PublicQuestionnaire />} />
                <Route path="/q/:questionnaireId" element={<PublicQuestionnaire />} />
                {/* Reserved prefixes keep rendering nothing (admin without a session, OIDC callbacks handled by
                    OidcProvider before this tree); every other unknown address is redirected when it belongs
                    to the previous site, otherwise it is the public not-found page. */}
                <Route path="/admin/*" element={null} />
                <Route path="/authentication/*" element={null} />
                <Route path="*" element={<LegacyRedirect />} />
            </Routes>
        </div>
    );

}

export default App;
