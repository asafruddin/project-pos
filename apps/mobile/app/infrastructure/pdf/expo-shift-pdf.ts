import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { ShiftReport } from "@pos-apps/domain";
import { AppError } from "@/core/errors/app-error";
import { renderShiftReportHtml, type ShiftPdf, type ShiftPdfLabels } from "@/features/shift/domain/shift-pdf";
import { formatIdr } from "@/utils/money";

/** `expo-print` renders the HTML to a PDF file; `expo-sharing` opens the system share sheet. */
export class ExpoShiftPdf implements ShiftPdf {
  constructor(
    private readonly labels: (lang: "id" | "en") => ShiftPdfLabels,
    private readonly locale: (lang: "id" | "en") => string,
  ) {}

  async create(report: ShiftReport, lang: "id" | "en"): Promise<string> {
    const locale = this.locale(lang);
    const html = renderShiftReportHtml(
      report,
      this.labels(lang),
      (minor) => formatIdr(minor, lang),
      (iso) => new Date(iso).toLocaleString(locale, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }),
    );
    try {
      // A4 portrait in points.
      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      return uri;
    } catch {
      throw new AppError("PDF", "PDF_CREATE_FAILED");
    }
  }

  async share(uri: string): Promise<void> {
    if (!(await Sharing.isAvailableAsync())) throw new AppError("PDF", "PDF_SHARE_UNAVAILABLE");
    try {
      await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: "Shift" });
    } catch {
      throw new AppError("PDF", "PDF_SHARE_FAILED");
    }
  }
}
