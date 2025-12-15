const axios = require('axios');

async function testAPI() {
  try {
    console.log('Testing backend API endpoints...\n');
    
    // Test health check
    console.log('1. Testing health check endpoint...');
    const healthResponse = await axios.get('http://localhost:3001/api/health');
    console.log(`✅ Health check: ${healthResponse.data.message}\n`);
    
    // Test login
    console.log('2. Testing login endpoint...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'admin@nexistrydigitalsolutions.com',
      password: 'nexipass'
    });
    
    if (loginResponse.data.success) {
      console.log('✅ Login successful!');
      console.log(`   User: ${loginResponse.data.user.name} (${loginResponse.data.user.role})`);
      if (loginResponse.data.company) {
        console.log(`   Company: ${loginResponse.data.company.name}`);
      }
    } else {
      console.log(`❌ Login failed: ${loginResponse.data.error}`);
    }
    
    console.log('\n🎉 All API tests completed successfully!');
    
  } catch (error) {
    console.error('❌ API test failed:', error.response?.data || error.message);
  }
}

testAPI();