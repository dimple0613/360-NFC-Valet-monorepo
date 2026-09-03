export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export const isValidValetId = (value: string): boolean =>
  /^[a-zA-Z0-9_-]{3,32}$/.test(value.trim());
