import Papa from 'papaparse';

/**
 * Parses a CSV file into an array of objects
 * @param {File} file - The CSV file
 * @returns {Promise<Array<any>>}
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          console.warn('CSV parsing finished with errors:', results.errors);
        }
        resolve(results.data);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}

/**
 * Maps standard CSV columns to our database transaction format
 * @param {Array<any>} rawData - Data from PapaParse
 * @param {string} projectId - Target project ID
 * @param {string} userId - User ID uploading the data
 * @returns {Array<any>} Formatted transactions ready for Supabase insert
 */
export function formatTransactionsForDb(rawData, projectId, userId) {
  return rawData.map(row => {
    // Attempt to parse amount. Could be negative or positive depending on bank format.
    const amountStr = row.Amount || row.amount || row.Value || row.value || '0';
    let amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
    
    // Normalize to absolute value if bank exports expenses as negative
    if (amount < 0) amount = Math.abs(amount);

    return {
      project_id: projectId,
      user_id: userId,
      name: row.Description || row.description || row.Name || row.name || 'Imported Transaction',
      amount: amount,
      category: row.Category || row.category || 'General',
      created_at: row.Date || row.date ? new Date(row.Date || row.date).toISOString() : new Date().toISOString(),
      paid_by: 'Imported',
      is_recurring: false
    };
  });
}
