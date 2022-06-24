import React from "react";

interface UseEndpointProps<T> {
  request: () => Promise<T>;
  when?: boolean;
}

export const useEndpoint = <T>({
  request,
  when = true,
}: UseEndpointProps<T>) => {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const hasData = React.useMemo(() => data !== null, [data]);
  const hasError = React.useMemo(() => error !== null, [error]);

  const shouldRequest = React.useMemo(
    () => !hasData && !hasError && !isLoading && when,
    [hasData, hasError, isLoading, when]
  );

  const reset = React.useCallback(() => {
    setData(null);
    setError(null);
  }, []);

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

  return { isLoading, data, error, reset };
};
