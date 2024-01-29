import { brotliDecompressSync } from "node:zlib";

export const getStartupLogo = () =>
  brotliDecompressSync(
    Buffer.from(
      `G2UGAJyHsTGz+OltxNHX6DSRcitLIZ9efyGq4VSCtnT3QOoiI9NP5uP4ufQmnEzg/P/3TlsLMJMxDdN732tMauMaPPb972/K9vE4kQADCsTDzK3hkSD5GYymncMYgn1qsY71zpMiMbhNDSyG4M0ABlvBBTq210+c/oBknqeFsDK8Bao20GLb/c3DQhh1kSxE0kyLCs608JmpUtJWoKTaFAGfrDnPJkJHtmSYsO0zfBn+b1sac5SRNjRGkAHVhscAKCJG3XTUHGDBRGRy2d65lZjVa8CFHvuKTNYpo2rNKhKUaHMGCtrzo8DkmZccjSZ81rtzgHrrLGuiUD7rVC3FSNVWAVmhANRwqDiTgzujBlerc0X6bmjeiFE7U71HCTHofcqFRRWrsz8h9oj3l698/Fv5Ymwu3rzCdfJOLH7u2Np+4gYk0ly/vHN297xBW2UkMTSxEN07iEM+2k7vcIE1OMYi3BTPFnwstOz+bN6vPrh7JgCEKfblvyBgc2rhgXaBobM/ycE3rnUuX3I4YIBj49GKcAM=`,
      "base64",
    ),
  ).toString();
