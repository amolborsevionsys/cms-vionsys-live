'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Copy, FileText, Loader2, Plus, Send, Trash2, Upload } from 'lucide-react';
import { ConfirmDialog } from '../shared/ConfirmDialog';

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

const MAX_BYTES = 4 * 1024 * 1024;
const ACCEPT = '.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document';


interface Source {
  id: string;
  fileName: string;
  size: number;
  chunkCount: number;
  createdAt: string;
}

/** What the import endpoint returns; the extraction shape depends on the content type. */
export interface ImportResultPayload<TExtraction = unknown> {
  extraction: TExtraction;
  source: { id: string; fileName: string; chunkCount: number };
  warnings: string[];
}

interface AskResult {
  answer: string;
  citations: { n: number; sourceName: string; excerpt: string }[];
}

export interface AiPanelProps {
  /** e.g. "/api/cms/blogs/<id>". Undefined while the item has not been saved yet. */
  apiBase?: string;
  /** "case study" / "blog post", used in messages. */
  noun: string;
  quickPrompts: string[];
  insertLabel: string;
  onImported: (result: ImportResultPayload) => void;
  onInsertAnswer: (answer: string) => void;
}

async function readJson(res: Response) {
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) throw new Error(body?.error?.message || `Request failed (${res.status}).`);
  return body.data;
}

export function AiPanel({ apiBase, ...props }: AiPanelProps) {
  if (!apiBase) {
    return (
      <div className="space-y-3">
        <FreeTierNotice />
        <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
          Add a title and click <span className="text-slate-900">Save Draft</span> first. Documents are attached to a saved {props.noun}.
        </p>
      </div>
    );
  }
  return <AiPanelBody apiBase={apiBase} {...props} />;
}

function FreeTierNotice() {
  return (
    <p className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-snug text-amber-900">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      With a free-tier Gemini key (AI Studio), Google may use uploaded content to improve its products. Don&apos;t upload confidential client documents unless the CMS uses a paid key.
    </p>
  );
}

function AiPanelBody({
  apiBase,
  quickPrompts,
  insertLabel,
  onImported,
  onInsertAnswer,
}: Required<Pick<AiPanelProps, 'apiBase'>> & Omit<AiPanelProps, 'apiBase'>) {
  const [sources, setSources] = useState<Source[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOver, setIsOver] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Source | null>(null);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadSources = useCallback(async () => {
    try {
      setSources(await readJson(await fetch(`${apiBase}/sources`)));
    } catch {
      /* the list is non-critical; upload errors are shown separately */
    }
  }, [apiBase]);

  // Load the document list on mount; state is set in the promise callback, not synchronously.
  useEffect(() => {
    let alive = true;
    fetch(`${apiBase}/sources`)
      .then(readJson)
      .then((data: Source[]) => {
        if (alive) setSources(data);
      })
      .catch(() => {
        /* non-critical */
      });
    return () => {
      alive = false;
    };
  }, [apiBase]);

  const upload = async (file: File) => {
    setError(null);
    if (!/\.(pdf|docx)$/i.test(file.name)) return setError('Choose a PDF or Word (.docx) file.');
    if (file.size > MAX_BYTES) return setError('The file is larger than 4 MB. Compress it or split it into smaller files.');

    setUploading(file.name);
    try {
      const form = new FormData();
      form.append('file', file);
      const result = (await readJson(
        await fetch(`${apiBase}/import`, { method: 'POST', body: form })
      )) as ImportResultPayload;
      onImported(result);
      void loadSources();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed.');
    } finally {
      setUploading(null);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  const ask = async (q: string) => {
    const text = q.trim();
    if (text.length < 3 || asking) return;
    setAsking(true);
    setError(null);
    setAnswer(null);
    try {
      setAnswer(
        await readJson(
          await fetch(`${apiBase}/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question: text }),
          })
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The question could not be answered.');
    } finally {
      setAsking(false);
    }
  };

  const removeSource = async () => {
    if (!pendingDelete) return;
    try {
      await readJson(await fetch(`${apiBase}/sources/${pendingDelete.id}`, { method: 'DELETE' }));
      setSources((prev) => prev.filter((s) => s.id !== pendingDelete.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The document could not be removed.');
    } finally {
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-5">
      <FreeTierNotice />

      {error && (
        <p role="alert" className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* Import */}
      <section aria-labelledby="ai-import-title" className="space-y-2">
        <h3 id="ai-import-title" className="text-xs text-slate-900">Import from a document</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsOver(true);
          }}
          onDragLeave={() => setIsOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void upload(file);
          }}
          className={`rounded-lg border-2 border-dashed px-3 py-5 text-center transition-colors ${
            isOver ? 'border-brand-400 bg-brand-50' : 'border-slate-300 bg-white'
          }`}
        >
          {uploading ? (
            <div role="status" className="flex flex-col items-center gap-2 text-xs text-slate-600">
              <Loader2 className="h-5 w-5 animate-spin text-brand-600" aria-hidden />
              <span>
                Reading <span className="text-slate-900">{uploading}</span>…
                <br />
                This can take up to a minute.
              </span>
            </div>
          ) : (
            <>
              <Upload className="mx-auto h-5 w-5 text-slate-400" aria-hidden />
              <p className="mt-1.5 text-xs text-slate-600">Drop a PDF or Word file here</p>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className={`mt-2 inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-brand-600 px-3 py-1.5 text-xs text-white hover:bg-brand-700 ${focusRing}`}
              >
                Choose file
              </button>
              <p className="mt-2 text-[11px] text-slate-400">PDF or .docx, up to 4 MB</p>
            </>
          )}
          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="sr-only"
            aria-label="Choose a document to import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
            }}
          />
        </div>
      </section>

      {/* Sources */}
      <section aria-labelledby="ai-sources-title" className="space-y-2">
        <h3 id="ai-sources-title" className="text-xs text-slate-900">
          Documents ({sources.length})
        </h3>
        {sources.length === 0 ? (
          <p className="text-[12px] text-slate-500">No documents yet. Ask AI answers only from documents uploaded here.</p>
        ) : (
          <ul className="space-y-1.5">
            {sources.map((s) => (
              <li key={s.id} className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
                <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs text-slate-800">{s.fileName}</span>
                  <span className="block text-[11px] text-slate-400">
                    {s.chunkCount > 0 ? `${s.chunkCount} searchable passages` : 'Not searchable'}
                  </span>
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${s.fileName}`}
                  onClick={() => setPendingDelete(s)}
                  className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-700 ${focusRing}`}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Ask AI */}
      <section aria-labelledby="ai-ask-title" className="space-y-2">
        <h3 id="ai-ask-title" className="text-xs text-slate-900">Ask AI about these documents</h3>
        <div className="flex flex-wrap gap-1.5">
          {quickPrompts.map((p) => (
            <button
              key={p}
              type="button"
              disabled={asking || sources.length === 0}
              onClick={() => {
                setQuestion(p);
                void ask(p);
              }}
              className={`cursor-pointer rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[12px] text-slate-700 hover:border-brand-300 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
            >
              {p}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void ask(question);
          }}
          className="flex gap-1.5"
        >
          <label htmlFor="ai-question" className="sr-only">
            Question
          </label>
          <textarea
            id="ai-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void ask(question);
              }
            }}
            placeholder={sources.length ? 'e.g. What did the client say about speed?' : 'Upload a document first'}
            disabled={sources.length === 0}
            className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 disabled:bg-slate-50"
          />
          <button
            type="submit"
            aria-label="Ask"
            disabled={asking || question.trim().length < 3 || sources.length === 0}
            className={`inline-flex w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-brand-600 text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 ${focusRing}`}
          >
            {asking ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
          </button>
        </form>

        {answer && (
          <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-2.5" aria-live="polite">
            <p className="text-xs leading-relaxed whitespace-pre-wrap text-slate-800">{answer.answer}</p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => onInsertAnswer(answer.answer)}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-md bg-brand-600 px-2 py-1 text-[12px] text-white hover:bg-brand-700 ${focusRing}`}
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                {insertLabel}
              </button>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(answer.answer);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700 hover:bg-slate-50 ${focusRing}`}
              >
                <Copy className="h-3.5 w-3.5" aria-hidden />
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            {answer.citations.length > 0 && (
              <details className="text-[12px]">
                <summary className="cursor-pointer text-slate-500">Sources ({answer.citations.length})</summary>
                <ol className="mt-1.5 space-y-1.5">
                  {answer.citations.map((c) => (
                    <li key={c.n} className="rounded-md bg-slate-50 px-2 py-1.5 text-slate-600">
                      <span className="text-slate-900">[{c.n}] {c.sourceName}</span>
                      <span className="mt-0.5 block">{c.excerpt}</span>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        )}
      </section>

      <ConfirmDialog
        isOpen={pendingDelete !== null}
        title="Remove this document?"
        message="Ask AI will no longer use it. Content you already imported stays."
        confirmLabel="Remove"
        isDanger
        onConfirm={removeSource}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
