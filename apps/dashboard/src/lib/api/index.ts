/**
 * @module Dashboard API — Barrel Export
 *
 * Re-exports all domain modules so consumers can import from a single path.
 */

export { apiFetch, ApiError, BASE_URL } from './client';
export * from './health';
export * from './analysis';
export * from './opportunities';
export * from './graph';
export * from './projects';
export * from './intelligence';
export * from './platform';
export * from './governance';
export * from './experiments';
export * from './reports';
export * from './settings';
