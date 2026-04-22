#!/usr/bin/env node

/**
 * Timer Reminder Scheduler - Cron Job Script
 *
 * Sends reminder emails for running timers every 12 hours while they remain running.
 *
 * Recommended cron setup (run hourly):
 * 0 * * * * cd /path/to/api && node timerReminderScheduler.js >> /var/log/timer-reminder-scheduler.log 2>&1
 */

const path = require('path');
const fs = require('fs');

// Load .env - try current directory first (production), then parent (local dev)
let envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  envPath = path.join(__dirname, '..', '.env');
}
require('dotenv').config({ path: envPath });

const axios = require('axios');

const API_BASE_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
const ROOT_API_KEY = process.env.ROOT_API_KEY;

if (!ROOT_API_KEY) {
  console.error('ERROR: ROOT_API_KEY not found in environment variables');
  console.error('Please add ROOT_API_KEY to your .env file');
  process.exit(1);
}

async function runTimerReminderScheduler() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] Starting timer reminder scheduler...`);
  console.log(`[${timestamp}] API URL: ${API_BASE_URL}/time-entries/send-running-timer-reminders`);

  try {
    const response = await axios.post(
      `${API_BASE_URL}/time-entries/send-running-timer-reminders`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${ROOT_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    if (response.data?.success) {
      const { eligibleCount, processedCount, skippedCount, failedCount } = response.data.data || {};
      console.log(`[${timestamp}] Timer reminder scheduler completed successfully:`);
      console.log(`  - Eligible running timers: ${eligibleCount ?? 0}`);
      console.log(`  - Processed (emails sent): ${processedCount ?? 0}`);
      console.log(`  - Skipped: ${skippedCount ?? 0}`);
      console.log(`  - Failed: ${failedCount ?? 0}`);
      return;
    }

    console.error(`[${timestamp}] Timer reminder scheduler returned unsuccessful response:`, response.data);
    process.exit(1);
  } catch (error) {
    console.error(`[${timestamp}] Timer reminder scheduler failed:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

runTimerReminderScheduler();

