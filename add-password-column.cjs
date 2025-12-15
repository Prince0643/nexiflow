const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function addPasswordColumn() {
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

    console.log('Adding password_hash column to users table...\n');
    
    const connection = await pool.getConnection();
    try {
      // Add password_hash column to users table
      console.log('1. Adding password_hash column...');
      await connection.execute(`
        ALTER TABLE users 
        ADD COLUMN password_hash VARCHAR(255) NULL AFTER email
      `);
      console.log('✅ Added password_hash column\n');
      
      // Hash the default password
      console.log('2. Hashing default password "nexipass"...');
      const saltRounds = 12;
      const defaultPassword = 'nexipass';
      const hashedPassword = await bcrypt.hash(defaultPassword, saltRounds);
      console.log(`✅ Default password hashed: ${hashedPassword.substring(0, 20)}...\n`);
      
      // Update all existing users with the default hashed password
      console.log('3. Updating existing users with default password...');
      const [result] = await connection.execute(
        `UPDATE users SET password_hash = ? WHERE password_hash IS NULL`,
        [hashedPassword]
      );
      console.log(`✅ Updated ${result.affectedRows} users with default password\n`);
      
      // Make password_hash column NOT NULL
      console.log('4. Making password_hash column required...');
      await connection.execute(`
        ALTER TABLE users 
        MODIFY COLUMN password_hash VARCHAR(255) NOT NULL
      `);
      console.log('✅ Made password_hash column required\n');
      
      // Add index on password_hash for better performance
      console.log('5. Adding index on password_hash...');
      await connection.execute(`
        ALTER TABLE users 
        ADD INDEX idx_password_hash (password_hash)
      `);
      console.log('✅ Added index on password_hash\n');
      
      console.log('🎉 All operations completed successfully!');
      console.log('\n📋 Summary:');
      console.log('   • Added password_hash column to users table');
      console.log('   • Set default password "nexipass" for all existing users');
      console.log('   • Made password_hash column required');
      console.log('   • Added index for better query performance');
      
    } finally {
      connection.release();
    }
    
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('ℹ️  Column password_hash already exists. No changes made.');
    }
  }
}

addPasswordColumn();