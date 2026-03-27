// All monetary values are stored in paise (1 rupee = 100 paise)

export const currencyFormatter = (
  value: number,
  currencySymbol?: string,
  positiveOnly?: boolean
) => {
  const num = value < 0 && positiveOnly ? value * -1 : value;
  const rupees = num / 100;
  return `${currencySymbol ?? '₹'} ${rupees.toFixed(2)}`.replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ','
  );
};

export const formatAmount = (paise: number): string => {
  return (paise / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const formatAmountCompact = (paise: number): string => {
  const rupees = paise / 100;
  if (rupees >= 10_00_000) return `₹${(rupees / 10_00_000).toFixed(1)}L`;
  if (rupees >= 1_000) return `₹${(rupees / 1_000).toFixed(1)}K`;
  return `₹${rupees.toFixed(2)}`;
};

export const toPaise = (rupees: number): number => Math.round(rupees * 100);

export const toRupees = (paise: number): number => paise / 100;

export function checkNullUndefinedEmptyString(value?: string) {
  if (value === null || value === undefined || value?.toString()?.trim() === '') {
    return '-';
  } else {
    return value;
  }
}

export function isEmptyString(value?: string) {
  if (value == null || value?.toString()?.trim() === '') {
    return true;
  } else {
    return false;
  }
}

// Get inclusive unit price from exclusive line cost
export const getUnitCost = (props: {
  totalTax: number;
  lineCost?: number; // tax exclusive
  qty?: number;
}): number => {
  try {
    const { totalTax, lineCost, qty } = props;
    if (!qty || qty === 0 || !lineCost) {
      return lineCost ? lineCost : 0;
    }
    const taxedValue = getTaxedValue(lineCost, totalTax);
    return parseFloat((taxedValue / qty).toFixed(2));
  } catch (e) {
    return 0;
  }
};

// Get exclusive line cost from inclusive unit price
export const getLineCost = (props: {
  totalTax: number;
  unitCost?: number; // tax inclusive
  qty?: number;
}): number => {
  try {
    const { totalTax, unitCost, qty } = props;
    if (!qty || qty === 0 || !unitCost) {
      return unitCost ? unitCost : 0;
    }
    const amountBeforeTax = getTaxExclusiveValue(unitCost, totalTax);
    return parseFloat((amountBeforeTax * qty).toFixed(2));
  } catch (e) {
    return 0;
  }
};

export const getTaxedValue = (price: number, totalTax: number) => {
  return price * (1 + totalTax / 100);
};

export const getTaxExclusiveValue = (price: number, totalTax: number) => {
  return price / (1 + totalTax / 100);
};

export const keyDown = (e: any) => {
  if (['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
    return;
  }
  if (!/^\d$/.test(e.key)) {
    e.preventDefault();
  }
};
