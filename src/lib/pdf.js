import html2pdf from 'html2pdf.js';

/**
 * Exports a specific DOM element as a PDF
 * @param {HTMLElement} element - The DOM node to export
 * @param {string} filename - Desired filename
 */
export function exportToPDF(element, filename = 'budget-report.pdf') {
  if (!element) return;

  const opt = {
    margin:       0.5,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
  };

  // Temporarily add a class to the element to style it for printing if needed
  element.classList.add('pdf-export-mode');

  html2pdf().set(opt).from(element).save().then(() => {
    element.classList.remove('pdf-export-mode');
  });
}
