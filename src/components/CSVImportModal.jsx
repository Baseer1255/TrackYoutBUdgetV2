import React, { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { parseCSV, detectColumnMapping, formatTransactionsForDb } from '../lib/csv';
import {
  X, Upload, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, ArrowLeft, ChevronDown, TrendingDown, TrendingUp, Table2
} from 'lucide-react';

const STEPS = ['upload', 'preview', 'result'];
const STEP_LABELS = ['Upload File', 'Preview & Map', 'Done'];

export default function CSVImportModal({ isOpen, onClose, projectId, onImportComplete }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // Wizard state
  const [step, setStep] = useState('upload');
  const [dragOver, setDragOver] = useState(false);

  // Parsed data
  const [fileName, setFileName] = useState('');
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [previewRows, setPreviewRows] = useState([]);

  // Import
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState('');

  const resetState = () => {
    setStep('upload');
    setDragOver(false);
    setFileName('');
    setRawData([]);
    setHeaders([]);
    setMapping({});
    setPreviewRows([]);
    setImporting(false);
    setImportResult(null);
    setError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ─── File Handling ───────────────────────────────────────────────────────
  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setError('Please upload a .csv file');
      return;
    }

    setError('');
    setFileName(file.name);

    try {
      const result = await parseCSV(file);
      setRawData(result.data);
      setHeaders(result.headers);
      setMapping(result.detectedMapping);

      // Generate preview (first 10 rows, formatted)
      const formatted = formatTransactionsForDb(
        result.data.slice(0, 10), projectId, user.id, result.detectedMapping
      );
      setPreviewRows(formatted);
      setStep('preview');
    } catch (err) {
      setError('Failed to parse CSV: ' + err.message);
    }
  }, [projectId, user?.id]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    processFile(file);
  }, [processFile]);

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    processFile(file);
  };

  // ─── Column Mapping ─────────────────────────────────────────────────────
  const updateMapping = (field, value) => {
    const newMapping = { ...mapping, [field]: value || null };
    setMapping(newMapping);

    // Regenerate preview
    const formatted = formatTransactionsForDb(
      rawData.slice(0, 10), projectId, user.id, newMapping
    );
    setPreviewRows(formatted);
  };

  // ─── Import ──────────────────────────────────────────────────────────────
  const handleImport = async () => {
    setImporting(true);
    setError('');

    try {
      const allFormatted = formatTransactionsForDb(rawData, projectId, user.id, mapping);

      if (allFormatted.length === 0) {
        setError('No valid transactions found in the file. Check your column mapping.');
        setImporting(false);
        return;
      }

      // Insert in batches of 100
      const BATCH_SIZE = 100;
      let inserted = 0;
      for (let i = 0; i < allFormatted.length; i += BATCH_SIZE) {
        const batch = allFormatted.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase.from('transactions').insert(batch);
        if (insertError) throw insertError;
        inserted += batch.length;
      }

      const expenses = allFormatted.filter(t => t.amount >= 0).length;
      const income = allFormatted.filter(t => t.amount < 0).length;

      setImportResult({ total: inserted, expenses, income });
      setStep('result');
      if (onImportComplete) onImportComplete();
    } catch (err) {
      setError('Import failed: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  // ─── Canonical field labels for mapping UI ───────────────────────────────
  const MAPPING_FIELDS = [
    { key: 'date', label: 'Date', icon: '📅', required: false },
    { key: 'description', label: 'Description', icon: '📝', required: true },
    { key: 'withdrawal', label: 'Withdrawal / Debit', icon: '💸', required: false },
    { key: 'deposit', label: 'Deposit / Credit', icon: '💰', required: false },
    { key: 'amount', label: 'Amount (single column)', icon: '🔢', required: false },
    { key: 'category', label: 'Category', icon: '🏷️', required: false },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
           style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Import Bank Statement</h2>
              <p className="text-xs text-muted-foreground">CSV format • Supports all Indian & international banks</p>
            </div>
          </div>
          <button onClick={handleClose} className="rounded-full p-2 hover:bg-secondary text-muted-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-1 px-6 py-3 border-b border-border/50 bg-secondary/20">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                step === s
                  ? 'bg-primary text-primary-foreground'
                  : STEPS.indexOf(step) > i
                    ? 'bg-primary/20 text-primary'
                    : 'bg-secondary text-muted-foreground'
              }`}>
                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px] font-bold">
                  {STEPS.indexOf(step) > i ? '✓' : i + 1}
                </span>
                {STEP_LABELS[i]}
              </div>
              {i < STEPS.length - 1 && (
                <ArrowRight className="w-3 h-3 text-muted-foreground/50 mx-1" />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-destructive font-bold">✕</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ minHeight: 0 }}>

          {/* ─── STEP 1: Upload ─────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
              {/* Drop Zone */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all duration-200 ${
                  dragOver
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-secondary/30'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-4 rounded-2xl transition-colors ${
                    dragOver ? 'bg-primary/20' : 'bg-secondary'
                  }`}>
                    <Upload className={`w-8 h-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dragOver ? 'Drop your file here' : 'Drag & drop your bank statement'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or <span className="text-primary font-medium underline underline-offset-2">browse files</span> • CSV format
                    </p>
                  </div>
                </div>
              </div>

              {/* Supported Banks Info */}
              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  ✨ Smart Detection
                </h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Our importer automatically detects column headers from bank statements. 
                  It supports common formats including <strong>Withdrawal/Deposit</strong> split columns, 
                  <strong> Narration</strong>-style descriptions, and <strong>DD/MM/YYYY</strong> date formats. 
                  Works with HDFC, SBI, ICICI, Axis, Kotak, and most other banks worldwide.
                </p>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Preview & Map ─────────────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-5">
              {/* File Info */}
              <div className="flex items-center gap-3 bg-secondary/30 rounded-lg p-3 border border-border/50">
                <FileSpreadsheet className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
                  <p className="text-xs text-muted-foreground">{rawData.length} rows detected • {headers.length} columns</p>
                </div>
                <button
                  onClick={() => { resetState(); }}
                  className="text-xs text-primary hover:underline underline-offset-2 font-medium"
                >
                  Change file
                </button>
              </div>

              {/* Column Mapping */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Table2 className="w-4 h-4 text-primary" />
                  Column Mapping
                  <span className="text-xs font-normal text-muted-foreground ml-1">(auto-detected — adjust if needed)</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {MAPPING_FIELDS.map(({ key, label, icon }) => (
                    <div key={key} className="flex items-center gap-2 bg-secondary/20 rounded-lg px-3 py-2 border border-border/30">
                      <span className="text-sm">{icon}</span>
                      <span className="text-xs font-medium text-foreground w-28 shrink-0">{label}</span>
                      <div className="relative flex-1">
                        <select
                          value={mapping[key] || ''}
                          onChange={(e) => updateMapping(key, e.target.value)}
                          className="w-full appearance-none bg-card border border-border rounded-md px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary pr-6"
                        >
                          <option value="">— Not mapped —</option>
                          {headers.map(h => (
                            <option key={h} value={h}>{h}</option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preview Table */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-primary" />
                  Transaction Preview
                  <span className="text-xs font-normal text-muted-foreground ml-1">
                    (showing {previewRows.length} of {rawData.length} rows)
                  </span>
                </h3>

                {previewRows.length === 0 ? (
                  <div className="bg-secondary/20 border border-border/50 rounded-xl p-6 text-center">
                    <AlertCircle className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      No valid transactions found. Try adjusting the column mapping above.
                    </p>
                  </div>
                ) : (
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-secondary/50">
                            <th className="text-left px-3 py-2 font-semibold text-foreground">Date</th>
                            <th className="text-left px-3 py-2 font-semibold text-foreground">Description</th>
                            <th className="text-right px-3 py-2 font-semibold text-foreground">Amount</th>
                            <th className="text-center px-3 py-2 font-semibold text-foreground">Type</th>
                            <th className="text-left px-3 py-2 font-semibold text-foreground">Category</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {previewRows.map((row, idx) => {
                            const isIncome = row.amount < 0;
                            return (
                              <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                  {new Date(row.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                </td>
                                <td className="px-3 py-2 text-foreground max-w-[200px] truncate" title={row.name}>
                                  {row.name}
                                </td>
                                <td className={`px-3 py-2 text-right font-medium whitespace-nowrap ${isIncome ? 'text-green-500' : 'text-foreground'}`}>
                                  {isIncome ? '+' : ''}₹{Math.abs(row.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isIncome
                                      ? 'bg-green-500/10 text-green-600'
                                      : 'bg-red-500/10 text-red-500'
                                  }`}>
                                    {isIncome ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                    {isIncome ? 'Income' : 'Expense'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-muted-foreground">{row.category}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── STEP 3: Result ─────────────────────────────────────── */}
          {step === 'result' && importResult && (
            <div className="flex flex-col items-center text-center py-6 space-y-4">
              <div className="p-4 bg-green-500/10 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-green-500" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Import Complete!</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Successfully imported {importResult.total} transactions from your bank statement.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full max-w-xs mt-2">
                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
                  <TrendingDown className="w-5 h-5 text-red-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{importResult.expenses}</p>
                  <p className="text-xs text-muted-foreground">Expenses</p>
                </div>
                <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
                  <TrendingUp className="w-5 h-5 text-green-500 mx-auto mb-1" />
                  <p className="text-xl font-bold text-foreground">{importResult.income}</p>
                  <p className="text-xs text-muted-foreground">Income</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/80">
          {step === 'preview' ? (
            <>
              <button
                onClick={() => { resetState(); }}
                className="vibrant-button-ghost text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {previewRows.length > 0
                    ? `${rawData.length} transactions ready`
                    : 'Map columns to continue'}
                </span>
                <button
                  onClick={handleImport}
                  disabled={importing || previewRows.length === 0}
                  className="vibrant-button-primary text-sm disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-1" />
                      Import All
                    </>
                  )}
                </button>
              </div>
            </>
          ) : step === 'result' ? (
            <>
              <div />
              <button onClick={handleClose} className="vibrant-button-primary text-sm">
                Done
              </button>
            </>
          ) : (
            <>
              <div />
              <button onClick={handleClose} className="vibrant-button-ghost text-sm">
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
