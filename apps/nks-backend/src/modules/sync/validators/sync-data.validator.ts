const VALID_OPS = new Set(['create', 'update', 'delete']);

export class SyncDataValidator {
  /**
   * Returns true if the given operation string is a recognised sync op.
   */
  static isValidOp(op: string): boolean {
    return VALID_OPS.has(op);
  }
}
