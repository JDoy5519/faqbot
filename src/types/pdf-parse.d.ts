declare module "pdf-parse" {
  export interface PdfParseResult {
    text: string;
    // add more fields here if you need them later (info, metadata, numpages,…)
  }

  function pdfParse(
    data: Buffer | Uint8Array | ArrayBuffer,
    options?: any
  ): Promise<PdfParseResult>;

  export default pdfParse;
}
