/**
 * Canadian currency formatting utilities
 */

/**
 * Format amount in cents to Canadian dollar display
 * @param amountInCents - Amount in cents (e.g., 2500 for $25.00)
 * @param options - Formatting options
 */
export function formatCAD(
  amountInCents: number,
  options: {
    showCurrency?: boolean;
    showSymbol?: boolean;
    compact?: boolean;
  } = {}
): string {
  const {
    showCurrency = false,
    showSymbol = true,
    compact = false
  } = options;

  const amount = amountInCents / 100;

  // Canadian locale formatting
  const formatter = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  let formatted = formatter.format(amount);

  // If we don't want the currency code, remove it
  if (!showCurrency) {
    formatted = formatted.replace(/\s?CAD\s?/gi, '');
  }

  // If we don't want the symbol, remove it
  if (!showSymbol) {
    formatted = formatted.replace('$', '');
  }

  // Compact format for large numbers
  if (compact && amount >= 1000) {
    if (amount >= 1000000) {
      return `$${(amount / 1000000).toFixed(1)}M${showCurrency ? ' CAD' : ''}`;
    } else if (amount >= 1000) {
      return `$${(amount / 1000).toFixed(1)}K${showCurrency ? ' CAD' : ''}`;
    }
  }

  return formatted;
}

/**
 * Format amount directly from dollars (for backward compatibility)
 * @param amountInDollars - Amount in dollars (e.g., 25.00)
 * @param options - Formatting options
 */
export function formatCADFromDollars(
  amountInDollars: number,
  options?: {
    showCurrency?: boolean;
    showSymbol?: boolean;
    compact?: boolean;
  }
): string {
  return formatCAD(Math.round(amountInDollars * 100), options);
}

/**
 * Parse Canadian dollar string to cents
 * @param cadString - String like "$25.00" or "25.00"
 */
export function parseCADToCents(cadString: string): number {
  // Remove currency symbols and CAD
  const cleanString = cadString
    .replace(/[$CAD\s]/gi, '')
    .replace(/,/g, '');
  
  const amount = parseFloat(cleanString);
  
  if (isNaN(amount)) {
    throw new Error('Invalid currency string');
  }
  
  return Math.round(amount * 100);
}

/**
 * Get Canadian tax information for a province
 */
export function getCanadianTaxInfo(provinceCode: string): {
  hst?: number;
  gst?: number;
  pst?: number;
  totalTaxRate: number;
  taxName: string;
} {
  const taxes = {
    // HST provinces
    'ON': { hst: 13, totalTaxRate: 13, taxName: 'HST' },
    'NB': { hst: 15, totalTaxRate: 15, taxName: 'HST' },
    'NL': { hst: 15, totalTaxRate: 15, taxName: 'HST' },
    'NS': { hst: 15, totalTaxRate: 15, taxName: 'HST' },
    'PE': { hst: 15, totalTaxRate: 15, taxName: 'HST' },
    
    // GST + PST provinces
    'BC': { gst: 5, pst: 7, totalTaxRate: 12, taxName: 'GST + PST' },
    'SK': { gst: 5, pst: 6, totalTaxRate: 11, taxName: 'GST + PST' },
    'MB': { gst: 5, pst: 7, totalTaxRate: 12, taxName: 'GST + PST' },
    'QC': { gst: 5, pst: 9.975, totalTaxRate: 14.975, taxName: 'GST + QST' },
    
    // GST only
    'AB': { gst: 5, totalTaxRate: 5, taxName: 'GST' },
    'NT': { gst: 5, totalTaxRate: 5, taxName: 'GST' },
    'NU': { gst: 5, totalTaxRate: 5, taxName: 'GST' },
    'YT': { gst: 5, totalTaxRate: 5, taxName: 'GST' },
  };

  return taxes[provinceCode.toUpperCase()] || 
         { gst: 5, totalTaxRate: 5, taxName: 'GST' }; // Default to GST only
}

/**
 * Calculate taxes for Canadian provinces
 */
export function calculateCanadianTax(
  amountInCents: number,
  provinceCode: string
): {
  subtotal: number;
  taxAmount: number;
  total: number;
  taxBreakdown: string;
} {
  const taxInfo = getCanadianTaxInfo(provinceCode);
  const taxAmount = Math.round(amountInCents * (taxInfo.totalTaxRate / 100));
  
  return {
    subtotal: amountInCents,
    taxAmount,
    total: amountInCents + taxAmount,
    taxBreakdown: `${taxInfo.taxName} (${taxInfo.totalTaxRate}%)`
  };
}

/**
 * Canadian-specific currency validation
 */
export function isValidCADAmount(amount: string): boolean {
  // Allow formats: $25.00, 25.00, $25, 25
  const cadRegex = /^\$?\d{1,3}(,\d{3})*(\.\d{2})?$/;
  const cleanAmount = amount.replace(/[$\s]/g, '');
  
  return cadRegex.test(`$${cleanAmount}`) && parseFloat(cleanAmount) >= 0;
}

/**
 * Default Canadian currency formatter for the app
 */
export const cadFormatter = {
  format: formatCAD,
  formatFromDollars: formatCADFromDollars,
  parse: parseCADToCents,
  validate: isValidCADAmount,
  calculateTax: calculateCanadianTax,
  getTaxInfo: getCanadianTaxInfo
};

// Export as default for easy imports
export default cadFormatter;