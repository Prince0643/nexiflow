const mysql = require('mysql2/promise');
require('dotenv').config();

async function testLoginFunctionality() {
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

    console.log('Testing login functionality...');
    
    // Test Case 1: Valid user login with email and password simulation
    console.log('\n--- Test Case 1: Valid User Login ---');
    const testEmail = 'admin@nexistrydigitalsolutions.com';
    console.log(`Attempting login for email: ${testEmail}`);
    
    const connection = await pool.getConnection();
    try {
      // Simulate looking up user by email (as would happen during login)
      const userQuery = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
      const [userRows] = await connection.execute(userQuery, [testEmail]);
      
      if (userRows.length > 0) {
        const user = userRows[0];
        console.log('✅ User found during login process:');
        console.log(`   ID: ${user.id}`);
        console.log(`   Name: ${user.name}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Company ID: ${user.company_id}`);
        
        // Get company information if user has a company
        if (user.company_id) {
          const companyQuery = `SELECT * FROM companies WHERE id = ?`;
          const [companyRows] = await connection.execute(companyQuery, [user.company_id]);
          
          if (companyRows.length > 0) {
            const company = companyRows[0];
            console.log('🏢 Company information retrieved:');
            console.log(`   ID: ${company.id}`);
            console.log(`   Name: ${company.name}`);
            console.log(`   Active: ${company.is_active === 1 ? 'Yes' : 'No'}`);
          }
        }
        
        console.log('✅ Login simulation successful!');
      } else {
        console.log('❌ User not found or inactive');
      }
      
      // Test Case 2: Invalid user login
      console.log('\n--- Test Case 2: Invalid User Login ---');
      const invalidEmail = 'nonexistent@example.com';
      console.log(`Attempting login for email: ${invalidEmail}`);
      
      const invalidUserQuery = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
      const [invalidUserRows] = await connection.execute(invalidUserQuery, [invalidEmail]);
      
      if (invalidUserRows.length > 0) {
        console.log('❌ Unexpected: Found user with invalid email');
      } else {
        console.log('✅ Correctly rejected invalid email - no user found');
      }
      
      // Test Case 3: User role verification
      console.log('\n--- Test Case 3: User Role Verification ---');
      if (userRows.length > 0) {
        const user = userRows[0];
        const validRoles = ['employee', 'hr', 'admin', 'super_admin', 'root'];
        if (validRoles.includes(user.role)) {
          console.log(`✅ Valid role detected: ${user.role}`);
        } else {
          console.log(`❌ Invalid role: ${user.role}`);
        }
      }
      
      // Test Case 4: User permissions based on role
      console.log('\n--- Test Case 4: User Permissions Check ---');
      if (userRows.length > 0) {
        const user = userRows[0];
        let permissions = [];
        
        switch (user.role) {
          case 'root':
          case 'super_admin':
            permissions = ['manage_users', 'manage_companies', 'view_all_data'];
            break;
          case 'admin':
            permissions = ['manage_team', 'view_reports'];
            break;
          case 'hr':
            permissions = ['manage_users', 'view_payroll'];
            break;
          case 'employee':
            permissions = ['track_time', 'view_own_data'];
            break;
          default:
            permissions = ['limited_access'];
        }
        
        console.log(`📋 Role-based permissions for ${user.role}:`);
        permissions.forEach(permission => console.log(`   • ${permission}`));
      }
      
    } finally {
      connection.release();
    }
    
    console.log('\n🎉 All login functionality tests completed!');
    await pool.end();
    
  } catch (error) {
    console.error('❌ Error during login functionality test:', error.message);
  }
}

testLoginFunctionality();