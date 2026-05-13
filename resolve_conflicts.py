import re
import os

def resolve_file_conflicts(filepath):
    if not os.path.exists(filepath):
        print(f"File {filepath} not found.")
        return

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Regex to match conflict blocks
    # Group 1: Ours (HEAD), Group 2: Theirs (Remote)
    conflict_pattern = re.compile(r'<<<<<<< HEAD\n(.*?)\n?=======\n(.*?)\n?>>>>>>> [a-f0-9]+', re.DOTALL)

    def merge_logic(match):
        ours = match.group(1).strip()
        theirs = match.group(2).strip()

        # Custom logic for specific blocks
        if 'import' in ours and 'import' in theirs:
            # Merge imports
            our_lines = set(ours.split('\n'))
            their_lines = set(theirs.split('\n'))
            merged_lines = sorted(list(our_lines.union(their_lines)))
            return '\n'.join(merged_lines)

        if 'lucide-react' in ours or 'lucide-react' in theirs:
            # Merge icons list
            # Extract names between { and }
            our_icons = set(re.findall(r'(\w+),', ours))
            their_icons = set(re.findall(r'(\w+),', theirs))
            all_icons = sorted(list(our_icons.union(their_icons)))
            
            # Reconstruction (assuming one block of icons)
            header = "  " + ",\n  ".join(all_icons) + ",\n} from 'lucide-react';"
            return header

        if 'PdfPreview' in theirs and 'PdfPreview' not in ours:
            # Keep the new component from remote
            return theirs

        # Default: Prefer OURS (HEAD) as it usually has the latest feature updates
        # unless it's empty
        if not ours: return theirs
        return ours

    resolved_content = conflict_pattern.sub(merge_logic, content)

    # Secondary pass for any nested or slightly different markers if they exist
    # (though git usually doesn't nest them unless forced)

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(resolved_content)
    print(f"Resolved conflicts in {filepath}")

if __name__ == "__main__":
    target = r'frontend/src/app/documents/[id]/page.tsx'
    resolve_file_conflicts(target)
