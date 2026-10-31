import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, HashRouter } from "react-router-dom";
import App from "./App";
import { AvisosProvider } from "./lib/contextos";
import "./styles.css";

// no demo estático (GitHub Pages) as rotas usam # para não depender de fallback do servidor
const Roteador = import.meta.env.VITE_DEMO ? HashRouter : BrowserRouter;

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Roteador future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AvisosProvider><App /></AvisosProvider>
    </Roteador>
  </StrictMode>,
);
