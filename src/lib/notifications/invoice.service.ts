/**
 * Invoice Generation Service
 * Generates PDF invoices for booking confirmations
 */

export interface InvoiceData {
  invoice: {
    id: string;
    type: 'parent' | 'caregiver' | 'platform';
    amount: number; // in cents
    recipient: string;
    status: string;
    generatedDate: string;
    dueDate: string;
  };
  booking: {
    id: string;
    parentName: string;
    caregiverName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    childrenCount: number;
    amount: number; // in cents
    platformFee: number; // in cents
    caregiverPayout: number; // in cents
  };
  platformInfo: {
    name: string;
    address: string;
    tax: string;
    phone?: string;
    email?: string;
    website?: string;
  };
}

/**
 * Default platform information
 */
const DEFAULT_PLATFORM_INFO = {
  name: 'InstaCares',
  address: 'Toronto, Ontario, Canada',
  tax: 'GST/HST: 123456789',
  phone: '+1 (416) 000-0000',
  email: 'support@instacares.net',
  website: 'https://instacares.net',
};

/**
 * Generate invoice HTML for PDF conversion
 */
export function generateInvoiceHTML(invoiceData: InvoiceData): string {
  const { invoice, booking, platformInfo } = invoiceData;

  const isParentInvoice = invoice.type === 'parent';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Invoice ${invoice.id}</title>
      <style>
        @page {
          size: A4;
          margin: 0.5in;
        }

        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }

        body {
          font-family: 'Helvetica', Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #1e293b;
          background: white;
        }

        .invoice-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 30px;
        }

        .header {
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          color: white;
          padding: 25px;
          margin-bottom: 30px;
          border-radius: 8px;
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }

        .header h1 {
          font-size: 28px;
          font-weight: bold;
          margin-bottom: 5px;
        }

        .header p {
          font-size: 14px;
          opacity: 0.9;
        }

        .invoice-title {
          text-align: right;
        }

        .invoice-title h2 {
          font-size: 22px;
          margin-bottom: 5px;
        }

        .invoice-title p {
          font-size: 12px;
          opacity: 0.9;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 30px;
        }

        .info-section {
          width: 48%;
        }

        .info-section h3 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #f43f5e;
          text-transform: uppercase;
        }

        .info-section p {
          margin-bottom: 5px;
          color: #475569;
        }

        .info-section p strong {
          color: #1e293b;
        }

        .invoice-details {
          background: #f8fafc;
          padding: 15px 20px;
          margin: 20px 0;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          display: flex;
          flex-wrap: wrap;
        }

        .invoice-details-item {
          width: 50%;
          margin-bottom: 10px;
        }

        .invoice-details-item label {
          font-weight: bold;
          color: #64748b;
          font-size: 11px;
          text-transform: uppercase;
        }

        .invoice-details-item span {
          display: block;
          color: #1e293b;
          font-size: 13px;
          margin-top: 2px;
        }

        .section-title {
          font-size: 16px;
          font-weight: bold;
          color: #f43f5e;
          margin: 30px 0 15px 0;
          border-bottom: 2px solid #f43f5e;
          padding-bottom: 5px;
        }

        .service-details table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }

        .service-details td {
          padding: 10px 0;
          border-bottom: 1px solid #e2e8f0;
        }

        .service-details td:first-child {
          font-weight: bold;
          color: #64748b;
          width: 40%;
        }

        .service-details td:last-child {
          color: #1e293b;
        }

        .payment-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }

        .payment-table th,
        .payment-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e2e8f0;
        }

        .payment-table th {
          background: #f43f5e;
          color: white;
          font-weight: bold;
          font-size: 12px;
        }

        .payment-table tr:nth-child(even) {
          background: #f8fafc;
        }

        .payment-table .amount {
          text-align: right;
          font-weight: bold;
        }

        .total-section {
          display: flex;
          justify-content: flex-end;
          margin: 30px 0;
        }

        .total-box {
          background: #1e293b;
          color: white;
          padding: 20px 30px;
          text-align: center;
          border-radius: 8px;
          min-width: 250px;
        }

        .total-box h3 {
          font-size: 14px;
          margin-bottom: 8px;
          opacity: 0.9;
        }

        .total-box .total-amount {
          font-size: 28px;
          font-weight: bold;
        }

        .footer {
          background: #f8fafc;
          padding: 20px;
          margin-top: 40px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
          border-radius: 0 0 8px 8px;
        }

        .footer p {
          margin-bottom: 8px;
          color: #475569;
          font-size: 12px;
        }

        .footer .small {
          font-size: 10px;
          color: #64748b;
        }

        .badge {
          display: inline-block;
          background: #dcfce7;
          color: #166534;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .badge.pending {
          background: #fef3c7;
          color: #92400e;
        }
      </style>
    </head>
    <body>
      <div class="invoice-container">
        <div class="header">
          <div class="header-content">
            <div>
              <h1>${platformInfo.name}</h1>
              <p>Premium Childcare Services</p>
            </div>
            <div class="invoice-title">
              <h2>${isParentInvoice ? 'PAYMENT RECEIPT' : 'PAYOUT STATEMENT'}</h2>
              <p>${invoice.id}</p>
            </div>
          </div>
        </div>

        <div class="info-row">
          <div class="info-section">
            <h3>From:</h3>
            <p><strong>${platformInfo.name}</strong></p>
            <p>${platformInfo.address}</p>
            <p>Tax ID: ${platformInfo.tax}</p>
            ${platformInfo.phone ? `<p>Phone: ${platformInfo.phone}</p>` : ''}
            ${platformInfo.email ? `<p>Email: ${platformInfo.email}</p>` : ''}
            ${platformInfo.website ? `<p>Website: ${platformInfo.website}</p>` : ''}
          </div>

          <div class="info-section">
            <h3>To:</h3>
            <p><strong>${invoice.recipient}</strong></p>
            <p>${isParentInvoice ? 'Payment for Childcare Services' : 'Childcare Service Provider'}</p>
            ${!isParentInvoice ? '<p>Service Payout Statement</p>' : ''}
          </div>
        </div>

        <div class="invoice-details">
          <div class="invoice-details-item">
            <label>Invoice Date</label>
            <span>${new Date(invoice.generatedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div class="invoice-details-item">
            <label>Booking ID</label>
            <span>${booking.id}</span>
          </div>
          <div class="invoice-details-item">
            <label>Due Date</label>
            <span>${new Date(invoice.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
          <div class="invoice-details-item">
            <label>Service Date</label>
            <span>${booking.date}</span>
          </div>
        </div>

        <h2 class="section-title">Service Details</h2>
        <div class="service-details">
          <table>
            <tr>
              <td>Service Provider:</td>
              <td>${booking.caregiverName}</td>
            </tr>
            <tr>
              <td>Client:</td>
              <td>${booking.parentName}</td>
            </tr>
            <tr>
              <td>Service Time:</td>
              <td>${booking.startTime} - ${booking.endTime} (${booking.duration} hours)</td>
            </tr>
            <tr>
              <td>Number of Children:</td>
              <td>${booking.childrenCount}</td>
            </tr>
            <tr>
              <td>Service Location:</td>
              <td>Client's Home</td>
            </tr>
          </table>
        </div>

        <h2 class="section-title">Payment Breakdown</h2>
        <table class="payment-table">
          <thead>
            <tr>
              <th>Description</th>
              <th>Details</th>
              <th class="amount">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${isParentInvoice ? `
              <tr>
                <td>Childcare Service</td>
                <td>${booking.duration} hours</td>
                <td class="amount">$${(booking.amount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Platform Fee</td>
                <td>Included in total</td>
                <td class="amount">$${(booking.platformFee / 100).toFixed(2)}</td>
              </tr>
            ` : `
              <tr>
                <td>Service Revenue</td>
                <td>${booking.duration} hours</td>
                <td class="amount">$${(booking.amount / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Platform Commission</td>
                <td>Service fee</td>
                <td class="amount">-$${(booking.platformFee / 100).toFixed(2)}</td>
              </tr>
              <tr>
                <td><strong>Your Payout</strong></td>
                <td><strong>Net Amount</strong></td>
                <td class="amount"><strong>$${(booking.caregiverPayout / 100).toFixed(2)}</strong></td>
              </tr>
            `}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <h3>${isParentInvoice ? 'TOTAL PAID' : 'NET PAYOUT'}</h3>
            <div class="total-amount">$${(invoice.amount / 100).toFixed(2)}</div>
          </div>
        </div>

        <div class="footer">
          <p><strong>${isParentInvoice
            ? 'Thank you for choosing InstaCares for your childcare needs. Your payment helps support quality childcare in your community.'
            : 'Thank you for providing excellent childcare services through InstaCares. Your dedication makes a difference in families\' lives.'
          }</strong></p>
          <p class="small">This invoice was generated electronically and is valid without signature.</p>
          <p class="small">Generated on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} | InstaCares Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Create invoice data from booking information
 */
export function createInvoiceData(
  type: 'parent' | 'caregiver',
  booking: {
    id: string;
    parentName: string;
    caregiverName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    childrenCount: number;
    totalAmount: number; // in cents
    platformFee: number; // in cents
  }
): InvoiceData {
  const now = new Date();
  const invoiceId = `INV-${type.toUpperCase().charAt(0)}-${booking.id.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  const caregiverPayout = booking.totalAmount - booking.platformFee;
  const invoiceAmount = type === 'parent' ? booking.totalAmount : caregiverPayout;
  const recipient = type === 'parent' ? booking.parentName : booking.caregiverName;

  return {
    invoice: {
      id: invoiceId,
      type,
      amount: invoiceAmount,
      recipient,
      status: 'paid',
      generatedDate: now.toISOString(),
      dueDate: now.toISOString(), // Already paid
    },
    booking: {
      id: booking.id,
      parentName: booking.parentName,
      caregiverName: booking.caregiverName,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      duration: booking.duration,
      childrenCount: booking.childrenCount,
      amount: booking.totalAmount,
      platformFee: booking.platformFee,
      caregiverPayout,
    },
    platformInfo: DEFAULT_PLATFORM_INFO,
  };
}

/**
 * Invoice Service class for generating and managing invoices
 */
export class InvoiceService {
  /**
   * Generate invoice HTML for a parent
   */
  generateParentInvoiceHTML(booking: {
    id: string;
    parentName: string;
    caregiverName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    childrenCount: number;
    totalAmount: number;
    platformFee: number;
  }): string {
    const invoiceData = createInvoiceData('parent', booking);
    return generateInvoiceHTML(invoiceData);
  }

  /**
   * Generate invoice HTML for a caregiver
   */
  generateCaregiverInvoiceHTML(booking: {
    id: string;
    parentName: string;
    caregiverName: string;
    date: string;
    startTime: string;
    endTime: string;
    duration: number;
    childrenCount: number;
    totalAmount: number;
    platformFee: number;
  }): string {
    const invoiceData = createInvoiceData('caregiver', booking);
    return generateInvoiceHTML(invoiceData);
  }
}

// Export singleton instance
export const invoiceService = new InvoiceService();
