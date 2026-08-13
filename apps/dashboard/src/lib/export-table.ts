export type ExportTable = {
  title: string;
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
};

function csvEscape(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function xmlEscape(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(table: ExportTable) {
  const lines = [
    table.headers.map(csvEscape).join(","),
    ...table.rows.map((row) => row.map(csvEscape).join(",")),
  ];
  triggerDownload(
    new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8" }),
    `${table.filename}.csv`,
  );
}

export function downloadXls(table: ExportTable) {
  const header = table.headers
    .map(
      (h) =>
        `<Cell ss:StyleID="header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`,
    )
    .join("");
  const body = table.rows
    .map((row) => {
      const cells = row
        .map((cell) => {
          const numeric =
            typeof cell === "number" ||
            (typeof cell === "string" && /^-?\d+(\.\d+)?$/.test(cell));
          const type = numeric ? "Number" : "String";
          return `<Cell><Data ss:Type="${type}">${xmlEscape(cell)}</Data></Cell>`;
        })
        .join("");
      return `<Row>${cells}</Row>`;
    })
    .join("");
  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="header"><Font ss:Bold="1"/></Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(table.title).slice(0, 31) || "Laporan"}">
  <Table>
   <Row>${header}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
  triggerDownload(
    new Blob([xml], { type: "application/vnd.ms-excel" }),
    `${table.filename}.xls`,
  );
}

export function downloadPdf(table: ExportTable) {
  const head = table.headers
    .map((h) => `<th>${xmlEscape(h)}</th>`)
    .join("");
  const body = table.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${xmlEscape(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>${xmlEscape(table.title)}</title>
  <style>
    body { font-family: ui-sans-serif, system-ui, sans-serif; color: #171717; padding: 24px; }
    h1 { font-size: 18px; margin: 0 0 16px; }
    table { border-collapse: collapse; width: 100%; font-size: 12px; }
    th, td { border: 1px solid #dce0ea; padding: 6px 8px; text-align: left; }
    th { background: #e8ebf2; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${xmlEscape(table.title)}</h1>
  <table>
    <thead><tr>${head}</tr></thead>
    <tbody>${body || `<tr><td colspan="${table.headers.length}">Tidak ada data.</td></tr>`}</tbody>
  </table>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
