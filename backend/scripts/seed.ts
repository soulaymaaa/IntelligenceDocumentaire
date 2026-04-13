import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../src/config/database';
import { UserModel } from '../src/modules/users/user.model';
import { DocumentModel } from '../src/modules/documents/document.model';
import { DocumentChunkModel } from '../src/modules/embeddings/chunk.model';
import { logger } from '../src/utils/logger';

const seed = async () => {
  await connectDatabase();
  logger.info('Connected to database for seeding...');

  // Clean existing demo data
  await UserModel.deleteMany({ email: { $in: ['demo@example.com', 'admin@example.com'] } });
  await DocumentModel.deleteMany({ originalName: { $regex: /^demo_/ } });

  // Create demo users
  const demoPasswordHash = await bcrypt.hash('Demo1234!', 12);

  const demoUser = await UserModel.create({
    name: 'Demo User',
    email: 'demo@example.com',
    passwordHash: demoPasswordHash,
    role: 'user',
    isVerified: true,
  });

  const adminUser = await UserModel.create({
    name: 'Admin User',
    email: 'admin@example.com',
    passwordHash: await bcrypt.hash('Admin1234!', 12),
    role: 'admin',
    isVerified: true,
  });

  logger.info(`Created users: ${demoUser.email}, ${adminUser.email}`);

  // Create demo documents (without actual files — for UI demo)
  const demoDoc = await DocumentModel.create({
    ownerId: demoUser._id,
    filename: 'demo_contract.pdf',
    originalName: 'demo_Annual Report 2024.pdf',
    mimeType: 'application/pdf',
    size: 245678,
    storagePath: 'uploads/demo_contract.pdf',
    status: 'indexed',
    extractedText: `Annual Report 2024

Executive Summary

This annual report presents the key performance indicators and financial highlights of our organization for the fiscal year 2024. The company achieved record revenues of €45 million, representing a 23% growth compared to the previous year.

Key Highlights:
- Revenue: €45M (+23% YoY)
- Net Profit: €8.2M (+15% YoY)
- Employee Count: 342 (+45 new hires)
- Customer Satisfaction Score: 4.7/5

Strategic Initiatives

Throughout 2024, we focused on three main strategic pillars: digital transformation, customer experience enhancement, and sustainable business practices. Our investment in AI-powered document processing reduced operational costs by 18%.

Financial Performance

The second quarter showed the strongest performance with Q2 revenue reaching €13.5M. This growth was driven primarily by our expansion into the European market and the successful launch of our enterprise product tier.

Looking Forward

For fiscal year 2025, we project continued growth in the 20-25% range, with particular focus on the DACH and Nordic markets. We plan to increase R&D investment to 15% of revenue to maintain our competitive advantage.`,
    pageCount: 12,
    summary:
      'Annual Report 2024 showing record revenues of €45M (+23% YoY), net profit of €8.2M, and 342 employees. Key highlights include digital transformation initiatives, expansion into European markets, and projected 20-25% growth for 2025.',
    archived: false,
  });

  const demoDoc2 = await DocumentModel.create({
    ownerId: demoUser._id,
    filename: 'demo_invoice.pdf',
    originalName: 'demo_Invoice_Q4_2024.pdf',
    mimeType: 'application/pdf',
    size: 45123,
    storagePath: 'uploads/demo_invoice.pdf',
    status: 'indexed',
    extractedText: `INVOICE #INV-2024-0892

Date: December 15, 2024
Due Date: January 15, 2025

From: TechCorp Solutions SAS
123 Rue de la Paix
75001 Paris, France
SIRET: 123 456 789 00012

To: ClientCo International
456 Business Avenue
92100 Boulogne-Billancourt, France

Services Rendered:
- Software Development Services (160h × €150/h): €24,000
- System Architecture Consulting: €5,000
- Project Management: €2,500

Subtotal: €31,500
VAT (20%): €6,300
Total Due: €37,800

Payment Terms: 30 days net
Bank: BNP Paribas — IBAN: FR76 1234 5678 9012 3456 7890 123`,
    pageCount: 1,
    summary:
      'Q4 2024 invoice from TechCorp Solutions SAS to ClientCo International for software development services totaling €37,800 (€31,500 + 20% VAT). Due date: January 15, 2025.',
    archived: false,
  });

  const demoDoc3 = await DocumentModel.create({
    ownerId: demoUser._id,
    filename: 'demo_pending.png',
    originalName: 'demo_Scanned Document.png',
    mimeType: 'image/png',
    size: 1234567,
    storagePath: 'uploads/demo_pending.png',
    status: 'pending',
    archived: false,
  });

  logger.info(`Created ${3} demo documents`);

  // Create demo chunks for indexed documents
  // Xenova all-MiniLM-L6-v2 produces 384-dim embeddings
  const EMBEDDING_DIM = 384;
  const demoChunks = [
    {
      documentId: demoDoc._id,
      ownerId: demoUser._id,
      chunkIndex: 0,
      text: 'Annual Report 2024 - Executive Summary. Record revenues of €45 million, representing a 23% growth.',
      embedding: Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 0.1),
      tokenCount: 45,
    },
    {
      documentId: demoDoc._id,
      ownerId: demoUser._id,
      chunkIndex: 1,
      text: 'Key Highlights: Revenue €45M (+23% YoY), Net Profit €8.2M (+15% YoY), 342 employees, Customer Satisfaction 4.7/5.',
      embedding: Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 0.1),
      tokenCount: 52,
    },
    {
      documentId: demoDoc2._id,
      ownerId: demoUser._id,
      chunkIndex: 0,
      text: 'Invoice #INV-2024-0892 from TechCorp Solutions SAS. Software development 160h × €150 = €24,000. Total: €37,800.',
      embedding: Array.from({ length: EMBEDDING_DIM }, () => Math.random() * 0.1),
      tokenCount: 48,
    },
  ];

  await DocumentChunkModel.insertMany(demoChunks);

  logger.info('Seed completed successfully!');
  logger.info('');
  logger.info('Demo credentials:');
  logger.info('  Email:    demo@example.com');
  logger.info('  Password: Demo1234!');
  logger.info('');
  logger.info('Admin credentials:');
  logger.info('  Email:    admin@example.com');
  logger.info('  Password: Admin1234!');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
