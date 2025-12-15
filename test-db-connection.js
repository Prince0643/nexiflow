const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  try {
    // Create a connection pool
    const pool = mysql.createPool({
      host: process.env.MYSQL_HOST || 'localhost',
      user: process.env.MYSQL_USER || 'root',
      password: process.env.MYSQL_PASSWORD || '',
      database: process.env.MYSQL_DATABASE || 'clockistry',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    console.log('Testing database connection...');
    
    // Test getting a user by ID
    const userId = 'f0LDwi3dMXcTjDYCC2arQScMbfF2'; // This should be a user ID from your database
    console.log(`Getting user with ID: ${userId}`);
    
    const connection = await pool.getConnection();
    try {
      const query = `SELECT * FROM users WHERE id = ?`;
      const [rows] = await connection.execute(query, [userId]);
      
      if (rows.length > 0) {
        const user = rows[0];
        console.log('User found:');
        console.log(`  ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Company ID: ${user.company_id}`);
        
        // If user has a company ID, get the company details
        if (user.company_id) {
          console.log(`Getting company with ID: ${user.company_id}`);
          const companyQuery = `SELECT * FROM companies WHERE id = ?`;
          const [companyRows] = await connection.execute(companyQuery, [user.company_id]);
          
          if (companyRows.length > 0) {
            const company = companyRows[0];
            console.log('Company found:');
            console.log(`  ID: ${company.id}`);
            console.log(`  Name: ${company.name}`);
            console.log(`  Active: ${company.is_active === 1}`);
          } else {
            console.log('Company not found');
          }
        }
      } else {
        console.log('User not found');
      }
    } finally {
      connection.release();
    }
    
    console.log('Database test completed successfully!');
    await pool.end();
  } catch (error) {
    console.error('Error during database test:', error.message);
  }
}

testConnection();