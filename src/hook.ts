import React from "react";

interface UseEndpointProps<T> {
  request: () => Promise<T>;
}

export const useEndpoint = <T>({ request }: UseEndpointProps<T>) => {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const hasData = React.useMemo(() => data !== null, [data]);
  const hasError = React.useMemo(() => error !== null, [error]);
  const shouldRequest = React.useMemo(
    () => !hasData && !hasError && !isLoading,
    [hasData, hasError, isLoading]
  );

  React.useEffect(() => {
    if (shouldRequest) {
      setIsLoading(true);
      (async () => {
        try {
          const newData = await request();
          setData(newData);
        } catch (e) {
          if (e instanceof Error) {
            setError(e);
          }
        }
        setIsLoading(false);
      })();
    }
  }, [request, shouldRequest]);

  return { isLoading, data, error };
};
