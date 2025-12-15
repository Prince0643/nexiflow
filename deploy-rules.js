// Simple script to deploy Firebase rules
// Run this with: node deploy-rules.js

const { exec } = require('child_process');

console.log('Deploying Firebase rules...');

exec('firebase deploy --only database', (error, stdout, stderr) => {
  if (error) {
    console.error('Error deploying rules:', error);
    return;
  }
  
  if (stderr) {
    console.error('Stderr:', stderr);
  }
  
  console.log('Rules deployed successfully!');
  console.log(stdout);
});
