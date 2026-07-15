import React, { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import Papa from 'papaparse';
import {
  X, Upload, FileImage, Loader2, CheckCircle2, AlertCircle,
  ArrowRight, Download, FileSpreadsheet, ScanLine
} from 'lucide-react';

/**
 * Attempts to parse OCR text from a bank statement into structured rows.
 * Looks for lines that contain a date pattern and a number (amount).
 */
function parseStatementText(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const rows = [];

  // Date patterns: DD/MM/YYYY, DD-MM-YYYY, DD/MM/YY, DD MMM YYYY, etc.
  const dateRegex = /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\w*\s+\d{2,4})/i;
  // Amount pattern: numbers with optional commas and decimals, optional currency symbol
  const amountRegex = /([\$€£₹]?\s*\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?)/g;

  for (const line of lines) {
    const dateMatch = line.match(dateRegex);
    if (!dateMatch) continue;

    const date = dateMatch[1];

    // Extract all amounts from the line
    const amounts = [];
    let m;
    const amountRegexLocal = /([\$€£₹]?\s*\d{1,3}(?:[,\s]\d{2,3})*(?:\.\d{1,2})?)/g;
    while ((m = amountRegexLocal.exec(line)) !== null) {
      const val = m[1].replace(/[^\d.,]/g, '').replace(/,/g, '');
      const num = parseFloat(val);
      if (num > 0 && !dateMatch[0].includes(m[1])) {
        amounts.push(m[1].trim());
      }
    }

    if (amounts.length === 0) continue;

    // Description: text between date and first amount, cleaned up
    const dateEnd = line.indexOf(dateMatch[0]) + dateMatch[0].length;
    let description = line.substring(dateEnd).trim();
    
    // Remove amounts from description
    for (const amt of amounts) {
      description = description.replace(amt, '').trim();
    }
    // Clean up extra spaces and special chars
    description = description.replace(/\s{2,}/g, ' ').replace(/^[\-\/\|]+|[\-\/\|]+$/g, '').trim();
    if (!description) description = 'Transaction';

    // If 2+ amounts: first might be withdrawal, second deposit (or vice versa)
    // If 1 amount: single amount column
    if (amounts.length >= 2) {
      rows.push({
        Date: date,
        Description: description,
        Withdrawal: amounts[0],
        Deposit: amounts[1],
        Balance: amounts[2] || '',
      });
    } else {
      rows.push({
        Date: date,
        Description: description,
        Amount: amounts[0],
      });
    }
  }

  return rows;
}

const STEPS = ['upload', 'scanning', 'preview'];
const STEP_LABELS = ['Upload Statement', 'Scanning', 'Download CSV'];

export default function StatementToCSVModal({ isOpen, onClose }) {
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload');
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [error, setError] = useState('');
  const [csvBlob, setCsvBlob] = useState(null);

  const resetState = () => {
    setStep('upload');
    setDragOver(false);
    setFileName('');
    setProgress(0);
    setProgressMsg('');
    setParsedRows([]);
    setError('');
    setCsvBlob(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // ─── Image Processing ──────────────────────────────────────────────────
  const processImage = useCallback(async (file) => {
    if (!file) return;

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp', 'image/tiff'];
    if (!validTypes.includes(file.type)) {
      setError('Unsupported format. Please upload PNG, JPEG, WebP, BMP, or TIFF.');
      return;
    }

    setError('');
    setFileName(file.name);
    setStep('scanning');
    setProgress(0);

    try {
      // Resize image for faster OCR
      const resized = await resizeImage(file);

      const result = await Tesseract.recognize(resized, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round((m.progress || 0) * 100));
            setProgressMsg('Reading text from image...');
          } else if (m.status === 'loading tesseract core') {
            setProgressMsg('Loading OCR engine...');
          } else if (m.status === 'initializing tesseract') {
            setProgressMsg('Initializing...');
          } else if (m.status === 'loading language traineddata') {
            setProgressMsg('Loading language data...');
          }
        },
      });

      const text = result.data.text;
      const rows = parseStatementText(text);

      if (rows.length === 0) {
        setError('Could not detect any transactions. Make sure the image is clear and contains a bank statement table.');
        setStep('upload');
        return;
      }

      setParsedRows(rows);

      // Generate CSV
      const csv = Papa.unparse(rows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      setCsvBlob(blob);

      setStep('preview');
    } catch (err) {
      console.error('OCR failed:', err);
      setError('Failed to scan the image. Please try a clearer photo.');
      setStep('upload');
    }
  }, []);

  const resizeImage = (file) => new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 2000;
      let { width, height } = img;
      if (Math.max(width, height) > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(url);
        if (!blob) return reject(new Error('Canvas conversion failed'));
        resolve(URL.createObjectURL(blob));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    processImage(e.dataTransfer?.files?.[0]);
  }, [processImage]);

  const handleDownloadCSV = () => {
    if (!csvBlob) return;
    const url = URL.createObjectURL(csvBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.replace(/\.[^.]+$/, '') + '_converted.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-card shadow-2xl border border-border overflow-hidden"
           style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-xl">
              <ScanLine className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Convert Statement to CSV</h2>
              <p className="text-xs text-muted-foreground">Upload a bank statement image → get a CSV file</p>
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

        {/* Error */}
        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 bg-destructive/10 border border-destructive/20 text-destructive p-3 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => setError('')} className="ml-auto text-destructive font-bold">✕</button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5" style={{ minHeight: 0 }}>

          {/* ─── STEP 1: Upload ─────────────────────────────────── */}
          {step === 'upload' && (
            <div className="space-y-4">
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
                  accept="image/png, image/jpeg, image/jpg, image/webp, image/bmp, image/tiff"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => processImage(e.target.files?.[0])}
                />
                <div className="flex flex-col items-center gap-3">
                  <div className={`p-4 rounded-2xl transition-colors ${dragOver ? 'bg-primary/20' : 'bg-secondary'}`}>
                    <FileImage className={`w-8 h-8 ${dragOver ? 'text-primary' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      {dragOver ? 'Drop your statement here' : 'Upload your bank statement image'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or <span className="text-primary font-medium underline underline-offset-2">browse files</span> • PNG, JPEG, WebP, BMP, TIFF
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
                  💡 How it works
                </h4>
                <ol className="text-xs text-muted-foreground leading-relaxed space-y-1 list-decimal list-inside">
                  <li>Take a photo or screenshot of your bank statement</li>
                  <li>Upload the image here — we'll scan it with OCR</li>
                  <li>Download the converted CSV file</li>
                  <li>Use <strong>Import CSV</strong> to bring transactions into your project</li>
                </ol>
              </div>
            </div>
          )}

          {/* ─── STEP 2: Scanning ──────────────────────────────── */}
          {step === 'scanning' && (
            <div className="flex flex-col items-center text-center py-10 space-y-5">
              <div className="relative">
                <div className="p-5 bg-primary/10 rounded-full">
                  <ScanLine className="w-10 h-10 text-primary animate-pulse" />
                </div>
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Scanning your statement...</h3>
                <p className="text-sm text-muted-foreground mt-1">{progressMsg || 'Preparing...'}</p>
              </div>
              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className="h-2 bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">{progress}%</p>
              </div>
            </div>
          )}

          {/* ─── STEP 3: Preview & Download ────────────────────── */}
          {step === 'preview' && (
            <div className="space-y-5">
              {/* Success Banner */}
              <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Found {parsedRows.length} transaction{parsedRows.length !== 1 ? 's' : ''}!
                  </p>
                  <p className="text-xs text-muted-foreground">Review below, then download the CSV.</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto" style={{ maxHeight: '300px' }}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0">
                      <tr className="bg-secondary/80 backdrop-blur-sm">
                        {Object.keys(parsedRows[0] || {}).map(col => (
                          <th key={col} className="text-left px-3 py-2 font-semibold text-foreground">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                      {parsedRows.map((row, idx) => (
                        <tr key={idx} className="hover:bg-secondary/20 transition-colors">
                          {Object.values(row).map((val, ci) => (
                            <td key={ci} className="px-3 py-2 text-foreground whitespace-nowrap">{val}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-card/80">
          {step === 'preview' ? (
            <>
              <button onClick={resetState} className="vibrant-button-ghost text-sm">
                Scan Another
              </button>
              <button onClick={handleDownloadCSV} className="vibrant-button-primary text-sm">
                <Download className="w-4 h-4 mr-1" />
                Download CSV
              </button>
            </>
          ) : step === 'scanning' ? (
            <>
              <div />
              <button onClick={handleClose} className="vibrant-button-ghost text-sm">Cancel</button>
            </>
          ) : (
            <>
              <div />
              <button onClick={handleClose} className="vibrant-button-ghost text-sm">Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
