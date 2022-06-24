/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react-hooks";
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
      reset: expect.any(Function),
    });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test",
      error: null,
      isLoading: false,
      reset: expect.any(Function),
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
      reset: expect.any(Function),
    });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: null,
      error: new Error("something went wrong"),
      isLoading: false,
      reset: expect.any(Function),
    });
  });

  test("should reset on demand", async () => {
    const { result, waitForNextUpdate } = renderHook(() =>
      useEndpoint({
        request: async () => "test",
      })
    );
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test",
      error: null,
      isLoading: false,
      reset: expect.any(Function),
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current).toEqual({
      data: null,
      error: null,
      isLoading: true,
      reset: expect.any(Function),
    });
    await waitForNextUpdate();
  });

  test("should respect the condition", async () => {
    const { result, waitForNextUpdate, rerender } = renderHook(
      (props) => useEndpoint(props),
      {
        initialProps: {
          request: async () => "test",
          when: false as boolean | (() => boolean),
        },
      }
    );
    expect(result.current).toEqual({
      data: null,
      error: null,
      isLoading: false,
      reset: expect.any(Function),
    });
    rerender({ request: async () => "test", when: () => true });
    expect(result.current).toEqual({
      data: null,
      error: null,
      isLoading: true,
      reset: expect.any(Function),
    });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test",
      error: null,
      isLoading: false,
      reset: expect.any(Function),
    });
  });

  test("should monitor variables", async () => {
    let dependency = "something";
    const request = async () => `test ${dependency}`;
    const { result, waitForNextUpdate, rerender } = renderHook(
      (props) => useEndpoint(props),
      {
        initialProps: {
          request,
          watch: [dependency],
        },
      }
    );
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test something",
      error: null,
      isLoading: false,
      reset: expect.any(Function),
    });
    dependency = "anything";
    rerender({ request, watch: [dependency] });
    await waitForNextUpdate();
    expect(result.current).toEqual({
      data: "test anything",
      error: null,
      isLoading: false,
      reset: expect.any(Function),
    });
  });
});
