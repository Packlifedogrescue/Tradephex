// Compatibility module for the server-only Resend helpers.
// Existing API endpoints import './_email.js', while the original implementation
// was committed under 'api_email.js'. Keep a single canonical implementation.
export * from './api_email.js';
