const mysql = require('mysql2/promise');
require('dotenv').config();

// Simulate the login function that would be used in the actual application
async function loginUser(email, password) {
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

  try {
    const connection = await pool.getConnection();
    try {
      // Look up user by email
      const userQuery = `SELECT * FROM users WHERE email = ? AND is_active = 1`;
      const [userRows] = await connection.execute(userQuery, [email]);
      
      if (userRows.length === 0) {
        return { success: false, error: 'User not found or inactive' };
      }
      
      const user = userRows[0];
      
      // In a real application, you would verify the password here
      // For this test, we're assuming the password is correct
      // const isPasswordValid = await bcrypt.compare(password, user.password_hash);
      // if (!isPasswordValid) {
      //   return { success: false, error: 'Invalid password' };
      // }
      
      // Get company information if user has a company
      let company = null;
      if (user.company_id) {
        const companyQuery = `SELECT * FROM companies WHERE id = ?`;
        const [companyRows] = await connection.execute(companyQuery, [user.company_id]);
        
        if (companyRows.length > 0) {
          const companyData = companyRows[0];
          company = {
            id: companyData.id,
            name: companyData.name,
            isActive: companyData.is_active === 1
          };
        }
      }
      
      // Prepare user data for session
      const userData = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.company_id,
        teamId: user.team_id,
        teamRole: user.team_role,
        timezone: user.timezone,
        hourlyRate: user.hourly_rate,
        isActive: user.is_active === 1,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      };
      
      return { 
        success: true, 
        user: userData,
        company: company
      };
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Database error:', error.message);
    return { success: false, error: 'Database connection error' };
  } finally {
    await pool.end();
  }
}

async function testLoginEndpoint() {
  console.log('🚀 Testing login endpoint functionality...\n');
  
  // Test Case 1: Valid login
  console.log('--- Test Case 1: Valid Login ---');
  const result1 = await loginUser('admin@nexistrydigitalsolutions.com', 'anyPassword');
  
  if (result1.success) {
    console.log('✅ Login successful!');
    console.log(`👤 User: ${result1.user.name} (${result1.user.role})`);
    if (result1.company) {
      console.log(`🏢 Company: ${result1.company.name} (${result1.company.isActive ? 'Active' : 'Inactive'})`);
    }
  } else {
    console.log(`❌ Login failed: ${result1.error}`);
  }
  
  // Test Case 2: Invalid email
  console.log('\n--- Test Case 2: Invalid Email ---');
  const result2 = await loginUser('nonexistent@example.com', 'anyPassword');
  
  if (result2.success) {
    console.log('❌ Unexpected success with invalid email');
  } else {
    console.log(`✅ Correctly rejected invalid email: ${result2.error}`);
  }
  
  // Test Case 3: Inactive user (if we had any)
  console.log('\n--- Test Case 3: User Status Check ---');
  console.log('🔍 Checking for inactive users...');
  
  const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'clockistry',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
  
  try {
    const connection = await pool.getConnection();
    try {
      const inactiveQuery = `SELECT COUNT(*) as count FROM users WHERE is_active = 0`;
      const [inactiveRows] = await connection.execute(inactiveQuery);
      const inactiveCount = inactiveRows[0].count;
      
      console.log(`📊 Inactive users in database: ${inactiveCount}`);
      
      if (inactiveCount > 0) {
        console.log('⚠️  There are inactive users that would be rejected during login');
      } else {
        console.log('✅ All users are active (none would be rejected for inactivity)');
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('❌ Error checking user status:', error.message);
  } finally {
    await pool.end();
  }
  
  // Test Case 4: User data completeness
  console.log('\n--- Test Case 4: User Data Completeness ---');
  const result3 = await loginUser('admin@nexistrydigitalsolutions.com', 'anyPassword');
  
  if (result3.success) {
    const user = result3.user;
    console.log('📋 Checking user data fields:');
    
    const requiredFields = ['id', 'name', 'email', 'role'];
    const optionalFields = ['companyId', 'teamId', 'teamRole', 'timezone', 'hourlyRate'];
    
    requiredFields.forEach(field => {
      if (user[field]) {
        console.log(`✅ ${field}: ${user[field]}`);
      } else {
        console.log(`❌ ${field}: MISSING`);
      }
    });
    
    optionalFields.forEach(field => {
      if (user[field]) {
        console.log(`✅ ${field}: ${user[field]}`);
      } else {
        console.log(`➖ ${field}: Not provided`);
      }
    });
  }
  
  console.log('\n🏁 Login endpoint testing completed!');
}

testLoginEndpoint();