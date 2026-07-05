import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Sends transactional email via Resend (Modification #10). If RESEND_API_KEY is
 * not configured (e.g. local dev), the message is logged instead of sent so the
 * flow still works end-to-end.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly apiKey?: string;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('RESEND_API_KEY');
    this.from = config.get<string>(
      'MAIL_FROM',
      'FinTrack <onboarding@resend.dev>',
    );
  }

  async sendPasswordReset(to: string, resetUrl: string): Promise<void> {
    const subject = 'Reset your FinTrack password';
    const html = `
      <div style="font-family: sans-serif; line-height: 1.6;">
        <h2>Reset your password</h2>
        <p>We received a request to reset your FinTrack password.</p>
        <p><a href="${resetUrl}">Tap here to set a new password</a></p>
        <p>Or use this link:<br/><code>${resetUrl}</code></p>
        <p>This link expires shortly. If you didn't request this, you can ignore this email.</p>
      </div>`;
    await this.send(to, subject, html);
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.apiKey) {
      this.logger.warn(
        `RESEND_API_KEY not set — email NOT sent. To: ${to} | Subject: ${subject}`,
      );
      this.logger.warn(`Email body (dev fallback): ${html}`);
      return;
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from: this.from, to, subject, html }),
      });
      if (!response.ok) {
        const detail = await response.text();
        this.logger.error(`Resend failed (${response.status}): ${detail}`);
      }
    } catch (error) {
      this.logger.error(`Resend request error: ${String(error)}`);
    }
  }
}
