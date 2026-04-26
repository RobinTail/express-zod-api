const customMock = vi.fn();

const blue = vi.fn();
const green = vi.fn();
const hex = vi.fn(() => customMock);
const red = vi.fn();
const cyanBright = vi.fn();

vi.mock("ansis", () => ({
  default: {
    isSupported: vi.fn().mockReturnValue(true),
  },
  blue,
  green,
  hex,
  red,
  cyanBright,
}));

export {
  blue as blueMock,
  green as greenMock,
  red as redMock,
  cyanBright as cyanMock,
  customMock,
};
