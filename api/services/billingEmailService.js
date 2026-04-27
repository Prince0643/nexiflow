const nodemailer = require('nodemailer');

// Create transporter from environment variables
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

/**
 * Send payment reminder email
 */
async function sendPaymentReminder(company, superAdmin, daysUntilDue) {
  const subject = daysUntilDue <= 0 
    ? `Payment Overdue - ${company.name}`
    : `Payment Due in ${daysUntilDue} Days - ${company.name}`;

  const urgencyText = daysUntilDue <= 0 
    ? 'Your payment is <strong>OVERDUE</strong>.'
    : `Your payment is due in <strong>${daysUntilDue} days</strong>.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Payment Reminder</h2>
      <p>Hello ${superAdmin.name},</p>
      <p>${urgencyText}</p>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0;">Company: ${company.name}</h3>
        <p><strong>Plan:</strong> ${company.pricing_level}</p>
        <p><strong>Next Billing Date:</strong> ${new Date(company.next_billing_date).toLocaleDateString()}</p>
        ${company.max_members ? `<p><strong>Team Size:</strong> ${company.max_members} members</p>` : ''}
      </div>
      
      <p>To avoid service interruption, please complete your payment:</p>
      <a href="${process.env.FRONTEND_URL}/upgrade" 
         style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Pay Now
      </a>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        If you have any questions, please contact support at ${process.env.SMTP_FROM || 'support@nexiflow.com'}
      </p>
    </div>
  `;

  const text = `
Payment Reminder

Hello ${superAdmin.name},

${urgencyText}

Company: ${company.name}
Plan: ${company.pricing_level}
Next Billing Date: ${new Date(company.next_billing_date).toLocaleDateString()}

To avoid service interruption, please complete your payment:
${process.env.FRONTEND_URL}/upgrade

If you have any questions, please contact support.
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: superAdmin.email,
      subject: subject,
      text: text,
      html: html
    });
    
    console.log(`Payment reminder sent to ${superAdmin.email} for ${company.name}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send payment reminder email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send password reset email
 */
async function sendPasswordResetEmail(user, resetLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>Hello ${user.name || 'there'},</p>
      <p>We received a request to reset the password for your NexiFlow account.</p>

      <p>
        <a href="${resetLink}"
           style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Reset Password
        </a>
      </p>

      <p>If you did not request a password reset, you can safely ignore this email.</p>
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        This link will expire in 1 hour.
      </p>
    </div>
  `;

  const text = `
Reset Your Password

Hello ${user.name || 'there'},

We received a request to reset the password for your NexiFlow account.

Reset your password using this link (expires in 1 hour):
${resetLink}

If you did not request a password reset, you can safely ignore this email.
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: user.email,
      subject: 'Reset your NexiFlow password',
      text,
      html
    });

    console.log(`Password reset email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send set-password invite email (admin-created users)
 */
async function sendSetPasswordInviteEmail(user, setPasswordLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Set up your NexiFlow account</h2>
      <p>Hello ${user.name || 'there'},</p>
      <p>An administrator created a NexiFlow account for you. Please set your password to activate your account.</p>

      <p>
        <a href="${setPasswordLink}"
           style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Set Password
        </a>
      </p>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;

  const text = `
Set up your NexiFlow account

Hello ${user.name || 'there'},

An administrator created a NexiFlow account for you. Set your password using this link (expires in 24 hours):
${setPasswordLink}
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: user.email,
      subject: 'Set your NexiFlow password',
      text,
      html
    });

    console.log(`Set-password invite email sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send set-password invite email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send company invite email (existing user invited to join another company)
 */
async function sendCompanyInviteEmail(invitee, inviteLink, companyName, role, inviterName) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">You're invited to join ${companyName}</h2>
      <p>Hello ${invitee.name || 'there'},</p>
      <p>${inviterName || 'An administrator'} invited you to join <strong>${companyName}</strong> on NexiFlow.</p>
      <p><strong>Role:</strong> ${role}</p>

      <p>
        <a href="${inviteLink}"
           style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Review Invite
        </a>
      </p>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        This link will expire in 24 hours.
      </p>
    </div>
  `;

  const text = `
You're invited to join ${companyName}

Hello ${invitee.name || 'there'},

${inviterName || 'An administrator'} invited you to join ${companyName} on NexiFlow.
Role: ${role}

Review and accept the invite (expires in 24 hours):
${inviteLink}
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: invitee.email,
      subject: `Invitation to join ${companyName} on NexiFlow`,
      text,
      html
    });

    console.log(`Company invite email sent to ${invitee.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send company invite email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send grace period notification email
 */
async function sendGracePeriodNotification(company, superAdmin, graceEndDate) {
  const daysLeft = Math.ceil((new Date(graceEndDate) - new Date()) / (1000 * 60 * 60 * 24));
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Payment Overdue - Grace Period Active</h2>
      <p>Hello ${superAdmin.name},</p>
      <p>Your payment for <strong>${company.name}</strong> is overdue.</p>
      
      <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #DC2626; margin-top: 0;">Action Required</h3>
        <p><strong>Grace Period Ends:</strong> ${new Date(graceEndDate).toLocaleDateString()} (${daysLeft} days remaining)</p>
        <p style="margin-bottom: 0;"><strong>If payment is not received by this date, your account will be downgraded to the Solo plan (1 user only).</strong></p>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Current Plan:</strong> ${company.pricing_level}</p>
        <p style="margin: 5px 0 0 0;"><strong>Team Size:</strong> ${company.max_members} members</p>
      </div>
      
      <p>Please complete your payment immediately to avoid service disruption:</p>
      <a href="${process.env.FRONTEND_URL}/upgrade" 
         style="display: inline-block; background: #DC2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Pay Now to Keep Your Plan
      </a>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Need help? Contact support at ${process.env.SMTP_FROM || 'support@nexiflow.com'}
      </p>
    </div>
  `;

  const text = `
Payment Overdue - Grace Period Active

Hello ${superAdmin.name},

Your payment for ${company.name} is overdue.

*** ACTION REQUIRED ***
Grace Period Ends: ${new Date(graceEndDate).toLocaleDateString()} (${daysLeft} days remaining)

If payment is not received by this date, your account will be downgraded to the Solo plan (1 user only).

Current Plan: ${company.pricing_level}
Team Size: ${company.max_members} members

Please complete your payment immediately:
${process.env.FRONTEND_URL}/upgrade

Need help? Contact support.
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: superAdmin.email,
      subject: `URGENT: Payment Overdue - Account Downgrade in ${daysLeft} Days`,
      text: text,
      html: html
    });
    
    console.log(`Grace period notification sent to ${superAdmin.email} for ${company.name}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send grace period notification:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send running timer reminder email (timer still running after long duration)
 * Recipients: timer owner + company super admins (excluding root).
 */
async function sendRunningTimerReminder({ company, timerOwner, timeEntry, recipients }) {
  const subject = `Timer Still Running - ${company.name}`

  const startTime = timeEntry?.start_time ? new Date(timeEntry.start_time) : null
  const startedAtText = startTime ? startTime.toLocaleString() : 'Unknown'

  const projectText = timeEntry?.project_name ? `Project: ${timeEntry.project_name}` : null
  const clientText = timeEntry?.client_name ? `Client: ${timeEntry.client_name}` : null
  const descriptionText = timeEntry?.description ? `Description: ${timeEntry.description}` : null

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Timer Still Running</h2>
      <p>Hello,</p>
      <p>A time tracker is still running for <strong>${timerOwner.name}</strong> at <strong>${company.name}</strong>.</p>

      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0 0 8px 0;"><strong>Started:</strong> ${startedAtText}</p>
        ${projectText ? `<p style="margin: 0 0 8px 0;"><strong>${projectText}</strong></p>` : ''}
        ${clientText ? `<p style="margin: 0 0 8px 0;"><strong>${clientText}</strong></p>` : ''}
        ${descriptionText ? `<p style="margin: 0;"><strong>${descriptionText}</strong></p>` : ''}
      </div>

      <p>Please review and stop the timer if needed:</p>
      <a href="${process.env.FRONTEND_URL}/" 
         style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Open NexiFlow
      </a>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        This reminder is sent every 12 hours while the timer remains running.
      </p>
    </div>
  `

  const text = `
Timer Still Running

A time tracker is still running for ${timerOwner.name} at ${company.name}.

Started: ${startedAtText}
${projectText || ''}
${clientText || ''}
${descriptionText || ''}

Open NexiFlow: ${process.env.FRONTEND_URL}/
  `.trim()

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: recipients,
      subject,
      text,
      html
    })

    console.log(`Running timer reminder sent to ${recipients.join(', ')} for ${company.name}`)
    return { success: true }
  } catch (error) {
    console.error('Failed to send running timer reminder email:', error)
    return { success: false, error: error.message }
  }
}

/**
 * Send email verification email
 */
async function sendEmailVerificationEmail(user, verifyLink) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Verify Your Email</h2>
      <p>Hello ${user.name || 'there'},</p>
      <p>Thanks for signing up for NexiFlow. Please verify your email address to activate your account.</p>

      <p>
        <a href="${verifyLink}"
           style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
          Verify Email
        </a>
      </p>

      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        This link will expire in 24 hours. If you did not create a NexiFlow account, you can safely ignore this email.
      </p>
    </div>
  `;

  const text = `
Verify Your Email

Hello ${user.name || 'there'},

Thanks for signing up for NexiFlow. Please verify your email address to activate your account.

Verify your email using this link (expires in 24 hours):
${verifyLink}

If you did not create a NexiFlow account, you can safely ignore this email.
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: user.email,
      subject: 'Verify your NexiFlow email',
      text,
      html
    });

    console.log(`Email verification sent to ${user.email}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email verification email:', error);
    return { success: false, error: error.message };
  }
}


/**
 * Send downgrade notification email
 */
async function sendDowngradeNotification(company, superAdmin) {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #DC2626;">Account Downgraded to Solo Plan</h2>
      <p>Hello ${superAdmin.name},</p>
      <p>Due to non-payment, your account for <strong>${company.name}</strong> has been downgraded to the <strong>Solo plan</strong>.</p>
      
      <div style="background: #FEF2F2; border: 1px solid #FECACA; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #DC2626; margin-top: 0;">What This Means</h3>
        <ul style="margin: 0; padding-left: 20px;">
          <li>Your team is now limited to <strong>1 member</strong> (you)</li>
          <li>Additional team members have been deactivated</li>
          <li>Your data is safe and accessible</li>
        </ul>
      </div>
      
      <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Previous Plan:</strong> ${company.pricing_level}</p>
        <p style="margin: 5px 0 0 0;"><strong>New Plan:</strong> Solo (1 user)</p>
      </div>
      
      <p>To restore full access for your team, please upgrade your plan:</p>
      <a href="${process.env.FRONTEND_URL}/upgrade" 
         style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
        Upgrade Now
      </a>
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Questions? Contact support at ${process.env.SMTP_FROM || 'support@nexiflow.com'}
      </p>
    </div>
  `;

  const text = `
Account Downgraded to Solo Plan

Hello ${superAdmin.name},

Due to non-payment, your account for ${company.name} has been downgraded to the Solo plan.

What This Means:
- Your team is now limited to 1 member (you)
- Additional team members have been deactivated
- Your data is safe and accessible

Previous Plan: ${company.pricing_level}
New Plan: Solo (1 user)

To restore full access for your team:
${process.env.FRONTEND_URL}/upgrade

Questions? Contact support.
  `;

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'NexiFlow <support@nexiflow.com>',
      to: superAdmin.email,
      subject: `Account Downgraded - ${company.name}`,
      text: text,
      html: html
    });
    
    console.log(`Downgrade notification sent to ${superAdmin.email} for ${company.name}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to send downgrade notification:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPaymentReminder,
  sendRunningTimerReminder,
  sendGracePeriodNotification,
  sendDowngradeNotification,
  sendPasswordResetEmail,
  sendSetPasswordInviteEmail,
  sendCompanyInviteEmail,
  sendEmailVerificationEmail
};
