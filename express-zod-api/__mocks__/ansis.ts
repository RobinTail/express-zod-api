import { vi } from "vitest";

const customMock = vi.fn();

export const blue = vi.fn();
export const green = vi.fn();
export const hex = vi.fn(() => customMock);
export const red = vi.fn();
export const cyanBright = vi.fn();

const defaultExport = {
  isSupported: vi.fn().mockReturnValue(true),
};

export default defaultExport;
