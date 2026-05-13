'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

const isSpreadsheetName = (filename: string) => {
  const f = filename.toLowerCase();
  return f.endsWith('.xlsx') || f.endsWith('.xls') || f.endsWith('.csv');
};

export default function OriginalFileViewerPage() {
  const { filename } = useParams<{ filename: string }>();
  const decoded = useMemo(() => decodeURIComponent(filename || ''), [filename]);
  const fileUrl = useMemo(() => `/uploads/${encodeURIComponent(decoded)}`, [decoded]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetName, setSheetName] = useState<string>('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const hasAutoLoadedRef = useRef(false);

  const load = async () => {
    if (!decoded) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(fileUrl);
      if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);
      const isCsv = decoded.toLowerCase().endsWith('.csv');
      const wb = isCsv
        ? XLSX.read(await res.text(), { type: 'string' })
        : XLSX.read(await res.arrayBuffer(), { type: 'array' });
      setWorkbook(wb);
      setSheetName(wb.SheetNames[0] || '');
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du chargement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    hasAutoLoadedRef.current = false;
    setWorkbook(null);
    setSheetName('');
    setHeaders([]);
    setRows([]);
  }, [decoded]);

  useEffect(() => {
    if (!decoded) return;
    if (hasAutoLoadedRef.current) return;
    hasAutoLoadedRef.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decoded, fileUrl]);

  useEffect(() => {
    if (!workbook || !sheetName) return;
    const ws = workbook.Sheets[sheetName];
    if (!ws) return;

    const matrix = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, blankrows: false }) as any[][];
    const hdr = (matrix[0] || []).map((h: any, i: number) => String(h ?? `Col ${i + 1}`).trim() || `Col ${i + 1}`);
    const dataRows = matrix
      .slice(1)
      .filter((r) => Array.isArray(r) && r.some((v) => v !== null && v !== undefined && String(v).trim() !== ''));

    const objects = dataRows.map((r) => {
      const obj: Record<string, any> = {};
      hdr.forEach((key, idx) => {
        obj[key] = r?.[idx];
      });
      return obj;
    });

    setHeaders(hdr);
    setRows(objects);
  }, [workbook, sheetName]);

  // If it's not a spreadsheet, just navigate to the raw file (new tab already)
  useEffect(() => {
    if (!decoded) return;
    if (isSpreadsheetName(decoded)) return;
    window.location.replace(fileUrl);
  }, [decoded, fileUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-6 py-6 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-white/50">Document original</p>
            <h1 className="mt-2 text-lg font-extrabold tracking-tight text-white break-all">{decoded}</h1>
          </div>
          <div className="flex items-center gap-2">
            {workbook?.SheetNames?.length ? (
              <select
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                className="h-10 max-w-[260px] appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black uppercase tracking-wider text-white/80 outline-none"
              >
                {workbook.SheetNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              className="border-white/10 bg-white/10 text-white hover:bg-white/20"
              onClick={load}
              isLoading={isLoading}
              disabled={isLoading}
            >
              <RefreshCw className="w-4 h-4" />
              Recharger
            </Button>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-white/60 hover:text-white underline underline-offset-2"
            >
              Télécharger
            </a>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-200">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        {isLoading && !rows.length && (
          <div className="mt-6 flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-6 py-10">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            <p className="text-sm font-bold text-white/70">Chargement…</p>
          </div>
        )}

        {!!rows.length && (
          <div className="mt-6 rounded-2xl border border-white/10 bg-slate-950 overflow-hidden">
            <div className="max-h-[78vh] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-950/95 backdrop-blur border-b border-white/10">
                  <tr>
                    {headers.map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-white/60 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, idx) => (
                    <tr key={idx} className={`border-b border-white/5 hover:bg-white/5 ${idx % 2 === 0 ? 'bg-white/[0.02]' : ''}`}>
                      {headers.map((h) => (
                        <td key={h} className="px-5 py-3 text-white/85 align-top">
                          {r[h] === null || r[h] === undefined || r[h] === '' ? (
                            <span className="text-white/30">—</span>
                          ) : (
                            <span className="whitespace-pre-wrap break-words">{String(r[h])}</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-white/10 text-[11px] font-black uppercase tracking-widest text-white/40">
              Lignes: {rows.length.toLocaleString()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

