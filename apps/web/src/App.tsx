import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import Account from "./pages/Account";
import { Login, Register } from "./pages/Auth";
import EventDetail from "./pages/EventDetail";
import Events from "./pages/Events";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

const OrganizerRoutes = lazy(() => import("./pages/organizer/OrganizerRoutes"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="events" element={<Events />} />
        <Route path="events/:slug" element={<EventDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="account" element={<Account />} />
        <Route path="organizer/*" element={<Suspense fallback={<div className="container page"><i className="skel" style={{ height: 240 }} /></div>}><OrganizerRoutes /></Suspense>} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
