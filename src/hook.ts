import React from "react";
import { EZContext, EZContextType } from "./context";

interface UseEndpointProps<T> {
  request: (client: EZContextType["client"]) => Promise<T>;
}

export const useEndpoint = <T>({ request }: UseEndpointProps<T>) => {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const { client } = React.useContext(EZContext);

  React.useEffect(() => {
    setIsLoading(true);
    (async () => {
      try {
        setData(await request(client));
      } catch (e) {
        if (e instanceof Error) {
          setError(e);
        }
      }
      setIsLoading(false);
    })();
  }, [client, request]);

  return { isLoading, data, error };
};
