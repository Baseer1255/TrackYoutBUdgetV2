import Papa from 'papaparse';
import { parse as dateParse, isValid } from 'date-fns';

// ─── Header Aliases ─────────────────────────────────────────────────────────
// Each key is the canonical field name. The arrays list common column names
// found across Indian bank statements (HDFC, SBI, ICICI, Axis, Kotak, etc.)
// as well as international formats. All comparisons are case-insensitive and
// trimmed of whitespace.

const HEADER_ALIASES = {
  date: [
    'txn date', 'transaction date', 'value date', 'date', 'posting date',
    'trans date', 'txn_date', 'value_date', 'transaction_date',
  ],
  description: [
    'narration', 'description', 'transaction remarks', 'particulars',
    'details', 'remark', 'remarks', 'narrative', 'memo', 'reference',
    'transaction description', 'txn description',
  ],
  withdrawal: [
    'withdrawal amt.', 'withdrawal amt', 'withdrawal amount (inr)',
    'withdrawal amount', 'debit amount', 'debit', 'debit amt',
    'dr amount', 'withdrawals', 'withdrawal', 'amount debited',
    'debit(inr)', 'dr', 'spend',
  ],
  deposit: [
    'deposit amt.', 'deposit amt', 'deposit amount (inr)',
    'deposit amount', 'credit amount', 'credit', 'credit amt',
    'cr amount', 'deposits', 'deposit', 'amount credited',
    'credit(inr)', 'cr', 'received',
  ],
  amount: [
    'amount', 'value', 'transaction amount', 'txn amount', 'amt',
    'amount (inr)', 'transaction_amount',
  ],
  category: [
    'category', 'type', 'transaction type', 'txn type',
  ],
  balance: [
    'closing balance', 'balance', 'running balance', 'available balance',
  ],
};

// ─── Date Formats ────────────────────────────────────────────────────────────
// Common date formats across Indian and international bank statements.
const DATE_FORMATS = [
  'dd/MM/yyyy', 'dd-MM-yyyy', 'dd/MM/yy', 'dd-MM-yy',
  'yyyy-MM-dd', 'yyyy/MM/dd',
  'MM/dd/yyyy', 'MM-dd-yyyy',
  'dd MMM yyyy', 'dd-MMM-yyyy', 'dd MMM yy', 'dd-MMM-yy',
  'd/M/yyyy', 'd-M-yyyy',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize a header string for matching: trim, lowercase, collapse whitespace.
 */
function normalizeHeader(h) {
  return (h || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Given an array of raw CSV headers, find the best match for a canonical field.
 * Returns the *original* header string (preserving case) or null.
 */
function findHeader(rawHeaders, canonicalField) {
  const aliases = HEADER_ALIASES[canonicalField] || [];
  const normalized = rawHeaders.map(normalizeHeader);

  for (const alias of aliases) {
    const idx = normalized.indexOf(alias);
    if (idx !== -1) return rawHeaders[idx];
  }
  return null;
}

/**
 * Parse an amount string, keeping currency signs for display but returning
 * a numeric value. Returns { display, value } where display retains ₹/$/€
 * signs and commas, and value is a clean number.
 */
function parseAmount(raw) {
  if (raw === null || raw === undefined || raw === '') {
    return { display: '', value: 0 };
  }
  const str = String(raw).trim();
  if (!str) return { display: '', value: 0 };

  // Keep the original string as display
  const display = str;

  // Extract numeric value: remove everything except digits, dots, and minus
  const cleaned = str.replace(/[^0-9.\-]+/g, '');
  const value = parseFloat(cleaned) || 0;

  return { display, value };
}

/**
 * Try to parse a date string using multiple Indian/international formats.
 * Returns a valid Date object or null.
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  const trimmed = String(dateStr).trim();
  if (!trimmed) return null;

  // Try native parsing first (handles ISO dates well)
  const native = new Date(trimmed);
  if (isValid(native) && !isNaN(native.getTime())) {
    // But be careful: "12/01/2024" in native JS is MM/DD, not DD/MM.
    // So we only trust native for ISO-like strings.
    if (/^\d{4}[-/]\d{2}[-/]\d{2}/.test(trimmed)) {
      return native;
    }
  }

  // Try each format with date-fns
  for (const fmt of DATE_FORMATS) {
    try {
      const parsed = dateParse(trimmed, fmt, new Date());
      if (isValid(parsed)) return parsed;
    } catch {
      // Ignore and try next format
    }
  }

  // Fallback: try native as last resort
  if (isValid(native) && !isNaN(native.getTime())) {
    return native;
  }

  return null;
}

/**
 * Detect whether a row is likely a metadata/header row (not a real transaction).
 * Heuristic: if none of the fields look like a numeric amount, skip it.
 */
function isMetadataRow(row, amountHeaders) {
  for (const h of amountHeaders) {
    if (h && row[h]) {
      const val = parseAmount(row[h]).value;
      if (val !== 0) return false;
    }
  }
  return true;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Parses a CSV file into an array of objects.
 * Automatically skips metadata rows at the top of the file.
 * @param {File} file - The CSV file
 * @returns {Promise<{ data: Array<any>, headers: string[], detectedMapping: object }>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing finished with warnings:', results.errors);
        }

        const headers = results.meta.fields || [];
        const detectedMapping = detectColumnMapping(headers);

        resolve({
          data: results.data,
          headers,
          detectedMapping,
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

/**
 * Auto-detect which CSV columns map to our canonical fields.
 * Returns an object like { date: 'Txn Date', description: 'Narration', ... }
 */
export function detectColumnMapping(headers) {
  return {
    date: findHeader(headers, 'date'),
    description: findHeader(headers, 'description'),
    withdrawal: findHeader(headers, 'withdrawal'),
    deposit: findHeader(headers, 'deposit'),
    amount: findHeader(headers, 'amount'),
    category: findHeader(headers, 'category'),
    balance: findHeader(headers, 'balance'),
  };
}

/**
 * Formats raw CSV data into transaction objects for Supabase.
 * Handles both single-amount and split withdrawal/deposit columns.
 * Imports BOTH withdrawals (as positive expenses) and deposits (as negative/income).
 *
 * @param {Array<any>} rawData - Data from PapaParse
 * @param {string} projectId - Target project ID
 * @param {string} userId - User ID uploading the data
 * @param {object} mapping - Column mapping { date, description, withdrawal, deposit, amount, category }
 * @returns {Array<any>} Formatted transactions ready for Supabase insert
 */
export function formatTransactionsForDb(rawData, projectId, userId, mapping = null) {
  // If no mapping provided, try auto-detect from first row's keys
  if (!mapping && rawData.length > 0) {
    mapping = detectColumnMapping(Object.keys(rawData[0]));
  }
  if (!mapping) mapping = {};

  const hasSplitColumns = mapping.withdrawal || mapping.deposit;
  const amountHeaders = [mapping.withdrawal, mapping.deposit, mapping.amount].filter(Boolean);

  const transactions = [];

  for (const row of rawData) {
    // Skip metadata rows that have no valid amounts
    if (isMetadataRow(row, amountHeaders)) continue;

    let amount = 0;
    let txnType = 'expense'; // 'expense' or 'income'

    if (hasSplitColumns) {
      // Indian bank format: separate withdrawal and deposit columns
      const withdrawal = mapping.withdrawal ? parseAmount(row[mapping.withdrawal]).value : 0;
      const deposit = mapping.deposit ? parseAmount(row[mapping.deposit]).value : 0;

      if (withdrawal > 0) {
        amount = withdrawal;
        txnType = 'expense';
      } else if (deposit > 0) {
        amount = deposit;
        txnType = 'income';
      } else {
        continue; // Skip rows with no amount at all
      }
    } else if (mapping.amount) {
      // Single amount column
      const parsed = parseAmount(row[mapping.amount]).value;
      if (parsed === 0) continue;

      // Negative values = expense, positive = income (common convention)
      // But many banks use positive for expenses too. We'll keep absolute value
      // and mark based on sign.
      if (parsed < 0) {
        amount = Math.abs(parsed);
        txnType = 'expense';
      } else {
        amount = parsed;
        txnType = 'expense'; // Default to expense; user can change
      }
    } else {
      continue;
    }

    // Parse date
    const dateStr = mapping.date ? row[mapping.date] : null;
    const parsedDate = parseDate(dateStr);
    const createdAt = parsedDate ? parsedDate.toISOString() : new Date().toISOString();

    // Description
    const name = (mapping.description ? row[mapping.description] : null)
      || 'Imported Transaction';

    // Category (from CSV or default)
    const category = (mapping.category ? row[mapping.category] : null)
      || 'General';

    transactions.push({
      project_id: projectId,
      user_id: userId,
      name: name.trim(),
      amount: txnType === 'income' ? -amount : amount,
      category,
      created_at: createdAt,
      paid_by: txnType === 'income' ? 'Deposit' : 'Imported',
      is_recurring: false,
    });
  }

  return transactions;
}
