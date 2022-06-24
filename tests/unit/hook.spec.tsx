/**
 * @jest-environment jsdom
 */

import { renderHook } from "@testing-library/react-hooks";
import { useEndpoint } from "../../src";

describe("useEndpoint() hook", () => {
  test("Initially returns null and the data then", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useEndpoint({
        request: async () => "test",
      })
    );
    expect(result.current).toEqual({
      data: null,
      error: null,
      isLoading: true,
    });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test",
      error: null,
      isLoading: false,
    });
  });

  test("should catch error", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useEndpoint({
        request: async () => {
          throw new Error("something went wrong");
        },
      })
    );
    expect(result.current).toEqual({
      data: null,
      error: null,
      isLoading: true,
    });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: null,
      error: new Error("something went wrong"),
      isLoading: false,
    });
  });
});
