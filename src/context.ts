import React from "react";

interface AbstractClient {
  provide: <T>(method: string, path: string, params: any) => Promise<T>;
}

export interface EZContextType {
  client: AbstractClient;
}

export const EZContext = React.createContext<EZContextType>({
  client: {
    provide: () => {
      throw new Error("EZContext is not initialized");
    },
  },
});

export const EZProvider = EZContext.Provider;
