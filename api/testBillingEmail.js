#!/usr/bin/env node

/**
 * Test Billing Email Script
 * 
 * Usage:
 *   node testBillingEmail.js <email> <password>
 * 
 * Example:
 *   node testBillingEmail.js admin@company.com password123
 */

const axios = require('axios');

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'https://nexi-flow.com/api';

async function testBillingEmail() {
  const [,, email, password] = process.argv;
  
  if (!email || !password) {
    console.log('Usage: node testBillingEmail.js <email> <password>');
    console.log('Example: node testBillingEmail.js admin@company.com password123');
    process.exit(1);
  }

  console.log(`Testing billing email for: ${email}`);
  console.log(`API URL: ${API_BASE_URL}`);

  try {
    // Step 1: Login
    console.log('\n1. Logging in...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });

    if (!loginResponse.data.success) {
      console.error('Login failed:', loginResponse.data.error);
      process.exit(1);
    }

    const token = loginResponse.data.token;
    const user = loginResponse.data.user;
    console.log(`✓ Logged in as: ${user.name} (${user.role})`);
    console.log(`✓ Token: ${token.substring(0, 20)}...`);

    // Step 2: Check billing status
    console.log('\n2. Checking billing status...');
    const statusResponse = await axios.get(`${API_BASE_URL}/billing/status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (statusResponse.data.success) {
      const billing = statusResponse.data.data;
      console.log(`✓ Company: ${billing.companyName}`);
      console.log(`✓ Plan: ${billing.pricingLevel}`);
      console.log(`✓ Next billing: ${billing.nextBillingDate || 'N/A'}`);
      console.log(`✓ Days until due: ${billing.daysUntilDue || 'N/A'}`);
      console.log(`✓ Status: ${billing.statusMessage}`);
    }

    // Step 3: Trigger payment reminder (only if super_admin or root)
    if (user.role === 'super_admin' || user.role === 'root') {
      console.log('\n3. Sending payment reminder email...');
      const remindResponse = await axios.post(
        `${API_BASE_URL}/billing/remind`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (remindResponse.data.success) {
        console.log('✓ Email sent successfully!');
        console.log(`  To: ${remindResponse.data.data.sentTo}`);
        console.log(`  Company: ${remindResponse.data.data.companyName}`);
        console.log(`  Next billing: ${remindResponse.data.data.nextBillingDate}`);
      } else {
        console.error('✗ Failed to send reminder:', remindResponse.data.error);
      }
    } else {
      console.log('\n⚠ Skipping reminder test (requires super_admin or root role)');
    }

    console.log('\n✓ Test completed!');
    console.log('\nYour JWT token for manual testing:');
    console.log(token);

  } catch (error) {
    console.error('\n✗ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

testBillingEmail();
