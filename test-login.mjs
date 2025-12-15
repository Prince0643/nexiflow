import { mysqlUserService } from './src/services/mysqlUserService.ts';
import { mysqlCompanyService } from './src/services/mysqlCompanyService.ts';

async function testLogin() {
  try {
    console.log('Testing user login functionality...');
    
    // Test getting a user by ID
    const userId = 'f0LDwi3dMXcTjDYCC2arQScMbfF2'; // This should be a user ID from your database
    console.log(`Getting user with ID: ${userId}`);
    
    const user = await mysqlUserService.getUserById(userId);
    if (user) {
      console.log('User found:');
      console.log(`  ID: ${user.id}`);
      console.log(`  Name: ${user.name}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Company ID: ${user.companyId}`);
      
      // If user has a company ID, get the company details
      if (user.companyId) {
        console.log(`Getting company with ID: ${user.companyId}`);
        const company = await mysqlCompanyService.getCompanyById(user.companyId);
        if (company) {
          console.log('Company found:');
          console.log(`  ID: ${company.id}`);
          console.log(`  Name: ${company.name}`);
          console.log(`  Active: ${company.isActive}`);
        } else {
          console.log('Company not found');
        }
      }
    } else {
      console.log('User not found');
    }
    
    console.log('Login test completed successfully!');
  } catch (error) {
    console.error('Error during login test:', error.message);
  }
}

testLogin();