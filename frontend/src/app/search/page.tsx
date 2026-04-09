'use client';

import { useState } from 'react';
import { Search, Sparkles, FileText, ChevronRight, AlertCircle, Loader2, Brain } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Input';
import { searchApi, aiApi } from '@/lib/api';
import { getErrorMessage, truncate, cn } from '@/lib/utils';
import type { SearchResult, RagAnswer } from '@/types';
import Link from 'next/link';

type Mode = 'search' | 'ask';

export default function SearchPage() {
  const [mode, setMode] = useState<Mode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [answer, setAnswer] = useState<RagAnswer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setError('');
    setResults([]);
    setAnswer(null);
    setIsLoading(true);
    setHasSearched(true);
    try {
      if (mode === 'search') {
        const res = await searchApi.semantic(query, 8);
        setResults(res);
      } else {
        const res = await aiApi.askGlobal(query, 6);
        setAnswer(res);
      }
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSearch();
  };

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-3xl bg-brand-gradient shadow-xl shadow-brand-500/20 mx-auto mb-6 flex items-center justify-center">
            <Search className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Intelligence Search</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-3 text-lg font-medium max-w-2xl mx-auto">Query your entire document library using deep semantic indexing or get direct answers from our specialized AI engine.</p>
        </div>

        {/* Mode toggle */}
        <div className="flex bg-surface-100 border border-surface-200 rounded-2xl p-1.5 gap-1.5 shadow-inner max-w-md mx-auto">
          <button
            onClick={() => { setMode('search'); setResults([]); setAnswer(null); setHasSearched(false); }}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all ${
              mode === 'search' 
                ? 'bg-card text-brand-700 dark:text-brand-400 shadow-sm border border-surface-200 dark:border-brand-500/20' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-card/50'
            }`}
          >
            <Search className="w-4 h-4" /> Semantic Search
          </button>
          <button
            onClick={() => { setMode('ask'); setResults([]); setAnswer(null); setHasSearched(false); }}
            className={`flex-1 flex items-center justify-center gap-2.5 py-3 rounded-xl text-sm font-bold transition-all ${
              mode === 'ask' 
                ? 'bg-card text-brand-700 dark:text-brand-400 shadow-sm border border-surface-200 dark:border-brand-500/20' 
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-card/50'
            }`}
          >
            <Sparkles className="w-4 h-4" /> AI Questioning
          </button>
        </div>

        {/* Query input */}
        <Card className="p-6 border-surface-200 shadow-md">
          <Textarea
            placeholder={
              mode === 'search'
                ? 'Synthesize a query… e.g. "Identify key financial risks mentioned in the 2024 auditing reports"'
                : 'Ask a specific question… e.g. "What are the termination conditions in the master service agreement?"'
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
            className="bg-surface-50 dark:bg-slate-900/50 border-surface-200 focus:bg-card text-lg font-medium placeholder:text-slate-300 dark:placeholder:text-slate-600"
          />
          <div className="flex items-center justify-between mt-5">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              <span className="px-1.5 py-0.5 bg-surface-100 rounded border border-surface-200">Ctrl</span> + <span className="px-1.5 py-0.5 bg-surface-100 rounded border border-surface-200">Enter</span> to search
            </div>
            <Button onClick={handleSearch} isLoading={isLoading} disabled={!query.trim()} size="lg" className="px-10 shadow-lg shadow-brand-500/20">
              {isLoading
                ? 'Processing…'
                : mode === 'search'
                ? <><Search className="w-5 h-5 mr-1" /> Semantic Search</>
                : <><Sparkles className="w-5 h-5 mr-1" /> Generate Answer</>
              }
            </Button>
          </div>
        </Card>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 text-red-600 dark:text-red-400 font-bold shadow-sm animate-fade-in">
            <AlertCircle className="w-6 h-6 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="text-center py-16 animate-pulse">
            <Loader2 className="w-12 h-12 text-brand-600 dark:text-brand-400 animate-spin mx-auto mb-4" />
            <p className="text-slate-900 dark:text-slate-100 font-bold text-lg">{mode === 'ask' ? 'Synthesizing knowledge engine response…' : 'Executing deep semantic index search…'}</p>
          </div>
        )}

        {/* Semantic Search results */}
        {mode === 'search' && hasSearched && !isLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
               <p className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                {results.length === 0 ? 'No fragments identified' : `${results.length} relevant intelligence fragments identified`}
              </p>
              <div className="h-px flex-1 bg-surface-100" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {results.map((r, i) => (
                <Card key={r.chunkId} className="animate-fade-in hover:border-brand-500/30 transition-all p-6 bg-card border-surface-200" hover>
                  <div className="flex items-start gap-5">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center shrink-0">
                      <span className="text-brand-700 dark:text-brand-400 font-extrabold text-sm">#{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-4 flex-wrap mb-3">
                        <Link
                          href={`/documents/${r.documentId}`}
                          className="text-sm font-bold text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-300 transition-colors flex items-center gap-1.5"
                        >
                          <FileText className="w-4 h-4" />
                          {r.documentName}
                          <ChevronRight className="w-3.5 h-3.5 opacity-50" />
                        </Link>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-surface-100 px-2.5 py-1 rounded-full border border-surface-200 uppercase tracking-tight">
                          Relevance: {(r.score * 100).toFixed(1)}%
                        </span>
                        {r.pageNumber && (
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight">Pg. {r.pageNumber}</span>
                        )}
                      </div>
                      <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-semibold italic">
                        &hellip;{truncate(r.text, 350)}&hellip;
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* RAG Answer */}
        {mode === 'ask' && answer && !isLoading && (
          <div className="space-y-8 animate-slide-up">
            <Card className={cn(
              "p-8 border-2 shadow-xl shadow-brand-500/10 relative overflow-hidden",
              answer.hasAnswer 
                ? 'border-brand-500/20 bg-card' 
                : 'border-amber-500/20 bg-amber-500/5'
            )}>
              <div className="absolute top-0 right-0 p-6 hidden sm:block opacity-5">
                <Brain className="w-24 h-24 text-brand-600 dark:text-brand-400" />
              </div>
              <div className="flex items-start gap-6">
                <div className="w-14 h-14 rounded-2xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-lg shadow-brand-500/20">
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className="text-[11px] font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-[0.2em] mb-4">Deep Insight Engine Response</p>
                  <p className="text-slate-900 dark:text-slate-100 text-xl font-bold leading-relaxed">{answer.answer}</p>
                </div>
              </div>
            </Card>

            {answer.sources?.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <p className="text-xs font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Grounded Evidence Sources ({answer.sources.length})</p>
                  <div className="h-px flex-1 bg-surface-100" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {answer.sources.map((src, i) => (
                    <Card key={i} className="p-5 bg-card border-surface-200 hover:border-brand-500/30 transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] font-extrabold text-brand-600 dark:text-brand-400 uppercase tracking-widest bg-brand-500/10 px-2.5 py-1 rounded-full border border-brand-500/20">Verification {i + 1}</span>
                        <Link
                          href={`/documents/${src.documentId}`}
                          className="text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-brand-600 flex items-center gap-1.5 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> {src.documentName}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 font-bold leading-relaxed line-clamp-4 italic border-l-2 border-surface-200 pl-4">"{src.text}"</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty state (before search) */}
        {!hasSearched && !isLoading && (
          <div className="text-center py-10 space-y-8">
             <div className="flex items-center gap-4 max-w-sm mx-auto">
              <div className="h-px flex-1 bg-surface-100" />
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Discovery Prompts</p>
              <div className="h-px flex-1 bg-surface-100" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {[
                'What is the total revenue in Q4 2024?',
                'Summarize the key compliance findings',
                'Identify core liability clauses',
                'Find all specific payment deadlines',
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => { setQuery(example); }}
                  className="px-5 py-4 rounded-2xl bg-card border border-surface-200 text-sm font-bold text-slate-700 dark:text-slate-300 hover:text-brand-700 dark:hover:text-brand-400 hover:border-brand-500/30 hover:shadow-md hover:translate-y-[-2px] transition-all text-left shadow-sm flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-surface-100 dark:bg-slate-800 flex items-center justify-center shrink-0 group-hover:bg-brand-500/10 transition-colors">
                    <Sparkles className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-brand-600 dark:group-hover:text-brand-400" />
                  </div>
                  &ldquo;{example}&rdquo;
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
