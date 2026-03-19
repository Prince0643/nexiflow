const nodemailer = require('nodemailer');
require('dotenv').config();

async function testSMTP() {
  console.log('Testing SMTP connection...');
  console.log('Host:', process.env.SMTP_HOST);
  console.log('User:', process.env.SMTP_USER);
  
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Verify connection
    await transporter.verify();
    console.log('✓ SMTP connection successful');
    
    // Send test email
    const info = await transporter.sendMail({
      from: `"Clockistry Billing" <${process.env.SMTP_USER}>`,
      to: 'tolentinochristian89@gmail.com',
      subject: 'SMTP Test - Clockistry',
      text: 'This is a test email to verify SMTP is working',
      html: '<h2>SMTP Test</h2><p>If you received this, email is working!</p>'
    });
    
    console.log('✓ Test email sent:', info.messageId);
    console.log('Check your inbox and spam folder!');
    
  } catch (error) {
    console.error('✗ SMTP Error:', error.message);
    console.error('Full error:', error);
  }
}

testSMTP();
