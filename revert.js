const fs = require('fs');
const file = 'frontend/src/app/documents/[id]/page.tsx';
let content = fs.readFileSync(file, 'utf8');

const before = content;
content = content.replace(
    /\{originalUrl && \([\s\S]*?<ExternalLink className="w-3\.5 h-3\.5" \/>\r?\n\s*\{copy\.documents\.detail\.visualize\}\r?\n\s*<\/Button>\r?\n\s*\)\}/,
    (match) => match.replace(/originalUrl/g, "previewUrl")
);

if (content !== before) {
    console.log('Button replaced successfully.');
} else {
    console.log('Button replacement failed.');
}

fs.writeFileSync(file, content);
