const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testPasswordLogin() {
  try {
    console.log('Testing password login functionality...\n');
    
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

    const connection = await pool.getConnection();
    try {
      // Test with a known user
      const email = 'admin@nexistrydigitalsolutions.com';
      const password = 'nexipass'; // Default password
      
      console.log(`📧 Testing login for: ${email}`);
      console.log(`🔑 With password: ${password}\n`);
      
      // Look up user by email
      const userQuery = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
      const [userRows] = await connection.execute(userQuery, [email]);
      
      if (userRows.length === 0) {
        console.log('❌ User not found');
        return;
      }
      
      const user = userRows[0];
      console.log(`👤 User found: ${user.name} (${user.role})`);
      
      // Verify the password
      console.log('\n--- Password Verification ---');
      const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      
      if (isPasswordValid) {
        console.log('✅ Password verification successful!');
        console.log(`🆔 User ID: ${user.id}`);
        console.log(`🏢 Company ID: ${user.company_id || 'None'}`);
      } else {
        console.log('❌ Password verification failed!');
      }
      
      // Test with wrong password
      console.log('\n--- Testing with wrong password ---');
      const wrongPassword = 'wrongpassword';
      const isWrongPasswordValid = await bcrypt.compare(wrongPassword, user.password_hash);
      
      if (isWrongPasswordValid) {
        console.log('❌ Wrong password was accepted (this should not happen!)');
      } else {
        console.log('✅ Wrong password correctly rejected');
      }
      
      console.log('\n🎉 Password login test completed successfully!');
      
    } finally {
      connection.release();
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error during password login test:', error.message);
  }
}

testPasswordLogin();