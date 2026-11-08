// Development defaults. Switch dataSource to 'api' only after the PHP contract is agreed.
// Paths are resolved against the current document, including XAMPP subdirectories.
export const config = Object.freeze({
  dataSource: 'mock',
  apiBaseUrl: './api/',
  mockBaseUrl: './mock/',
  timeoutMs: 12000,
});
