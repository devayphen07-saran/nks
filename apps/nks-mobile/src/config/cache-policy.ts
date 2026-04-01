/**
 * ✅ MODULE 6: Cache Policy Configuration
 *
 * Purpose:
 * - Define cache policies for different resource types
 * - Configure TTL, max size, and revalidation rules
 * - Centralize cache behavior configuration
 */

import { CachePolicy } from '@/services/cache/CacheManager';

export const CACHE_POLICIES: Record<string, CachePolicy> = {
  // User data - long-lived, revalidate on focus
  user: {
    ttl: 60 * 60 * 1000, // 1 hour
    maxSize: 100 * 1024, // 100KB
    revalidateOnFocus: true,
    persistAcrossAppRestart: false,
  },

  // Store data - medium-lived, revalidate frequently
  stores: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 5 * 1024 * 1024, // 5MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Products - medium-lived
  products: {
    ttl: 1 * 60 * 60 * 1000, // 1 hour
    maxSize: 10 * 1024 * 1024, // 10MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Product details - long-lived
  'product-detail': {
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    maxSize: 500 * 1024, // 500KB
    revalidateOnFocus: false,
    persistAcrossAppRestart: true,
  },

  // Orders - short-lived, frequently changes
  orders: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 10 * 1024 * 1024, // 10MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Order details - medium-lived
  'order-detail': {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 2 * 1024 * 1024, // 2MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Inventory - short-lived, critical freshness
  inventory: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 5 * 1024 * 1024, // 5MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: false,
  },

  // Customers - medium-lived
  customers: {
    ttl: 1 * 60 * 60 * 1000, // 1 hour
    maxSize: 10 * 1024 * 1024, // 10MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Staff/employees - long-lived
  staff: {
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    maxSize: 5 * 1024 * 1024, // 5MB
    revalidateOnFocus: false,
    persistAcrossAppRestart: true,
  },

  // Permissions - long-lived, non-critical
  permissions: {
    ttl: 2 * 60 * 60 * 1000, // 2 hours
    maxSize: 100 * 1024, // 100KB
    revalidateOnFocus: false,
    persistAcrossAppRestart: true,
  },

  // Analytics/reports - short-lived
  reports: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 5 * 1024 * 1024, // 5MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: false,
  },

  // Promotions - medium-lived
  promotions: {
    ttl: 30 * 60 * 1000, // 30 minutes
    maxSize: 2 * 1024 * 1024, // 2MB
    revalidateOnFocus: true,
    persistAcrossAppRestart: true,
  },

  // Categories - long-lived
  categories: {
    ttl: 3 * 60 * 60 * 1000, // 3 hours
    maxSize: 1 * 1024 * 1024, // 1MB
    revalidateOnFocus: false,
    persistAcrossAppRestart: true,
  },

  // Settings - very long-lived
  settings: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxSize: 500 * 1024, // 500KB
    revalidateOnFocus: false,
    persistAcrossAppRestart: true,
  },
};

/**
 * Get policy for resource type
 * Falls back to default policy if not defined
 */
export function getCachePolicy(resourceType: string): CachePolicy {
  return (
    CACHE_POLICIES[resourceType] || {
      ttl: 1 * 60 * 60 * 1000, // 1 hour default
      revalidateOnFocus: true,
      persistAcrossAppRestart: true,
    }
  );
}

/**
 * Register or update policy for a resource type
 */
export function registerCachePolicy(resourceType: string, policy: CachePolicy): void {
  CACHE_POLICIES[resourceType] = policy;
}
