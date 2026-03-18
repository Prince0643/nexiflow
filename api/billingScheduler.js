#!/usr/bin/env node

/**
 * Billing Scheduler - Cron Job Script
 * 
 * This script should be run daily via cron job to:
 * 1. Check for companies with overdue payments
 * 2. Enter grace period for overdue companies
 * 3. Downgrade companies whose grace period has expired
 * 4. Send payment reminder notifications
 * 
 * Example cron setup (run daily at 9 AM):
 * 0 9 * * * cd /path/to/api && node billingScheduler.js >> /var/log/billing-scheduler.log 2>&1
 */

// Load .env - try current directory first (production), then parent (local dev)
const path = require('path');
const fs = require('fs');

let envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}
require('dotenv').config({ path: envPath });
const axios = require('axios');

// Use production URL or fallback to localhost
const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ROOT_API_KEY = process.env.ROOT_API_KEY;

if (!ROOT_API_KEY) {
  console.error('ERROR: ROOT_API_KEY not found in environment variables');
  console.error('Please add ROOT_API_KEY to your .env file');
  process.exit(1);
}

async function runBillingScheduler() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting billing scheduler...`);
  console.log(`[${timestamp}] API URL: ${API_BASE_URL}/billing/check-overdue`);

  try {
    const response = await axios.post(
      `${API_BASE_URL}/billing/check-overdue`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${ROOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data.success) {
      const { companiesEnteredGracePeriod, companiesDowngraded, totalProcessed } = response.data.data;
      
      console.log(`[${timestamp}] Billing scheduler completed successfully:`);
      console.log(`  - Companies entered grace period: ${companiesEnteredGracePeriod.length}`);
      console.log(`  - Companies downgraded: ${companiesDowngraded.length}`);
      console.log(`  - Total processed: ${totalProcessed}`);
      
      if (companiesEnteredGracePeriod.length > 0) {
        console.log('  - Grace period companies:');
        companiesEnteredGracePeriod.forEach(c => {
          console.log(`    * ${c.name} (${c.pricingLevel}) - grace ends ${new Date(c.gracePeriodEndDate).toISOString()}`);
        });
      }
      
      if (companiesDowngraded.length > 0) {
        console.log('  - Downgraded companies:');
        companiesDowngraded.forEach(c => {
          console.log(`    * ${c.name} - downgraded from ${c.previousPricingLevel} to ${c.newPricingLevel}`);
        });
      }
    } else {
      console.error(`[${timestamp}] Billing scheduler returned unsuccessful response:`, response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error(`[${timestamp}] Billing scheduler failed:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the scheduler
runBillingScheduler();
