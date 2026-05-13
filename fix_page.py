import sys

path = 'frontend/src/app/documents/[id]/page.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Imports
content = content.replace(
    '  Download,\n} from \'lucide-react\';',
    '  Download,\n  Plus,\n  Table,\n  ClipboardCopy,\n} from \'lucide-react\';'
)
content = content.replace(
    'import { Card } from \'@/components/ui/Card\';',
    'import { Card, CardTitle } from \'@/components/ui/Card\';\nimport { Input } from \'@/components/ui/Input\';'
)

# 2. Type
content = content.replace(
    'type DetailTab = \'overview\' | \'highlights\' | \'summary\' | \'mind_map\' | \'chat\' | \'translate\';',
    'type DetailTab = \'overview\' | \'highlights\' | \'summary\' | \'mind_map\' | \'chat\' | \'translate\' | \'extraction\';'
)

# 3. States
content = content.replace(
    '  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);\n  const translationRef = useRef<HTMLDivElement>(null);',
    '  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);\n  const [extractionFields, setExtractionFields] = useState<Array<{ name: string; description: string }>>([\n    { name: \'Titre\', description: \'Le titre du document\' },\n  ]);\n  const [extractionResult, setExtractionResult] = useState<any>(null);\n  const translationRef = useRef<HTMLDivElement>(null);'
)

# 4. Mutation
mutation_code = '''  const extractionMutation = useMutation({
    mutationFn: (fields: Array<{ name: string; description: string }>) => aiApi.extract(id, fields),
    onSuccess: (data) => {
      setExtractionResult(data);
    },
  });'''

content = content.replace(
    '    },\n  });\n\n  const [isEditingName',
    '    },\n  });\n\n' + mutation_code + '\n\n  const [isEditingName'
)

# 5. Tab
content = content.replace(
    '            { id: \'translate\', label: copy.documents.detail.tabs.translate, icon: Languages },',
    '            { id: \'translate\', label: copy.documents.detail.tabs.translate, icon: Languages },\n            { id: \'extraction\', label: copy.documents.detail.extraction.title, icon: Sparkles },'
)

# 6. Content
ui_code = """
        {tab === 'extraction' && (
          <div className="grid gap-6 lg:grid-cols-[400px,1fr]">
            <Card className="border-surface-200">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-extrabold tracking-tight text-slate-900 dark:text-slate-100">{copy.documents.detail.extraction.title}</h2>
                  <p className="text-sm font-medium text-slate-500">{copy.documents.detail.extraction.description}</p>
                </div>
              </div>

              <div className="space-y-4">
                {extractionFields.map((field, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-surface-50 border border-surface-200 relative group">
                    <button
                      onClick={() => setExtractionFields(extractionFields.filter((_, i) => i !== idx))}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <div className="space-y-3">
                      <Input
                        label={copy.documents.detail.extraction.fieldName}
                        value={field.name}
                        onChange={(e) => {
                          const newFields = [...extractionFields];
                          newFields[idx].name = e.target.value;
                          setExtractionFields(newFields);
                        }}
                        className="h-10 text-xs"
                      />
                      <Input
                        label={copy.documents.detail.extraction.fieldDesc}
                        value={field.description}
                        onChange={(e) => {
                          const newFields = [...extractionFields];
                          newFields[idx].description = e.target.value;
                          setExtractionFields(newFields);
                        }}
                        className="h-10 text-xs"
                      />
                    </div>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  className="w-full border-dashed border-2 hover:border-brand-500/50 hover:bg-brand-50/30"
                  onClick={() => setExtractionFields([...extractionFields, { name: '', description: '' }])}
                >
                  <Plus className="w-4 h-4" />
                  {copy.documents.detail.extraction.addField}
                </Button>

                <Button
                  className="w-full h-12 shadow-brand-500/10"
                  disabled={extractionFields.length === 0 || !doc?.extractedText}
                  isLoading={extractionMutation.isPending}
                  onClick={() => extractionMutation.mutate(extractionFields)}
                >
                  <Sparkles className="w-4 h-4" />
                  {copy.documents.detail.extraction.extract}
                </Button>
              </div>
            </Card>

            <Card className="border-surface-200 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <CardTitle className="flex items-center gap-2">
                  <Table className="w-5 h-5 text-brand-500" />
                  {copy.documents.detail.extraction.result}
                </CardTitle>
                {extractionResult && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[10px] font-black uppercase tracking-widest"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(extractionResult, null, 2));
                    }}
                  >
                    <ClipboardCopy className="w-3 h-3" />
                    Copy JSON
                  </Button>
                )}
              </div>

              {!extractionResult ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 text-center opacity-50">
                  <div className="w-16 h-16 rounded-3xl bg-surface-100 flex items-center justify-center mb-4">
                    <Table className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{copy.documents.detail.extraction.empty}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-2xl border border-surface-200">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-surface-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 border-b border-surface-200">{copy.documents.detail.extraction.fieldName}</th>
                        <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-slate-400 border-b border-surface-200">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {Object.entries(extractionResult).map(([key, value]) => (
                        <tr key={key} className="hover:bg-surface-50/50 transition-colors">
                          <td className="px-6 py-4 text-sm font-extrabold text-slate-900 border-r border-surface-100 w-1/3">{key}</td>
                          <td className="px-6 py-4 text-sm font-medium text-slate-700">
                            {value === None ? (
                              <span className="text-slate-300 italic">Not found</span>
                            ) : typeof value === 'object' ? (
                              <pre className="text-xs bg-slate-50 p-2 rounded-lg">{JSON.stringify(value, null, 2)}</pre>
                            ) : (
                              String(value)
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )"""

# Careful with the replacement of tab content
content = content.replace(
    '\n\n        {tab === \'chat\' && (',
    '\n' + ui_code + '\n\n        {tab === \'chat\' && ('
)

# Final fix for Python None
content = content.replace('value === None', 'value === null')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
