/**
 * @module @recurrsive/collectors/base
 *
 * Barrel export for the collector base infrastructure:
 * registry, scheduler, and governance utilities.
 *
 * @packageDocumentation
 */

export { CollectorRegistry } from './registry.js';

export {
  CollectorScheduler,
  type ScheduleConfig,
} from './scheduler.js';

export {
  GovernanceFilter,
  type PIIDetection,
  type PIIType,
  type AuditEntry,
} from './governance.js';
