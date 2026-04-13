import mongoose from 'mongoose';
import { DocumentModel } from './src/modules/documents/document.model';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/intelligence_documentaire');
  const doc = await DocumentModel.findOne({ originalName: 'Chapitre1.pdf' }).lean();
  console.log('DOC FOUND:', JSON.stringify(doc, null, 2));
  process.exit(0);
}

run();
