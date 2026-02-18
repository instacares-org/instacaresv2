/**
 * PDF Generation Service
 * Converts HTML to PDF using Puppeteer
 */

import puppeteer from 'puppeteer';

/**
 * Generate PDF buffer from HTML string
 */
export async function generatePdfFromHtml(html: string): Promise<Buffer> {
  let browser = null;

  try {
    // Launch puppeteer with minimal settings for server environment
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--single-process',
      ],
    });

    const page = await browser.newPage();

    // Set content with proper wait
    await page.setContent(html, {
      waitUntil: 'networkidle0',
    });

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '0.5in',
        right: '0.5in',
        bottom: '0.5in',
        left: '0.5in',
      },
    });

    return Buffer.from(pdfBuffer);
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

/**
 * PDF Service class for invoice generation
 */
export class PdfService {
  /**
   * Generate invoice PDF from HTML
   */
  async generateInvoicePdf(invoiceHtml: string): Promise<Buffer> {
    return generatePdfFromHtml(invoiceHtml);
  }
}

// Export singleton instance
export const pdfService = new PdfService();
