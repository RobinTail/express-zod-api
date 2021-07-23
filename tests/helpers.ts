export const waitFor = async (cb: () => boolean) =>
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(reject, 5000);
    const timer = setInterval(() => {
      if (cb()) {
        clearInterval(timer);
        clearTimeout(timeout);
        resolve('OK');
      }
    }, 100);
  });

export const delay = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));
