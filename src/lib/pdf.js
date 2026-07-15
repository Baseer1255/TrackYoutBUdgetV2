import html2pdf from 'html2pdf.js';

/**
 * Exports a specific DOM element as a PDF.
 * Clones the element to avoid freezing the live page, and uses
 * a lower canvas scale for performance.
 *
 * @param {HTMLElement} element - The DOM node to export
 * @param {string} filename - Desired filename
 */
export async function exportToPDF(element, filename = 'budget-report.pdf') {
  if (!element) return;

  // Clone the element so html2canvas doesn't lock the live DOM
  const clone = element.cloneNode(true);

  // Remove interactive elements that don't belong in a PDF
  clone.querySelectorAll('button, input, select, [data-no-pdf]').forEach(el => el.remove());

  // Style the clone for clean PDF output
  Object.assign(clone.style, {
    position: 'fixed',
    top: '-99999px',
    left: '-99999px',
    width: element.offsetWidth + 'px',
    background: '#ffffff',
    color: '#1a1a1a',
    padding: '24px',
    zIndex: '-1',
  });

  document.body.appendChild(clone);

  const opt = {
    margin:       0.4,
    filename:     filename,
    image:        { type: 'jpeg', quality: 0.90 },
    html2canvas:  { 
      scale: 1.5,          // Lower scale = much faster, still decent quality
      useCORS: true,
      logging: false,
      allowTaint: true,
      removeContainer: true,
    },
    jsPDF:        { unit: 'in', format: 'a4', orientation: 'portrait' },
    pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] },
  };

  try {
    await html2pdf().set(opt).from(clone).save();
  } catch (err) {
    console.error('PDF export failed:', err);
    alert('PDF export failed. Please try again.');
  } finally {
    // Always clean up the clone
    if (clone.parentNode) {
      document.body.removeChild(clone);
    }
  }
}
