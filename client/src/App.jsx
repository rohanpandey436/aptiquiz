import { useEffect } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import Home from "./pages/Home.jsx";
import HostCreate from "./pages/HostCreate.jsx";
import HostRoom from "./pages/HostRoom.jsx";
import Play from "./pages/Play.jsx";
import League from "./pages/League.jsx";
import Sets from "./pages/Sets.jsx";
import NotFound from "./pages/NotFound.jsx";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host" element={<HostCreate />} />
        <Route path="/host/:code" element={<HostRoom />} />
        <Route path="/watch/:code" element={<HostRoom spectator />} />
        <Route path="/play" element={<Play />} />
        <Route path="/play/:code" element={<Play />} />
        <Route path="/league" element={<League />} />
        <Route path="/sets" element={<Sets />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
