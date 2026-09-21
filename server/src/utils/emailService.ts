/**
 * DayFlow Email Service
 * Integrates directly with Brevo (Sendinblue) Transactional Email REST API
 * Operates over standard HTTPS (Port 443) with zero extra dependencies
 */

interface SendEmailParams {
  to: { email: string; name?: string }[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

export class EmailService {
  private static getApiKey(): string {
    return process.env.BREVO_API_KEY || '';
  }

  private static getSender(): { email: string; name: string } {
    return {
      email: process.env.BREVO_SENDER_EMAIL || 'noreply@dayflow.app',
      name: process.env.BREVO_SENDER_NAME || 'DayFlow'
    };
  }

  public static isConfigured(): boolean {
    return !!this.getApiKey();
  }

  private static getBaseAppUrl(): string {
    if (process.env.APP_URL) {
      return process.env.APP_URL.replace(/\/+$/, '');
    }
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: APP_URL environment variable must be set in production!');
    }
    return 'https://localhost';
  }

  /**
   * Low-level method to send transactional email via Brevo REST API v3
   */
  public static async sendMail(params: SendEmailParams): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const apiKey = this.getApiKey();
    const sender = this.getSender();

    if (!apiKey) {
      if (process.env.NODE_ENV === 'production') {
        console.error('❌ [EmailService] Cannot send email: BREVO_API_KEY is not configured in production.');
        return { success: false, error: 'Email delivery service not configured in production.' };
      }
      console.warn('⚠️ [EmailService] BREVO_API_KEY is not set in development. Email transmission simulated:');
      console.log(`   To: ${params.to.map(t => t.email).join(', ')}`);
      console.log(`   Subject: ${params.subject}`);
      if (params.textContent) {
        console.log(`   Text Content:\n${params.textContent}`);
      }
      return { success: true, messageId: 'simulated_' + Date.now() };
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          sender,
          to: params.to,
          subject: params.subject,
          htmlContent: params.htmlContent,
          textContent: params.textContent
        })
      });

      const data: any = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data?.message || `Brevo API error (HTTP ${response.status})`;
        console.error('❌ [EmailService] Brevo API Error:', errorMsg, data);
        return { success: false, error: errorMsg };
      }

      const messageId = data?.messageId || 'brevo_' + Date.now();
      console.log(`✅ [EmailService] Email dispatched successfully to ${params.to[0]?.email} (ID: ${messageId})`);
      return { success: true, messageId };
    } catch (err: any) {
      console.error('❌ [EmailService] Network / fetch error communicating with Brevo:', err.message);
      return { success: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Send Password Reset Link Email
   */
  public static async sendPasswordResetEmail(
    toEmail: string,
    displayName: string,
    resetToken: string
  ): Promise<{ success: boolean; resetUrl: string; error?: string }> {
    const baseUrl = this.getBaseAppUrl();
    const resetUrl = `${baseUrl}/#reset-password?token=${resetToken}&email=${encodeURIComponent(toEmail)}`;

    const subject = 'Reset your DayFlow password';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset your DayFlow password</title>
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    .header { padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(180deg, rgba(99, 102, 241, 0.15) 0%, rgba(30, 41, 59, 0) 100%); border-bottom: 1px solid #334155; }
    .logo { font-size: 40px; line-height: 1; margin-bottom: 12px; display: inline-block; }
    .brand-title { font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px; margin: 0; }
    .content { padding: 32px; }
    .greeting { font-size: 18px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .text { font-size: 15px; line-height: 1.6; color: #cbd5e1; margin-bottom: 24px; }
    .btn-container { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff !important; text-decoration: none; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35); }
    .alt-link-box { background: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 14px; margin-top: 24px; word-break: break-all; font-size: 12px; color: #94a3b8; line-height: 1.5; }
    .alt-link-box a { color: #818cf8; text-decoration: underline; }
    .footer { padding: 20px 32px; background: #0f172a; border-top: 1px solid #334155; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <div class="logo">⏳</div>
      <h1 class="brand-title">DayFlow</h1>
    </div>
    <div class="content">
      <h2 class="greeting">Hello ${escapeHtml(displayName || 'there')},</h2>
      <p class="text">We received a request to reset the password for your DayFlow account. Click the button below to choose a new password:</p>
      
      <div class="btn-container">
        <a href="${escapeHtml(resetUrl)}" class="btn" target="_blank">Reset Password</a>
      </div>

      <p class="text" style="font-size: 13px; color: #94a3b8; margin-bottom: 8px;">If the button doesn't work, copy and paste this link into your browser:</p>
      <div class="alt-link-box">
        <a href="${escapeHtml(resetUrl)}" target="_blank">${escapeHtml(resetUrl)}</a>
      </div>

      <p class="text" style="font-size: 13px; color: #94a3b8; margin-top: 24px; margin-bottom: 0;">
        ⏳ <strong>Security notice:</strong> This password reset link is valid for <strong>1 hour</strong>. If you did not request this, you can safely ignore this email; your account remains secure.
      </p>
    </div>
    <div class="footer">
      DayFlow — 30-Minute Schedule, Habit Ledger & Focus Analytics<br>
      © 2026 DayFlow. All rights reserved.
    </div>
  </div>
</body>
</html>
    `;

    const textContent = `
Hello ${displayName || 'there'},

We received a request to reset the password for your DayFlow account.

Please open the following link in your browser to choose a new password:
${resetUrl}

This link is valid for 1 hour. If you did not request a password reset, you can safely ignore this email.

— DayFlow Team
    `.trim();

    const sendRes = await this.sendMail({
      to: [{ email: toEmail, name: displayName }],
      subject,
      htmlContent,
      textContent
    });

    return {
      success: sendRes.success,
      resetUrl,
      error: sendRes.error
    };
  }

  /**
   * Send Password Changed Security Notice Email
   */
  public static async sendPasswordChangedNotice(toEmail: string, displayName: string): Promise<void> {
    const subject = 'Security alert: Your DayFlow password was changed';
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #f8fafc; }
    .wrapper { max-width: 560px; margin: 40px auto; background: #1e293b; border-radius: 16px; border: 1px solid #334155; padding: 32px; }
    .logo { font-size: 32px; margin-bottom: 12px; }
    .title { font-size: 20px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .text { font-size: 14px; line-height: 1.6; color: #cbd5e1; margin-bottom: 16px; }
    .alert-box { background: rgba(244, 63, 94, 0.1); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px 16px; color: #fda4af; font-size: 13px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="logo">🔐</div>
    <h2 class="title">Password Changed Successfully</h2>
    <p class="text">Hello ${escapeHtml(displayName || 'there')},</p>
    <p class="text">This is a security confirmation that the password for your DayFlow account (<strong>${escapeHtml(toEmail)}</strong>) was updated.</p>
    <div class="alert-box">
      <strong>Didn't make this change?</strong> If you did not change your password, your account may be compromised. Please perform a password reset immediately and review your account activity.
    </div>
    <p class="text" style="color: #64748b; font-size: 12px; margin-bottom: 0;">© 2026 DayFlow. All rights reserved.</p>
  </div>
</body>
</html>
    `;

    await this.sendMail({
      to: [{ email: toEmail, name: displayName }],
      subject,
      htmlContent
    });
  }
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
