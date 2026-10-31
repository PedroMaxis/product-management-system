import { createContext, useCallback, useContext, useRef, useState } from "react";

const Avisos = createContext(null);
export const useAvisos = () => useContext(Avisos);

/** Avisos curtos no canto da tela (substituem o alert()) */
export function AvisosProvider({ children }) {
  const [lista, setLista] = useState([]);
  const n = useRef(0);
  const avisar = useCallback((texto, tipo = "ok") => {
    const id = ++n.current;
    setLista((l) => [...l.slice(-2), { id, texto, tipo }]);
    setTimeout(() => setLista((l) => l.filter((a) => a.id !== id)), 4200);
  }, []);
  return (
    <Avisos.Provider value={avisar}>
      {children}
      <div className="avisos" role="status" aria-live="polite">
        {lista.map((a) => <div key={a.id} className={`aviso aviso-${a.tipo}`}>{a.texto}</div>)}
      </div>
    </Avisos.Provider>
  );
}
