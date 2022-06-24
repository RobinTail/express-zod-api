/**
 * @jest-environment jsdom
 */

import { render } from "@testing-library/react";
import { EZContext } from "../../src";
import React from "react";

describe("Context", () => {
  test("initial value is mocked", () => {
    expect(
      render(
        <EZContext.Consumer>
          {({ client }) => {
            try {
              client.provide("test", "test", "test");
              return "should not be here";
            } catch (e) {
              if (e instanceof Error) {
                return e.message;
              }
              return JSON.stringify(e);
            }
          }}
        </EZContext.Consumer>
      ).container
    ).toMatchSnapshot();
  });
});
