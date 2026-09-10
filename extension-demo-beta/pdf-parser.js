import * as pdfjsLib from "./lib/pdf.min.mjs";

const MAX_PDF_TEXT_CHARS = 120000;
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.mjs");

async function parsePdfText(bytes) {
  let document;
  try {
    document = await pdfjsLib.getDocument({ data: bytes }).promise;
    const parts = [];
    const sections = [];
    let characterCount = 0;
    let truncated = false;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items.map((item) => item.str + (item.hasEOL ? "\n" : " ")).join("").replace(/[ \t]+\n/g, "\n").trim();
      if (!pageText) continue;
      const remaining = MAX_PDF_TEXT_CHARS - characterCount;
      if (remaining <= 0) { truncated = true; break; }
      if (pageText.length > remaining) {
        const partialText = pageText.slice(0, remaining);
        parts.push(partialText);
        sections.push({ label: `Page ${pageNumber}`, text: partialText });
        truncated = true;
        break;
      }
      parts.push(pageText);
      sections.push({ label: `Page ${pageNumber}`, text: pageText });
      characterCount += pageText.length;
    }
    const text = parts.join("\n\n").trim();
    if (!text) return { error: "No selectable text was found in this PDF. It may be a scanned image or protected document." };
    return { text, sections, pageCount: document.numPages, truncated };
  } catch {
    return { error: "Brief could not read this PDF. It may be password-protected or use an unsupported format." };
  } finally {
    await document?.destroy?.();
  }
}

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action !== "EXTRACT_PDF_TEXT") return;
  parsePdfText(new Uint8Array(request.bytes)).then(sendResponse);
  return true;
});
