/**
 * Routes Module Validators
 *
 * Custom validators for routes (beyond Zod schema validation):
 * - Route scope validation (admin vs store)
 * - Route type validation (sidebar, tab, screen, modal)
 * - Navigation hierarchy validation
 * - Permission structure validation
 */

export { RoutesValidator } from './routes.validator';
