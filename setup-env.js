#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 Setting up environment variables for Clockistry...\n');

const envContent = `# Firebase Configuration
# Replace these with your actual Firebase project credentials
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://your_project_id-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
`;

const envPath = path.join(process.cwd(), '.env.local');

if (fs.existsSync(envPath)) {
  console.log('⚠️  .env.local already exists. Skipping creation.');
  console.log('   If you need to reset it, delete the file and run this script again.\n');
} else {
  try {
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env.local file');
    console.log('📝 Please update the values with your actual Firebase configuration\n');
  } catch (error) {
    console.error('❌ Error creating .env.local:', error.message);
    process.exit(1);
  }
}

console.log('🔒 Security reminders:');
console.log('   • Never commit .env.local to version control');
console.log('   • Use different keys for different environments');
console.log('   • Rotate your API keys regularly');
console.log('   • Check SECURITY.md for more guidelines\n');

console.log('🚀 Next steps:');
console.log('   1. Update .env.local with your Firebase credentials');
console.log('   2. Run "npm run dev" to start the development server');
console.log('   3. Visit http://localhost:3000 to view the application\n');

console.log('Happy coding! 🎉');
