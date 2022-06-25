import React from "react";
import { AbstractCache, DefaultCache } from "./cache";

interface UseEndpointProps<T> {
  /** @desc call the ExpressZodAPIClient::provide() method here */
  request: () => Promise<T>;
  /**
   * @desc request the endpoint only in the specified case
   * @default true
   * */
  when?: boolean | (() => boolean);
  /**
   * @desc observe changes of the specified variables and refresh the data accordingly
   * @default []
   * */
  watch?: any[];
  /**
   * @desc optional cache settings
   * @default No cache
   * */
  cache?: {
    /**
     * @desc cache provider instance
     * @default DefaultCache
     * */
    provider?: AbstractCache;
    /**
     * @desc key generating function, most likely should depend on the variables listed in watch option
     */
    keyGen: () => string;
    /**
     * @desc how long to keep the data in cache (number of seconds)
     * @default permanently
     * */
    expireInSeconds?: number;
  };
}

export const useEndpoint = <T>({
  request,
  when = true,
  watch = [],
  cache,
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
  const cacheProvider = React.useMemo(
    () => (cache && cache.provider ? cache.provider : new DefaultCache()),
    [cache]
  );

  const dataProvider = React.useCallback(() => request(), [request]);
  const reset = React.useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  React.useEffect(() => {
    if (shouldRequest) {
      setIsLoading(true);
      (async () => {
        try {
          const newData = await (cache
            ? cacheProvider.ensure<T>(
                cache.keyGen(),
                dataProvider,
                cache.expireInSeconds
              )
            : dataProvider());
          setData(newData);
        } catch (e) {
          if (e instanceof Error) {
            setError(e);
          }
        }
        setIsLoading(false);
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldRequest]);

  React.useEffect(() => {
    if (watch.length > 0) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...watch]);

  return { isLoading, data, error, reset };
};
