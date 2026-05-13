import { chatCompletion } from '../../utils/llm';
import { logger } from '../../utils/logger';

interface ExtractionField {
  name: string;
  description: string;
}

/**
 * Extracts structured data from text based on user-defined fields using LLM.
 */
export const extractDataFromText = async (text: string, fields: ExtractionField[]): Promise<any> => {
  if (!fields || fields.length === 0) {
    throw new Error('No fields provided for extraction');
  }

  // Create a JSON schema-like description for the prompt
  const fieldsDescription = fields
    .map((f) => `- "${f.name}": ${f.description}`)
    .join('\n');

  const prompt = `
You are a precision-oriented data extraction engine.
Your goal is to find and extract the requested information from the document text below.

DOCUMENT CONTENT:
\"\"\"
${text.slice(0, 32000)} 
\"\"\"

FIELDS TO EXTRACT:
${fieldsDescription}

STRICT RULES:
1. Return a valid JSON object only.
2. The keys MUST be exactly as named in the list above.
3. If information for a field is present but worded differently, extract it.
4. If a field is truly missing, use null.
5. Do not include any notes, markdown formatting (no \`\`\`json), or talkative text.
6. For technical terms like \"LORA\", check for variations or related model numbers.
  `.trim();

  try {
    const response = await chatCompletion({
      messages: [
        { 
          role: 'system', 
          content: 'You are a professional data analyst. You extract structured data from documents with high recall and precision. Always output valid JSON.' 
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2
    });

    return JSON.parse(response);
  } catch (error: any) {
    logger.error(`Data Extraction Error: ${error.message}`);
    throw new Error(`Failed to extract data: ${error.message}`);
  }
};
