import mongoose from 'mongoose';
import { DocumentModel } from './src/modules/documents/document.model';

async function run() {
  await mongoose.connect('mongodb://localhost:27017/intelligence_documentaire');
  const docs = await DocumentModel.find().lean();
  console.log(JSON.stringify(docs.map(d => ({
    id: d._id,
    name: d.originalName,
    status: d.status,
    err: (d as any).errorMessage
  })), null, 2));
  process.exit(0);
}

run();
