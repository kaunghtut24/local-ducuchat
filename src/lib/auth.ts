/**
 * Authentication utilities
 *
 * Self-hosted authentication using Lucia Auth
 */

// Re-export everything from lucia
export {
  lucia,
  validateRequest,
  getCurrentUser,
  getCurrentOrganizationId,
  isAuthenticated,
  signOut,
} from './auth/lucia';
