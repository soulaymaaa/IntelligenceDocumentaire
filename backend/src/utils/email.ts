import nodemailer from 'nodemailer';
import { logger } from './logger';
import { env } from '../config/env';

export interface VerificationEmailResult {
  deliveredToInbox: boolean;
  previewUrl?: string;
}

const buildTransport = async () => {
  let transportConfig: any = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  };

  if (env.SMTP_USER === 'votre.email@gmail.com' || (env.NODE_ENV === 'development' && !env.SMTP_USER)) {
    logger.info('Using Ethereal fallback for email delivery...');
    const testAccount = await nodemailer.createTestAccount();
    transportConfig = {
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    };
  }

  return {
    transportConfig,
    transporter: nodemailer.createTransport(transportConfig),
  };
};

const sendCodeEmail = async (
  to: string,
  code: string,
  content: {
    subject: string;
    heading: string;
    intro: string;
    expiryNote: string;
  }
): Promise<VerificationEmailResult> => {
  try {
    const { transportConfig, transporter } = await buildTransport();

    const info = await transporter.sendMail({
      from: env.SMTP_FROM || transportConfig.auth.user,
      to,
      subject: content.subject,
      text: `${content.heading}\n\n${content.intro}\n\nCode: ${code}\n\n${content.expiryNote}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>${content.heading}</h2>
          <p>${content.intro}</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p><em>${content.expiryNote}</em></p>
        </div>
      `,
    });

    logger.info(`Code email sent to ${to}. Code: ${code}`);

    const previewUrl = nodemailer.getTestMessageUrl(info as any);
    if (previewUrl) {
      logger.info(`Preview URL (Ethereal): ${previewUrl}`);
    }

    return {
      deliveredToInbox: !previewUrl,
      previewUrl: previewUrl || undefined,
    };
  } catch (error) {
    logger.error('Failed to send code email:', error);
    logger.info(`Code for ${to}: ${code}`);

    if (env.NODE_ENV === 'production') {
      throw new Error('Failed to send email');
    }

    return {
      deliveredToInbox: false,
    };
  }
};

export const sendPasswordChangedEmail = async (to: string): Promise<VerificationEmailResult> => {
  try {
    const { transportConfig, transporter } = await buildTransport();

    const info = await transporter.sendMail({
      from: env.SMTP_FROM || transportConfig.auth.user,
      to,
      subject: 'Your password has been changed',
      text: 'Hello,\n\nYour DocIntel account password has just been changed.\nIf this was not you, please secure your account immediately.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password changed</h2>
          <p>Your DocIntel account password has just been changed.</p>
          <p>If this was not you, please secure your account immediately.</p>
        </div>
      `,
    });

    logger.info(`Password change notification sent to ${to}`);

    const previewUrl = nodemailer.getTestMessageUrl(info as any);
    if (previewUrl) {
      logger.info(`Preview URL (Ethereal): ${previewUrl}`);
    }

    return {
      deliveredToInbox: !previewUrl,
      previewUrl: previewUrl || undefined,
    };
  } catch (error) {
    logger.error('Failed to send password change notification:', error);

    if (env.NODE_ENV === 'production') {
      throw new Error('Failed to send password change notification email');
    }

    return {
      deliveredToInbox: false,
    };
  }
};

export const sendVerificationEmail = async (to: string, code: string): Promise<VerificationEmailResult> =>
  sendCodeEmail(to, code, {
    subject: 'Verify your email address',
    heading: 'Welcome to Intelligence Documentaire',
    intro: 'Use the verification code below to activate your account:',
    expiryNote: 'This code expires in 15 minutes.',
  });

export const sendPasswordResetEmail = async (to: string, code: string): Promise<VerificationEmailResult> =>
  sendCodeEmail(to, code, {
    subject: 'Reset your password',
    heading: 'Password reset request',
    intro: 'Use the code below to continue resetting your password:',
    expiryNote: 'This code expires in 15 minutes.',
  });

export const sendReminderEmail = async (
  to: string, 
  taskText: string, 
  taskDate: string
): Promise<VerificationEmailResult> => {
  try {
    const { transportConfig, transporter } = await buildTransport();

    const info = await transporter.sendMail({
      from: env.SMTP_FROM || transportConfig.auth.user,
      to,
      subject: `Task Reminder for Tomorrow`,
      text: `This is a reminder for your scheduled task tomorrow (${taskDate}): ${taskText}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 24px; color: #1e293b;">
          <h2 style="color: #2563eb; margin-top: 0;">Task Reminder</h2>
          <p>Hello,</p>
          <p>This is a reminder for your scheduled task <strong>tomorrow</strong> (${taskDate}):</p>
          <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 16px; margin: 20px 0; font-size: 16px; font-weight: bold;">
            ${taskText}
          </div>
          <p>Remember to check your planner to manage your tasks.</p>
          <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
          <p style="font-size: 12px; color: #64748b;">Intelligence Documentaire - Your intelligent assistant</p>
        </div>
      `,
    });

    logger.info(`Reminder email sent to ${to} for task: ${taskText}`);

    const previewUrl = nodemailer.getTestMessageUrl(info as any);
    return {
      deliveredToInbox: !previewUrl,
      previewUrl: previewUrl || undefined,
    };
  } catch (error) {
    logger.error('Failed to send reminder email:', error);
    return { deliveredToInbox: false };
  }
};
