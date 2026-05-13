import sys

path = 'frontend/src/app/documents/[id]/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Target the specific cell rendering logic with a more robust replacement
target = """                            {value === null ? (
                              <span className="text-slate-300 italic">Not found</span>
                            ) : typeof value === 'object' ? (
                              <pre className="text-xs bg-slate-50 p-2 rounded-lg">{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                              String(value)
                            )}"""

replacement = """                            {value === null ? (
                              <span className="text-slate-300 italic">Not found</span>
                            ) : Array.isArray(value) ? (
                              <div className="space-y-1.5">
                                {value.map((v, i) => (
                                  <div key={i} className="text-sm font-medium text-slate-700 bg-surface-50/50 px-3 py-1.5 rounded-xl border border-surface-100">
                                    {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                  </div>
                                ))}
                              </div>
                            ) : typeof value === 'object' ? (
                              <pre className="text-xs bg-slate-50 p-2 rounded-lg">{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                              String(value)
                            )}"""

if target in content:
    content = content.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("Replacement successful")
else:
    print("Target string not found")
