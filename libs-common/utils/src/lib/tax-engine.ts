/**
 * 2026 India GST Engine — Core Calculation Utility
 * Compatible with both NestJS (Backend) and React Native/Web (Frontend).
 */

export enum RegistrationType {
  REGULAR = 'REGULAR',
  COMPOSITION = 'COMPOSITION',
}

export enum TransactionType {
  INTRA_STATE = 'INTRA_STATE',
  INTER_STATE = 'INTER_STATE',
}

export interface TaxCalculationParams {
  mrp: number;               // Total price including or excluding tax
  gstRate: number;           // Combined GST rate (e.g., 18 for 18%)
  isInclusive: boolean;      // True if MRP already includes GST
  storeStateCode: string;    // 2-digit code (e.g., '29')
  customerStateCode: string; // 2-digit code
  isUnionTerritory: boolean; // True if the destination is a UT without legislature
  registrationType: RegistrationType;
  hsnCode?: string;          // For 2026 validation
  isB2B?: boolean;           // For strict HSN length check
}

export interface TaxBreakdown {
  taxableAmount: number;     // Base price
  cgstRate: number;
  sgstRate: number;
  utgstRate: number;
  igstRate: number;
  cgstAmount: number;
  sgstAmount: number;
  utgstAmount: number;
  igstAmount: number;
  totalTax: number;
  totalAmount: number;       // Final price to customer
  invoiceTitle: string;      // "Tax Invoice" vs "Bill of Supply"
}

export class GSTCalculator {
  /**
   * Determine if transaction is Intra-state (CGST+SGST/UTGST) or Inter-state (IGST)
   */
  static getTransactionType(storeState: string, customerState: string): TransactionType {
    if (!customerState || storeState === customerState) {
      return TransactionType.INTRA_STATE;
    }
    return TransactionType.INTER_STATE;
  }

  /**
   * Calculate full tax breakdown based on 2026 rules
   */
  static calculate(params: TaxCalculationParams): TaxBreakdown {
    const {
      mrp,
      gstRate,
      isInclusive,
      storeStateCode,
      customerStateCode,
      isUnionTerritory,
      registrationType,
    } = params;

    const transactionType = this.getTransactionType(storeStateCode, customerStateCode);
    const isComposition = registrationType === RegistrationType.COMPOSITION;

    let taxableAmount: number;
    let totalTax: number;

    // 1. Reverse Calculation (if inclusive)
    if (isInclusive) {
      // Base = MRP / (1 + Rate/100)
      taxableAmount = mrp / (1 + gstRate / 100);
      totalTax = mrp - taxableAmount;
    } else {
      taxableAmount = mrp;
      totalTax = (mrp * gstRate) / 100;
    }

    // 2. Resolve Rates and Components
    let cgstRate = 0, sgstRate = 0, utgstNameRate = 0, igstRate = 0;
    let cgstAmount = 0, sgstAmount = 0, utgstAmount = 0, igstAmount = 0;

    if (transactionType === TransactionType.INTRA_STATE) {
      cgstRate = gstRate / 2;
      if (isUnionTerritory) {
        utgstNameRate = gstRate / 2;
      } else {
        sgstRate = gstRate / 2;
      }
    } else {
      igstRate = gstRate;
    }

    // 3. Composition Scheme Override
    // For Composition dealers, Rate on invoice is 0% (Tax not collected from customer)
    // but the system still records the internal components for liability audit.
    const effectiveTotalTax = isComposition ? 0 : totalTax;
    
    if (!isComposition) {
      if (transactionType === TransactionType.INTRA_STATE) {
        cgstAmount = totalTax / 2;
        if (isUnionTerritory) {
          utgstAmount = totalTax / 2;
        } else {
          sgstAmount = totalTax / 2;
        }
      } else {
        igstAmount = totalTax;
      }
    }

    return {
      taxableAmount: this.round(taxableAmount),
      cgstRate,
      sgstRate,
      utgstRate: utgstNameRate,
      igstRate,
      cgstAmount: this.round(cgstAmount),
      sgstAmount: this.round(sgstAmount),
      utgstAmount: this.round(utgstAmount),
      igstAmount: this.round(igstAmount),
      totalTax: this.round(effectiveTotalTax),
      totalAmount: this.round(taxableAmount + effectiveTotalTax),
      invoiceTitle: isComposition ? 'Bill of Supply' : 'Tax Invoice',
    };
  }

  /**
   * 2026 HSN Validation Logic
   * Minimum 6 digits required for B2B transactions in GST 2.0
   */
  static validateHSN(hsnCode: string, isB2B: boolean = false): boolean {
    if (!hsnCode) return false;
    const clean = hsnCode.replace(/\D/g, '');
    if (isB2B && clean.length < 6) return false;
    return clean.length >= 4;
  }

  /**
   * Handle Threshold-based Pricing (e.g. Apparel < 2500 @ 5%, > 2500 @ 18%)
   */
  static resolveThresholdRate(price: number, thresholds: { limit: number, lowRate: number, highRate: number }): number {
    return price <= thresholds.limit ? thresholds.lowRate : thresholds.highRate;
  }

  private static round(num: number): number {
    return Math.round((num + Number.EPSILON) * 1000) / 1000;
  }
}
