import nodemailer from 'nodemailer';
import { logger } from './logger';
import { env } from '../config/env';

export const sendVerificationEmail = async (to: string, code: string): Promise<void> => {
  try {
    let transportConfig: any = {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    };

    // Auto-fallback to Ethereal if using defaults or in development without real SMTP
    if (env.SMTP_USER === 'votre.email@gmail.com' || env.NODE_ENV === 'development' && !env.SMTP_USER) {
      logger.info('Using Ethereal fallback for email verification...');
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

    const transporter = nodemailer.createTransport(transportConfig);

    const info = await transporter.sendMail({
      from: env.SMTP_FROM || transportConfig.auth.user,
      to,
      subject: 'Vérifiez votre adresse email',
      text: `Bienvenue ! Votre code de vérification est : ${code}. Ce code expirera dans 15 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Bienvenue sur Intelligence Documentaire !</h2>
          <p>Merci de vous être inscrit(e). Pour finaliser la création de votre compte, veuillez entrer le code de vérification suivant :</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 5px; margin: 20px 0;">
            ${code}
          </div>
          <p><em>Attention : Ce code expirera dans 15 minutes.</em></p>
          <p>Si vous n'avez pas demandé cette inscription, vous pouvez ignorer cet email.</p>
        </div>
      `,
    });

    logger.info(`Verification email sent to ${to}. Code: ${code}`);
    
    const previewUrl = nodemailer.getTestMessageUrl(info as any);
    if (previewUrl) {
      logger.info(`Preview URL (Ethereal): ${previewUrl}`);
    }
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    // Log the code anyway so the user can verify in dev even if email fails
    logger.info(`Verification Code for ${to}: ${code}`);
    if (env.NODE_ENV === 'production') {
      throw new Error('Failed to send verification email');
    }
  }
};
