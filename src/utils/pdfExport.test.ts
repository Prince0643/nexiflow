import { generateClientReportPDF, generateIndividualClientPDF } from './pdfExport';

// Mock the dependencies
jest.mock('jspdf');
jest.mock('html2canvas');
jest.mock('date-fns', () => ({
  format: jest.fn().mockImplementation((date, format) => 'Jan 01, 2023')
}));

describe('pdfExport', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('generateClientReportPDF', () => {
    it('should generate a PDF with company branding', async () => {
      // Create a mock chart element
      const chartElement = document.createElement('div');
      
      // Mock the jsPDF methods
      const mockPdf = {
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(210),
            getHeight: jest.fn().mockReturnValue(297)
          }
        },
        setFillColor: jest.fn(),
        rect: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        setDrawColor: jest.fn(),
        line: jest.fn(),
        addPage: jest.fn(),
        addImage: jest.fn(),
        save: jest.fn()
      };
      
      const mockJsPDF = jest.requireMock('jspdf');
      mockJsPDF.default.mockImplementation(() => mockPdf);
      
      // Mock html2canvas
      const mockHtml2Canvas = jest.requireMock('html2canvas');
      mockHtml2Canvas.default.mockResolvedValue({
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,test'),
        width: 100,
        height: 100
      });
      
      // Test data
      const data = {
        chartData: [
          { name: 'Client 1', hours: 10, amount: 100, formattedTime: '10:00:00' },
          { name: 'Client 2', hours: 20, amount: 200, formattedTime: '20:00:00' }
        ],
        billingStats: {
          totalBillableAmount: 300,
          totalHours: 30,
          activeClientsWithTime: 2,
          formattedTotalTime: '30:00:00'
        },
        timeFilter: 'this-week',
        pdfSettings: {
          companyName: 'Test Company',
          logoUrl: '',
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
          showPoweredBy: true,
          customFooterText: 'Custom footer text'
        }
      };
      
      // Call the function
      await generateClientReportPDF(chartElement, data);
      
      // Verify that the PDF was created with the correct company branding
      expect(mockPdf.setFillColor).toHaveBeenCalledWith(255, 0, 0); // #FF0000 converted to RGB
      expect(mockPdf.text).toHaveBeenCalledWith('Test Company', expect.any(Number), expect.any(Number), expect.any(Object));
      expect(mockPdf.save).toHaveBeenCalledWith(expect.stringContaining('client-report-this-week-'));
    });
  });

  describe('generateIndividualClientPDF', () => {
    it('should generate a PDF with company branding for individual client', async () => {
      // Create a mock chart element
      const chartElement = document.createElement('div');
      
      // Mock the jsPDF methods
      const mockPdf = {
        internal: {
          pageSize: {
            getWidth: jest.fn().mockReturnValue(210),
            getHeight: jest.fn().mockReturnValue(297)
          }
        },
        setFillColor: jest.fn(),
        rect: jest.fn(),
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFont: jest.fn(),
        text: jest.fn(),
        setDrawColor: jest.fn(),
        line: jest.fn(),
        addPage: jest.fn(),
        addImage: jest.fn(),
        save: jest.fn()
      };
      
      const mockJsPDF = jest.requireMock('jspdf');
      mockJsPDF.default.mockImplementation(() => mockPdf);
      
      // Mock html2canvas
      const mockHtml2Canvas = jest.requireMock('html2canvas');
      mockHtml2Canvas.default.mockResolvedValue({
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,test'),
        width: 100,
        height: 100
      });
      
      // Test data
      const clientName = 'Test Client';
      const clientData = { name: 'Test Client', hours: 10, amount: 100, formattedTime: '10:00:00' };
      const timeFilter = 'this-week';
      const pdfSettings = {
        companyName: 'Test Company',
        logoUrl: '',
        primaryColor: '#FF0000',
        secondaryColor: '#00FF00',
        showPoweredBy: true,
        customFooterText: 'Custom footer text'
      };
      
      // Call the function with correct parameters
      await generateIndividualClientPDF(clientName, clientData, timeFilter, undefined, undefined, pdfSettings, undefined, undefined, undefined);
      
      // Verify that the PDF was created with the correct company branding
      expect(mockPdf.setFillColor).toHaveBeenCalledWith(255, 0, 0); // #FF0000 converted to RGB
      expect(mockPdf.text).toHaveBeenCalledWith('Test Company', expect.any(Number), expect.any(Number));
      expect(mockPdf.save).toHaveBeenCalledWith(expect.stringContaining('test-client-report-this-week-'));
    });
  });
});