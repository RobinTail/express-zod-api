import { DependsOnMethodError, OpenAPIError, RoutingError } from "../../src";
import { IOSchemaError, ResultHandlerError } from "../../src/errors";

describe("Errors", () => {
  describe("RoutingError", () => {
    test("should be an instance of Error", () => {
      expect(new RoutingError("test") instanceof RoutingError).toBeTruthy();
      expect(new RoutingError("test") instanceof Error).toBeTruthy();
    });
  });

  describe("OpenAPIError", () => {
    test("should be an instance of Error", () => {
      expect(new OpenAPIError("test") instanceof OpenAPIError).toBeTruthy();
      expect(new OpenAPIError("test") instanceof Error).toBeTruthy();
    });
  });

  describe("IOSchemaError", () => {
    test("should be an instance of Error", () => {
      expect(new IOSchemaError("test") instanceof IOSchemaError).toBeTruthy();
      expect(new IOSchemaError("test") instanceof Error).toBeTruthy();
    });
  });

  describe("DependsOnMethodError", () => {
    test("should be an instance of RoutingError", () => {
      expect(
        new DependsOnMethodError("test") instanceof DependsOnMethodError
      ).toBeTruthy();
      expect(
        new DependsOnMethodError("test") instanceof RoutingError
      ).toBeTruthy();
    });
  });

  describe("ResultHandlerError", () => {
    test("should be an instance of Error", () => {
      expect(
        new ResultHandlerError("test") instanceof ResultHandlerError
      ).toBeTruthy();
      expect(new ResultHandlerError("test") instanceof Error).toBeTruthy();
    });

    test(".hasOriginalError() should depend on original error", () => {
      const error = new ResultHandlerError("test", new Error("test2"));
      expect(error.hasOriginalError()).toBeTruthy();
      const error2 = new ResultHandlerError("test");
      expect(error2.hasOriginalError()).toBeFalsy();
    });

    test(".getOriginalErrorMessage() should depend on original error", () => {
      const error = new ResultHandlerError("test", new Error("test2"));
      expect(error.getOriginalErrorMessage()).toBe("test2");
      const error2 = new ResultHandlerError("test");
      expect(error2.getOriginalErrorMessage()).toBeUndefined();
    });
  });
});
