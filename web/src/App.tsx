import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from "motion/react";
import { Suspense, lazy } from "react";
import { Route, Routes, useLocation } from "react-router";
import { useOverview, usePipeline } from "./api/client";
import { AppBar } from "./components/AppBar";
import { BootScreen } from "./components/BootScreen";
import { Footer } from "./components/Footer";
import { TooltipProvider } from "./components/Tooltip";
import { page } from "./motion/tokens";

// Cada vista vira um pedaço separado do bundle e só carrega quando é aberta.
const BasinView = lazy(() => import("./views/BasinView"));
const StationView = lazy(() => import("./views/StationView"));
const ModelsView = lazy(() => import("./views/ModelsView"));
const PipelineView = lazy(() => import("./views/PipelineView"));
const DataView = lazy(() => import("./views/DataView"));
const AssistantView = lazy(() => import("./views/AssistantView"));

export function App() {
  const location = useLocation();
  const overview = useOverview();
  const pipeline = usePipeline();
  const section = location.pathname.split("/")[1] || "bacia";

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <AppBar pipeline={pipeline.data} period={overview.data?.period} />
          {overview.data ? (
            <AnimatePresence mode="wait" initial={false} onExitComplete={() => window.scrollTo({ top: 0 })}>
              <m.main key={section} className="main" variants={page} initial="initial" animate="enter" exit="exit">
                <Suspense fallback={<div className="view-loading" />}>
                  <Routes location={location}>
                    <Route index element={<BasinView data={overview.data} />} />
                    <Route path="estacoes/:id?" element={<StationView data={overview.data} />} />
                    <Route path="modelos" element={<ModelsView data={overview.data} />} />
                    <Route path="pipeline" element={<PipelineView data={overview.data} pipeline={pipeline} />} />
                    <Route path="dados" element={<DataView data={overview.data} pipeline={pipeline} />} />
                    <Route path="assistente" element={<AssistantView />} />
                    <Route path="*" element={<BasinView data={overview.data} />} />
                  </Routes>
                </Suspense>
              </m.main>
            </AnimatePresence>
          ) : (
            <BootScreen error={overview.error} pipeline={pipeline.data} />
          )}
          <Footer />
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
