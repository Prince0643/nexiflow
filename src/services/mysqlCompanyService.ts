import pool from '../config/db';
import { Company, PDFSettings } from '../types';

export const mysqlCompanyService = {
  async getCompanies(): Promise<Company[]> {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM companies`;
      const [rows]: any = await connection.execute(query);
      
      return rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        isActive: row.is_active === 1,
        pricingLevel: row.pricing_level,
        maxMembers: row.max_members,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pdfSettings: row.pdf_settings ? JSON.parse(row.pdf_settings) : undefined
      }));
    } finally {
      connection.release();
    }
  },

  async getCompanyById(companyId: string): Promise<Company | null> {
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM companies WHERE id = ?`;
      const [rows]: any = await connection.execute(query, [companyId]);
      
      if (rows.length === 0) {
        return null;
      }
      
      const row = rows[0];
      return {
        id: row.id,
        name: row.name,
        isActive: row.is_active === 1,
        pricingLevel: row.pricing_level,
        maxMembers: row.max_members,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        pdfSettings: row.pdf_settings ? JSON.parse(row.pdf_settings) : undefined
      };
    } finally {
      connection.release();
    }
  },

  async createCompany(name: string, pricingLevel: 'solo' | 'office' | 'enterprise' = 'solo'): Promise<Company> {
    const connection = await pool.getConnection();
    try {
      // Set max members based on pricing level
      let maxMembers = 1;
      if (pricingLevel === 'office') {
        maxMembers = 10;
      } else if (pricingLevel === 'enterprise') {
        maxMembers = 100;
      }
      
      // Default PDF settings
      const defaultPdfSettings: PDFSettings = {
        companyName: name,
        logoUrl: '',
        primaryColor: '#3B82F6',
        secondaryColor: '#1E40AF',
        showPoweredBy: true,
        customFooterText: ''
      };
      
      const now = new Date().toISOString();
      const query = `
        INSERT INTO companies (
          name, is_active, pricing_level, max_members, created_at, updated_at, pdf_settings
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      const result: any = await connection.execute(query, [
        name,
        1, // is_active
        pricingLevel,
        maxMembers,
        now,
        now,
        JSON.stringify(defaultPdfSettings)
      ]);
      
      const newCompany: Company = {
        id: result[0].insertId.toString(),
        name,
        isActive: true,
        pricingLevel,
        maxMembers,
        createdAt: now,
        updatedAt: now,
        pdfSettings: defaultPdfSettings
      };
      
      return newCompany;
    } finally {
      connection.release();
    }
  }
};