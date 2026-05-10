const fs = require('fs');
const file = 'frontend/src/app/documents/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const s1 = "  const previewUrl = getDocumentPreviewUrl(previewFilename, undefined, doc?.updatedAt);\r\n  const highlightTerms = activeAssistantMessage?.highlights?.flatMap((item) => item.matchedTerms) || [];";
const r1 = "  const previewUrl = getDocumentPreviewUrl(previewFilename, undefined, doc?.updatedAt);\r\n  const originalUrl = getDocumentPreviewUrl(doc?.filename, undefined, doc?.updatedAt);\r\n  const highlightTerms = activeAssistantMessage?.highlights?.flatMap((item) => item.matchedTerms) || [];";

if (content.includes(s1)) {
    content = content.replace(s1, r1);
    console.log('Chunk 1 replaced.');
} else {
    const s1_n = s1.replace(/\r/g, '');
    const r1_n = r1.replace(/\r/g, '');
    if (content.includes(s1_n)) {
        content = content.replace(s1_n, r1_n);
        console.log('Chunk 1 replaced with \\n.');
    } else {
        console.log('Chunk 1 failed.');
    }
}

const before = content;
content = content.replace(
    /\{previewUrl && \([\s\S]*?<ExternalLink className="w-3\.5 h-3\.5" \/>\r?\n\s*\{copy\.documents\.detail\.visualize\}\r?\n\s*<\/Button>\r?\n\s*\)\}/,
    (match) => match.replace(/previewUrl/g, "originalUrl")
);

if (content !== before) {
    console.log('Chunk 2 replaced.');
} else {
    console.log('Chunk 2 failed.');
}

fs.writeFileSync(file, content);
