import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domMax,
  m,
} from "motion/react";
import { Suspense, lazy } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router";
import { useOverview, usePipeline } from "./api/client";
import { AppBar } from "./components/AppBar";
import { BootScreen } from "./components/BootScreen";
import { NeedsSensorData } from "./components/NeedsSensorData";
import { Footer } from "./components/Footer";
import { TooltipProvider } from "./components/Tooltip";
import { page } from "./motion/tokens";

// Cada vista vira um pedaço separado do bundle e só carrega quando é aberta.
const StationView = lazy(() => import("./views/StationView"));
const ModelsView = lazy(() => import("./views/ModelsView"));
const PipelineView = lazy(() => import("./views/PipelineView"));
const DataView = lazy(() => import("./views/DataView"));
const AssistantView = lazy(() => import("./views/AssistantView"));
const ReportView = lazy(() => import("./views/ReportView"));
const ImagesView = lazy(() => import("./views/ImagesView"));
const WelcomeView = lazy(() => import("./views/WelcomeView"));
const GuideView = lazy(() => import("./views/GuideView"));
const NotebookView = lazy(() => import("./views/NotebookView"));

export function App() {
  const location = useLocation();
  const overview = useOverview();
  const pipeline = usePipeline();
  const section = location.pathname.split("/")[1] || "bacia";
  const chat = section === "assistente";
  const data = overview.data;
  // Sem dados de sensores a API responde "não pronto" (503): o painel abre mesmo assim, para trabalhar com imagens.
  // Só espera quando está carregando, quando uma análise está rodando ou quando o sistema não responde.
  const notReady = overview.error?.status === 503;
  const booting = !data && (!notReady || !!pipeline.data?.running);

  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">
        <TooltipProvider>
          <AppBar
            pipeline={pipeline.data}
            period={overview.data?.period}
            offline={!!pipeline.error}
          />
          <div className="app-content">
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => window.scrollTo({ top: 0 })}
            >
              <m.main
                id="main-content"
                tabIndex={-1}
                key={section}
                className={`main${chat ? " is-chat" : ""}`}
                variants={page}
                initial="initial"
                animate="enter"
                exit="exit"
              >
                <Suspense fallback={<div className="view-loading" />}>
                  <Routes location={location}>
                    <Route index element={<WelcomeView data={data} />} />
                    <Route path="imagens" element={<ImagesView />} />
                    <Route
                      path="caderno"
                      element={<NotebookView data={data} />}
                    />
                    <Route
                      path="estacoes/:id?"
                      element={
                        data ? (
                          <StationView data={data} />
                        ) : booting ? (
                          <BootScreen
                            error={overview.error}
                            pipeline={pipeline.data}
                          />
                        ) : (
                          <NeedsSensorData title="Estações" />
                        )
                      }
                    />
                    <Route
                      path="analises"
                      element={
                        data ? (
                          <ModelsView data={data} />
                        ) : booting ? (
                          <BootScreen
                            error={overview.error}
                            pipeline={pipeline.data}
                          />
                        ) : (
                          <NeedsSensorData title="Análises da IA" />
                        )
                      }
                    />
                    <Route
                      path="relatorio"
                      element={<ReportView data={data} />}
                    />
                    <Route
                      path="atualizar"
                      element={
                        data ? (
                          <PipelineView data={data} pipeline={pipeline} />
                        ) : booting ? (
                          <BootScreen
                            error={overview.error}
                            pipeline={pipeline.data}
                          />
                        ) : (
                          <NeedsSensorData title="Atualizar a análise" />
                        )
                      }
                    />
                    <Route
                      path="dados"
                      element={<DataView data={data} pipeline={pipeline} />}
                    />
                    <Route path="assistente" element={<AssistantView />} />
                    <Route path="guia" element={<GuideView />} />
                    <Route
                      path="modelos"
                      element={<Navigate to="/analises" replace />}
                    />
                    <Route
                      path="pipeline"
                      element={<Navigate to="/atualizar" replace />}
                    />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
              </m.main>
            </AnimatePresence>
            {!chat && <Footer />}
          </div>
        </TooltipProvider>
      </MotionConfig>
    </LazyMotion>
  );
}
