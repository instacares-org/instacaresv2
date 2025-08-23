"use client";

import React from 'react';

interface InvoiceData {
  invoice: {
    id: string;
    type: 'parent' | 'caregiver' | 'platform';
    amount: number;
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
    amount: number;
    platformFee: number;
    caregiverPayout: number;
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

export const generateStyledInvoice = (invoiceData: InvoiceData): void => {
  const { invoice, booking, platformInfo } = invoiceData;
  
  const invoiceHTML = `
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
        }
        
        .header {
          background: linear-gradient(135deg, #f43f5e, #e11d48);
          color: white;
          padding: 20px;
          margin-bottom: 30px;
        }
        
        .header h1 {
          font-size: 32px;
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .header p {
          font-size: 14px;
          opacity: 0.9;
        }
        
        .invoice-title {
          float: right;
          text-align: right;
          margin-top: -10px;
        }
        
        .invoice-title h2 {
          font-size: 24px;
          margin-bottom: 5px;
        }
        
        .clearfix::after {
          content: "";
          display: table;
          clear: both;
        }
        
        .company-info {
          width: 48%;
          float: left;
        }
        
        .client-info {
          width: 48%;
          float: right;
        }
        
        .info-section {
          margin-bottom: 30px;
        }
        
        .info-section h3 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          color: #f43f5e;
        }
        
        .info-section p {
          margin-bottom: 5px;
        }
        
        .invoice-details {
          background: #f8fafc;
          padding: 15px;
          margin: 20px 0;
          border: 1px solid #e2e8f0;
        }
        
        .invoice-details div {
          display: inline-block;
          width: 48%;
          margin-bottom: 8px;
        }
        
        .section-title {
          font-size: 18px;
          font-weight: bold;
          color: #f43f5e;
          margin: 30px 0 15px 0;
          border-bottom: 2px solid #f43f5e;
          padding-bottom: 5px;
        }
        
        .service-details {
          margin-bottom: 30px;
        }
        
        .service-details table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .service-details td {
          padding: 8px 0;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .service-details td:first-child {
          font-weight: bold;
          width: 30%;
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
        }
        
        .payment-table tr:nth-child(even) {
          background: #f8fafc;
        }
        
        .payment-table .amount {
          text-align: right;
          font-weight: bold;
        }
        
        .total-box {
          background: #1e293b;
          color: white;
          padding: 20px;
          text-align: center;
          margin: 20px 0;
          width: 300px;
          float: right;
        }
        
        .total-box h3 {
          font-size: 16px;
          margin-bottom: 10px;
        }
        
        .total-box .total-amount {
          font-size: 24px;
          font-weight: bold;
        }
        
        .footer {
          background: #f8fafc;
          padding: 20px;
          margin-top: 40px;
          text-align: center;
          border-top: 1px solid #e2e8f0;
        }
        
        .footer p {
          margin-bottom: 8px;
          color: #475569;
        }
        
        .footer .small {
          font-size: 10px;
          color: #64748b;
        }
        
        @media print {
          .no-print {
            display: none;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            color-adjust: exact;
          }
        }
        
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          background: #f43f5e;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          z-index: 1000;
        }
        
        .print-button:hover {
          background: #e11d48;
        }
      </style>
    </head>
    <body>
      <button class="print-button no-print" onclick="window.print(); window.close();">
        Print / Save as PDF
      </button>
      
      <div class="header clearfix">
        <div>
          <h1>${platformInfo.name}</h1>
          <p>Premium Childcare Services</p>
        </div>
        <div class="invoice-title">
          <h2>${invoice.type === 'parent' ? 'PAYMENT RECEIPT' : 'PAYOUT STATEMENT'}</h2>
          <p>${invoice.id}</p>
        </div>
      </div>
      
      <div class="clearfix">
        <div class="company-info">
          <div class="info-section">
            <h3>FROM:</h3>
            <p><strong>${platformInfo.name}</strong></p>
            <p>${platformInfo.address}</p>
            <p>Tax ID: ${platformInfo.tax}</p>
            ${platformInfo.phone ? `<p>Phone: ${platformInfo.phone}</p>` : ''}
            ${platformInfo.email ? `<p>Email: ${platformInfo.email}</p>` : ''}
            ${platformInfo.website ? `<p>Website: ${platformInfo.website}</p>` : ''}
          </div>
        </div>
        
        <div class="client-info">
          <div class="info-section">
            <h3>TO:</h3>
            <p><strong>${invoice.recipient}</strong></p>
            <p>${invoice.type === 'parent' ? 'Payment for Childcare Services' : 'Childcare Service Provider'}</p>
            ${invoice.type === 'caregiver' ? '<p>Service Payout Statement</p>' : ''}
          </div>
        </div>
      </div>
      
      <div class="invoice-details clearfix">
        <div><strong>Invoice Date:</strong> ${new Date(invoice.generatedDate).toLocaleDateString('en-US')}</div>
        <div><strong>Booking ID:</strong> ${booking.id}</div>
        <div><strong>Due Date:</strong> ${new Date(invoice.dueDate).toLocaleDateString('en-US')}</div>
        <div><strong>Service Date:</strong> ${new Date(booking.date).toLocaleDateString('en-US')}</div>
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
          ${invoice.type === 'parent' ? `
            <tr>
              <td>Childcare Service</td>
              <td>${booking.duration} hours</td>
              <td class="amount">$${(booking.amount / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Platform Fee (15%)</td>
              <td>Included</td>
              <td class="amount">$${(booking.platformFee / 100).toFixed(2)}</td>
            </tr>
          ` : `
            <tr>
              <td>Service Revenue</td>
              <td>${booking.duration} hours</td>
              <td class="amount">$${(booking.amount / 100).toFixed(2)}</td>
            </tr>
            <tr>
              <td>Platform Fee (15%)</td>
              <td>Commission</td>
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
      
      <div class="clearfix">
        <div class="total-box">
          <h3>${invoice.type === 'parent' ? 'TOTAL PAID' : 'NET PAYOUT'}</h3>
          <div class="total-amount">$${(invoice.amount / 100).toFixed(2)}</div>
        </div>
      </div>
      
      <div class="footer">
        <p><strong>${invoice.type === 'parent' 
          ? 'Thank you for choosing Instacares for your childcare needs. Your payment helps support quality childcare in your community.'
          : 'Thank you for providing excellent childcare services through Instacares. Your dedication makes a difference in families\' lives.'
        }</strong></p>
        <p class="small">This invoice was generated electronically and is valid without signature.</p>
        <p class="small">Generated on ${new Date().toLocaleDateString('en-US')} | Instacares Platform</p>
      </div>
    </body>
    </html>
  `;
  
  // Open new window with the invoice
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.focus();
  }
};