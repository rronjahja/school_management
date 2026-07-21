import { renderAsync } from 'docx-preview';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import client from '../api/client';

/**
 * Fletëpagesa në shfletues, pa varësi në server:
 *   1. serveri kthen .docx të mbushur (docxtemplater, si kontrata)
 *   2. docx-preview e vizaton besnikërisht si HTML këtu në shfletues
 *   3. prej andej: PDF (html2pdf), printim (iframe) ose foto (clipboard)
 *
 * Kjo rrugë funksionon kudo që hapet aplikacioni — nuk kërkon LibreOffice
 * a Word të instaluar në serverin e shkollës.
 */

async function fetchSlip(url) {
  const { data } = await client.get(url, { responseType: 'blob' });
  return data;
}

/** Vizaton .docx-in në një kontejner jashtë ekranit; kthen elementin. */
async function renderOffscreen(blob) {
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-12000px;top:0;width:820px;background:#fff;z-index:-1;';
  document.body.appendChild(host);
  await renderAsync(blob, host, undefined, {
    inWrapper: true,
    ignoreLastRenderedPageBreak: false,
  });
  return host;
}

function cleanup(host) {
  if (host && host.parentNode) host.parentNode.removeChild(host);
}

/** Faqja e vizatuar (elementi që përfaqëson fletën A4). */
function pageOf(host) {
  return host.querySelector('.docx') || host;
}

// ---------------------------------------------------------------

/**
 * PDF me NJE faqe te vetme.
 *
 * html2pdf-i ndan automatikisht ne faqe sipas lartesise, dhe meqe
 * docx-preview e vizaton fleten pak me te larte se A4, fletepagesa
 * dilte ne DY faqe — e prere ne mes. Prandaj e rasterizojme vete dhe e
 * shkallezojme qe te hyje e plote ne nje faqe.
 */
/** Rasterizon fletën dhe e vendos në një faqe të vetme A4. */
async function buildPdf(host) {
  const canvas = await html2canvas(pageOf(host), {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pw = pdf.internal.pageSize.getWidth();
  const ph = pdf.internal.pageSize.getHeight();

  // permasat qe ruajne raportin dhe hyjne brenda faqes
  const ratio = Math.min(pw / canvas.width, ph / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;

  pdf.addImage(
    canvas.toDataURL('image/jpeg', 0.96),
    'JPEG',
    (pw - w) / 2,
    (ph - h) / 2,
    w,
    h
  );
  return { pdf, canvas };
}

/**
 * PDF me NJE faqe te vetme.
 *
 * html2pdf-i ndan automatikisht ne faqe sipas lartesise, dhe meqe
 * docx-preview e vizaton fleten pak me te larte se A4, fletepagesa
 * dilte ne DY faqe — e prere ne mes. Prandaj e rasterizojme vete dhe e
 * shkallezojme qe te hyje e plote ne nje faqe.
 */
export async function downloadSlipPdf(url, filename) {
  const host = await renderOffscreen(await fetchSlip(url));
  try {
    const { pdf } = await buildPdf(host);
    pdf.save(filename);
  } finally {
    cleanup(host);
  }
}

/**
 * Dergon fleten SE BASHKU me tekstin te Viber/WhatsApp permes dritares
 * se ndarjes se sistemit.
 *
 * PSE JO CLIPBOARD-I: aplikacionet e bisedave marrin vetem formen me te
 * pasur te clipboard-it — fotografine — dhe e heshtin tekstin. Prandaj
 * ngjitja jepte vetem skedarin. Web Share API ia dorezon aplikacionit te
 * dyja njeherazi: skedarin dhe mesazhin (WhatsApp e vendos si koment).
 *
 * @returns {'shared'|'copied'} cila rruge u perdor
 */
export async function shareSlipWithText(url, text, filename) {
  const host = await renderOffscreen(await fetchSlip(url));
  try {
    const { pdf, canvas } = await buildPdf(host);
    const file = new File([pdf.output('blob')], filename, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return 'shared';
    }

    // Rruga rezerve: fotografia + teksti ne clipboard (shih shenimin lart)
    const png = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('rasterizimi deshtoi'))), 'image/png')
    );
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': png,
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
    return 'copied';
  } finally {
    cleanup(host);
  }
}

export async function printSlip(url) {
  const host = await renderOffscreen(await fetchSlip(url));
  try {
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument;
    doc.open();
    // docx-preview i fut stilet BRENDA kontejnerit, ndaj innerHTML i bart ato
    // 'transform: scale' me origjinë lart-majtas siguron që fleta e vizatuar
    // pak më e lartë se A4 të mos kalojë në faqe të dytë gjatë shtypjes
    doc.write(
      '<!doctype html><html><head><meta charset="utf-8"><style>' +
        'body{margin:0}@page{size:A4;margin:0}' +
        '.docx-wrapper{background:#fff!important;padding:0!important}' +
        '.docx{box-shadow:none!important;margin:0 auto!important;' +
        'transform:scale(0.97);transform-origin:top center}' +
        '</style></head><body>' +
        host.innerHTML +
        '</body></html>'
    );
    doc.close();
    await new Promise((r) => setTimeout(r, 350)); // fontet dhe stilimi
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
    // hiqet pasi dialogu të jetë mbyllur — s'ka ngjarje të sigurt, prandaj me vonesë
    setTimeout(() => cleanup(iframe), 60000);
  } finally {
    cleanup(host);
  }
}

/**
 * Kopjon në clipboard NJËKOHËSISHT tekstin e rikujtesës dhe fletëpagesën
 * si fotografi. Në Viber/WhatsApp: një ngjitje e vendos fotografinë
 * (aplikacionet e bisedave marrin trajtën më të pasur); në një fushë
 * teksti ngjitet teksti.
 *
 * PDF nuk mund të vihet në clipboard — shfletuesit lejojnë vetëm tekst
 * dhe fotografi. Për PDF si skedar përdoret butoni i shkarkimit.
 */
export async function copySlipWithText(url, text) {
  const host = await renderOffscreen(await fetchSlip(url));
  try {
    const canvas = await html2canvas(pageOf(host), {
      scale: 2,
      backgroundColor: '#ffffff',
    });
    const png = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('rasterizimi dështoi'))), 'image/png')
    );
    await navigator.clipboard.write([
      new ClipboardItem({
        'image/png': png,
        'text/plain': new Blob([text], { type: 'text/plain' }),
      }),
    ]);
  } finally {
    cleanup(host);
  }
}

export const paymentSlipUrl = (paymentId) => `/payments/${paymentId}/fletepagesa`;
export const reminderSlipUrl = (studentId) => `/students/${studentId}/fletepagesa`;