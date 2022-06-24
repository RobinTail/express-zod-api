import React from "react";

interface UseEndpointProps<T> {
  /** @desc call the ExpressZodAPIClient::provide() method here */
  request: () => Promise<T>;
  /** @desc request the endpoint only in the specified case */
  when?: boolean | (() => boolean);
  /** @desc observe changes of the specified variables and refresh the data accordingly */
  watch?: any[];
}

export const useEndpoint = <T>({
  request,
  when = true,
  watch = [],
}: UseEndpointProps<T>) => {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const hasData = React.useMemo(() => data !== null, [data]);
  const hasError = React.useMemo(() => error !== null, [error]);
  const isConditionMet = React.useMemo(
    () => (typeof when === "function" ? when() : when),
    [when]
  );

  const shouldRequest = React.useMemo(
    () => !hasData && !hasError && !isLoading && isConditionMet,
    [hasData, hasError, isLoading, isConditionMet]
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

  React.useEffect(() => {
    if (watch.length > 0) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...watch]);

  return { isLoading, data, error, reset };
};
