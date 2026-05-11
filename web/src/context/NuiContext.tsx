import React, { createContext, useContext, useEffect, useState } from 'react';

// Help from https://github.com/project-error/pe-utils
interface NuiMessageData<T = any> {
  action: string;
  data: T;
}

export const useNuiEvent = <T = any>(action: string, handler: (data: T) => void) => {
  const savedHandler = React.useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    const eventListener = (event: MessageEvent<NuiMessageData<T>>) => {
      const { action: eventAction, data } = event.data;

      if (savedHandler.current && eventAction === action) {
        savedHandler.current(data);
      }
    };

    window.addEventListener('message', eventListener);
    return () => window.removeEventListener('message', eventListener);
  }, [action]);
};

// Detecta o nome do resource em runtime. Ordem de preferencia:
// 1. `window.GetParentResourceName()` — injetado pelo CEF do FiveM no top frame.
//    Nao garantido em iframes (eg quando o plugin roda embedded no Qadmin).
// 2. Hostname `cfx-nui-{resource}` — parsado da URL atual. Funciona em iframe
//    porque o iframe e servido pelo proprio resource (origem propria).
// 3. Empty string — modo browser/dev. fetchNui retorna fallback sem chamar fetch.
function detectResourceName(): string {
  if (typeof window === 'undefined') return '';
  const fn = (window as any).GetParentResourceName;
  if (typeof fn === 'function') {
    const name = fn();
    if (typeof name === 'string' && name.length > 0) return name;
  }
  const match = window.location.host.match(/^cfx-nui-(.+)$/);
  if (match) return match[1];
  return '';
}

export const fetchNui = async <T = any>(eventName: string, data?: any): Promise<T> => {
  const resourceName = detectResourceName();

  // Browser/dev: sem resource → simula sucesso (callers ja tem .catch defensivo).
  if (!resourceName) {
    return undefined as unknown as T;
  }

  const resp = await fetch(`https://${resourceName}/${eventName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(data ?? {}),
  });

  return resp.json();
};

// Basic Context for global NUI state
export const NuiContext = createContext<{
  visible: boolean;
  setVisible: (visible: boolean) => void;
}>({
  visible: false,
  setVisible: () => {},
});

export const NuiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visible, setVisible] = useState(false);

  useNuiEvent('setVisible', (data: boolean) => {
    setVisible(data);
  });

  return (
    <NuiContext.Provider value={{ visible, setVisible }}>
      <div className={visible ? 'visible' : ''} style={{ display: visible ? 'flex' : 'none', width: '100%', height: '100%' }}>
        {children}
      </div>
    </NuiContext.Provider>
  );
};
