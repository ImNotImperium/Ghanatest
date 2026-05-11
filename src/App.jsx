/**
 * App.jsx — AI Content Studio
 *
 * Full SPA that lets users:
 *   1. Configure an AI provider (Gemini or Hugging Face) and model
 *   2. Write a prompt and generate markdown-rendered content
 *   3. Copy, save to localStorage history, and download as .md
 *   4. Browse and restore previously saved creations from a side drawer
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Sparkles,
  ClipboardCopy,
  BookmarkPlus,
  Download,
  History,
  X,
  Trash2,
  ChevronRight,
  KeyRound,
  Loader2,
  CheckCheck,
  AlertCircle,
  Moon,
} from 'lucide-react';

import { generateContent, MODEL_PRESETS } from './api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const LS_KEY = 'ai_content_studio_history';

// ---------------------------------------------------------------------------
// Small reusable helpers
// ---------------------------------------------------------------------------

/** Read history array from localStorage */
function readHistory() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) ?? [];
  } catch {
    return [];
  }
}

/** Persist history array to localStorage */
function writeHistory(items) {
  localStorage.setItem(LS_KEY, JSON.stringify(items));
}

/** Trigger a client-side download of text as a .md file */
function downloadMarkdown(text, filename = 'ai-content.md') {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  // Clean up the object URL after the click
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Derive a short display title from the first ~60 chars of a prompt */
function shortTitle(prompt) {
  const clean = prompt.trim().replace(/\n+/g, ' ');
  return clean.length > 60 ? clean.slice(0, 57) + '…' : clean;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Floating notification banner (success / error) */
function Toast({ message, type, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  const colors =
    type === 'error'
      ? 'bg-red-900/80 border-red-500 text-red-200'
      : 'bg-emerald-900/80 border-emerald-500 text-emerald-200';

  const Icon = type === 'error' ? AlertCircle : CheckCheck;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border px-4 py-3 text-sm shadow-xl backdrop-blur ${colors}`}
    >
      <Icon size={16} />
      <span>{message}</span>
      <button onClick={onDismiss} className="ml-2 opacity-60 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

/** Single saved-creation card inside the history drawer */
function HistoryCard({ item, onRestore, onDelete }) {
  return (
    <div className="group flex flex-col gap-1 rounded-lg border border-gray-700 bg-gray-800/60 p-3 hover:border-indigo-500 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-200 line-clamp-2 flex-1">
          {item.title}
        </p>
        <button
          onClick={() => onDelete(item.id)}
          className="shrink-0 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          title="Delete"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <p className="text-xs text-gray-500">
        {new Date(item.savedAt).toLocaleString()}
      </p>
      <button
        onClick={() => onRestore(item)}
        className="mt-1 flex items-center gap-1 self-start rounded px-2 py-0.5 text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:bg-indigo-900/30 transition-colors"
      >
        Restore <ChevronRight size={12} />
      </button>
    </div>
  );
}

/** Slide-in history drawer */
function HistoryDrawer({ open, onClose, history, onRestore, onDelete, onClearAll }) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={`fixed right-0 top-0 z-40 flex h-full w-80 flex-col border-l border-gray-700 bg-gray-900 shadow-2xl transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
            <History size={16} className="text-indigo-400" />
            Saved Creations
            <span className="rounded-full bg-indigo-600/30 px-2 py-0.5 text-xs text-indigo-300">
              {history.length}
            </span>
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {history.length === 0 ? (
            <p className="mt-8 text-center text-sm text-gray-500">
              No saved creations yet.
            </p>
          ) : (
            history.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onRestore={onRestore}
                onDelete={onDelete}
              />
            ))
          )}
        </div>

        {/* Clear-all footer */}
        {history.length > 0 && (
          <div className="border-t border-gray-700 p-3">
            <button
              onClick={onClearAll}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/50 py-2 text-xs text-red-400 hover:bg-red-900/20 hover:border-red-600 transition-colors"
            >
              <Trash2 size={13} />
              Clear All History
            </button>
          </div>
        )}
      </aside>
    </>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  // ----- Provider / model config -----
  const [provider, setProvider] = useState('gemini'); // 'gemini' | 'hf'
  const [apiKey, setApiKey]     = useState('');
  const [model, setModel]       = useState(MODEL_PRESETS.gemini[0].id);
  const [showKey, setShowKey]   = useState(false);

  // When provider changes, reset model to the first preset for that provider
  useEffect(() => {
    setModel(MODEL_PRESETS[provider][0].id);
  }, [provider]);

  // ----- Prompt & output -----
  const [prompt, setPrompt]   = useState('');
  const [output, setOutput]   = useState('');
  const [loading, setLoading] = useState(false);

  // ----- History drawer -----
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [history, setHistory]       = useState(readHistory);

  // ----- Toast notifications -----
  const [toast, setToast] = useState({ message: '', type: 'success' });
  const notify = useCallback((message, type = 'success') => {
    setToast({ message, type });
  }, []);

  // ---------------------------------------------------------------------------
  // Generate
  // ---------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      notify('Please enter a prompt first.', 'error');
      return;
    }
    setLoading(true);
    setOutput('');
    try {
      const text = await generateContent({ provider, apiKey, model, prompt });
      setOutput(text);
    } catch (err) {
      notify(err.message ?? 'Generation failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Copy to clipboard
  // ---------------------------------------------------------------------------
  const handleCopy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      notify('Copied to clipboard!');
    } catch {
      notify('Clipboard access denied.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Save to history (localStorage)
  // ---------------------------------------------------------------------------
  const handleSave = () => {
    if (!output) return;
    const newItem = {
      id:      crypto.randomUUID(),
      title:   shortTitle(prompt),
      prompt,
      output,
      model,
      provider,
      savedAt: Date.now(),
    };
    const updated = [newItem, ...history];
    setHistory(updated);
    writeHistory(updated);
    notify('Saved to history!');
  };

  // ---------------------------------------------------------------------------
  // Download as .md
  // ---------------------------------------------------------------------------
  const handleDownload = () => {
    if (!output) return;
    const filename = shortTitle(prompt).replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.md';
    downloadMarkdown(output, filename);
    notify('Download started!');
  };

  // ---------------------------------------------------------------------------
  // Restore from history
  // ---------------------------------------------------------------------------
  const handleRestore = (item) => {
    setPrompt(item.prompt);
    setOutput(item.output);
    setProvider(item.provider);
    setModel(item.model);
    setDrawerOpen(false);
    notify('Restored from history.');
  };

  // ---------------------------------------------------------------------------
  // Delete one history item
  // ---------------------------------------------------------------------------
  const handleDelete = (id) => {
    const updated = history.filter((h) => h.id !== id);
    setHistory(updated);
    writeHistory(updated);
  };

  // ---------------------------------------------------------------------------
  // Clear all history
  // ---------------------------------------------------------------------------
  const handleClearAll = () => {
    setHistory([]);
    writeHistory([]);
    notify('History cleared.');
  };

  // ---------------------------------------------------------------------------
  // Keyboard shortcut: Ctrl/Cmd + Enter → Generate
  // ---------------------------------------------------------------------------
  const promptRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        handleGenerate();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, provider, apiKey, model]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="flex min-h-screen flex-col bg-gray-950 text-gray-100">

      {/* ===== HEADER ===== */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-800 bg-gray-950/80 px-5 py-3 backdrop-blur">
        {/* Logo + title */}
        <div className="flex items-center gap-2">
          <Sparkles size={22} className="text-indigo-400" />
          <span className="text-lg font-bold tracking-tight text-gray-100">
            AI Content Studio
          </span>
          <Moon size={14} className="ml-1 text-gray-500" />
        </div>

        {/* History drawer trigger */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm font-medium text-gray-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
        >
          <History size={15} />
          Saved Creations
          {history.length > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-xs text-white">
              {history.length}
            </span>
          )}
        </button>
      </header>

      {/* ===== MAIN SPLIT-PANE LAYOUT ===== */}
      <main className="flex flex-1 flex-col lg:flex-row gap-0">

        {/* ── LEFT PANE: Config + Prompt ── */}
        <section className="flex w-full flex-col gap-4 border-b lg:border-b-0 lg:border-r border-gray-800 bg-gray-950 p-5 lg:w-[42%] xl:w-[38%]">

          {/* Provider selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              AI Provider
            </label>
            <div className="flex gap-2">
              {[
                { value: 'gemini', label: 'Google Gemini' },
                { value: 'hf',    label: 'Hugging Face' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setProvider(value)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-medium transition-colors ${
                    provider === value
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300'
                      : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-500'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key input */}
          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
              <KeyRound size={12} />
              {provider === 'gemini' ? 'Gemini API Key' : 'HF Access Token'}
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  provider === 'gemini'
                    ? 'AIza…  (aistudio.google.com/app/apikey)'
                    : 'hf_…   (huggingface.co/settings/tokens)'
                }
                className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 pr-16 text-sm text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition"
              />
              <button
                onClick={() => setShowKey((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showKey ? 'Hide' : 'Show'}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-gray-600">
              Your key is never stored — it stays only in memory for this session.
            </p>
          </div>

          {/* Model selector */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-100 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition"
            >
              {MODEL_PRESETS[provider].map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt textarea */}
          <div className="flex flex-1 flex-col">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-gray-400">
              Prompt
            </label>
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe what you want to generate…&#10;&#10;e.g. Write a detailed blog post about the future of renewable energy in Africa."
              className="flex-1 resize-none rounded-lg border border-gray-700 bg-gray-800/80 p-3 text-sm leading-relaxed text-gray-100 placeholder-gray-600 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/40 transition min-h-[220px]"
            />
            <p className="mt-1 text-right text-[11px] text-gray-600">
              {prompt.length} chars · Ctrl+Enter to generate
            </p>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-900/40 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles size={16} />
                Generate
              </>
            )}
          </button>
        </section>

        {/* ── RIGHT PANE: Rendered Output ── */}
        <section className="flex w-full flex-col bg-gray-900 lg:flex-1">

          {/* Action toolbar — only shown once content exists */}
          {output && (
            <div className="flex items-center gap-2 border-b border-gray-800 px-4 py-2.5">
              <span className="mr-auto text-xs font-semibold uppercase tracking-wider text-gray-500">
                Output
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 hover:border-indigo-500 hover:text-indigo-300 transition-colors"
                title="Copy to clipboard"
              >
                <ClipboardCopy size={13} />
                Copy
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 hover:border-emerald-500 hover:text-emerald-300 transition-colors"
                title="Save to history"
              >
                <BookmarkPlus size={13} />
                Save
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 hover:border-sky-500 hover:text-sky-300 transition-colors"
                title="Download as .md"
              >
                <Download size={13} />
                Download .md
              </button>
            </div>
          )}

          {/* Markdown render area */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-gray-500">
                <Loader2 size={32} className="animate-spin text-indigo-400" />
                <p className="text-sm">Generating your content…</p>
              </div>
            )}

            {!loading && !output && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-gray-600">
                <Sparkles size={40} className="opacity-20" />
                <p className="text-sm">Your generated content will appear here.</p>
              </div>
            )}

            {!loading && output && (
              /* prose styles give markdown headings/lists/code a clean look */
              <article className="prose prose-invert prose-sm max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-a:text-indigo-400 prose-code:rounded prose-code:bg-gray-800 prose-code:px-1 prose-pre:bg-gray-800">
                <ReactMarkdown>{output}</ReactMarkdown>
              </article>
            )}
          </div>
        </section>
      </main>

      {/* ===== HISTORY DRAWER ===== */}
      <HistoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        history={history}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onClearAll={handleClearAll}
      />

      {/* ===== TOAST ===== */}
      <Toast
        message={toast.message}
        type={toast.type}
        onDismiss={() => setToast((t) => ({ ...t, message: '' }))}
      />
    </div>
  );
}
