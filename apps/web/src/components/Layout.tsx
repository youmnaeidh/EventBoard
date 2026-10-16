import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AssistantWidget } from "./AssistantWidget";
import { Footer } from "./Footer";
import { Header } from "./Header";

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pathname]);
  return (
    <>
      <a href="#main" className="skip-link">تخطّي إلى المحتوى</a>
      <Header />
      <main id="main"><Outlet /></main>
      <Footer />
      <AssistantWidget />
    </>
  );
}
