import writeXlsxFile, { type Sheet } from 'write-excel-file/node';

import type { ReportDocument } from '~/services/reportExport/reportExport.tables';

const formatOf = (value: number) => (Number.isInteger(value) ? '#,##0' : '#,##0.00');

export const toXlsx = (document: ReportDocument) => {
  const sheets: Sheet<Buffer>[] = document.tables.map((table) => ({
    sheet: table.name,
    stickyRowsCount: 1,
    columns: table.columns.map((column, index) => ({ width: index === 0 ? 28 : Math.max(14, column.length + 2) })),
    data: [
      table.columns.map((column) => ({ value: column, fontWeight: 'bold' as const })),
      ...table.rows.map((row) =>
        row.map((cell) =>
          typeof cell === 'number'
            ? { value: cell, type: Number, format: formatOf(cell) }
            : { value: cell, type: String },
        ),
      ),
    ],
  }));
  return writeXlsxFile(sheets).toBuffer();
};
