const VALID_OPS = new Set(['PUT', 'PATCH', 'DELETE']);

export class SyncDataValidator {
  /**
   * Returns true if the given operation string is a recognised sync op.
   */
  static isValidOp(op: string): boolean {
    return VALID_OPS.has(op);
  }
}
