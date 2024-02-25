import { z } from "zod";

let lastGivenPort = 8010;
const reservedPorts = {
  example: 8090,
};
export const givePort = (test?: keyof typeof reservedPorts) => {
  if (test && reservedPorts[test]) {
    return reservedPorts[test];
  }
  do {
    lastGivenPort++;
  } while (Object.values(reservedPorts).includes(lastGivenPort));
  return lastGivenPort;
};

export const waitFor = async (cb: () => boolean) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      clearInterval(timer); // eslint-disable-line @typescript-eslint/no-use-before-define
      reject();
    }, 10000);
    const timer = setInterval(() => {
      if (cb()) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve("OK");
      }
    }, 100);
  });

export const serializeSchemaForTest = (subject: z.ZodTypeAny) =>
  JSON.parse(JSON.stringify(subject));
