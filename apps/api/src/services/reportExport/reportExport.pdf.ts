import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

import regular from '~/assets/fonts/Barlow-Regular.ttf.b64' with { type: 'text' };
import semiBold from '~/assets/fonts/Barlow-SemiBold.ttf.b64' with { type: 'text' };
import type { Cell, ReportDocument, ReportTable } from '~/services/reportExport/reportExport.tables';

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 36;
const ROW_HEIGHT = 18;
const SIZE = 9;

const COLOR = {
  text: rgb(0.13, 0.15, 0.14),
  muted: rgb(0.42, 0.45, 0.43),
  brand: rgb(0.1, 0.32, 0.2),
  rule: rgb(0.87, 0.89, 0.86),
};

const show = (cell: Cell) => (typeof cell === 'number' ? cell.toLocaleString('vi-VN') : cell);

class ReportWriter {
  private page: PDFPage;
  private y = PAGE.height - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: { regular: PDFFont; semiBold: PDFFont },
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
  }

  private newPage() {
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
  }

  private ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }

  private text(value: string, x: number, width: number, font: PDFFont, alignRight: boolean, color = COLOR.text) {
    let shown = value;
    while (shown.length > 1 && font.widthOfTextAtSize(shown, SIZE) > width - 6) shown = `${shown.slice(0, -2)}…`;
    const offset = alignRight ? width - 4 - font.widthOfTextAtSize(shown, SIZE) : 4;
    this.page.drawText(shown, { x: x + offset, y: this.y - ROW_HEIGHT + 6, size: SIZE, font, color });
  }

  heading(title: string, period: string | null) {
    this.page.drawText(title, { x: MARGIN, y: this.y - 18, size: 18, font: this.fonts.semiBold, color: COLOR.brand });
    this.y -= 26;
    if (period) {
      this.page.drawText(period, { x: MARGIN, y: this.y - 10, size: 10, font: this.fonts.regular, color: COLOR.muted });
      this.y -= 18;
    }
    this.y -= 8;
  }

  table({ name, columns, rows }: ReportTable) {
    const width = (PAGE.width - MARGIN * 2) / columns.length;
    const header = () => {
      columns.forEach((column, index) =>
        this.text(column, MARGIN + index * width, width, this.fonts.semiBold, index > 0),
      );
      this.y -= ROW_HEIGHT;
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 2 },
        end: { x: PAGE.width - MARGIN, y: this.y + 2 },
        thickness: 0.6,
        color: COLOR.rule,
      });
    };

    this.ensure(ROW_HEIGHT * 3);
    this.page.drawText(name, { x: MARGIN, y: this.y - 12, size: 12, font: this.fonts.semiBold, color: COLOR.text });
    this.y -= 18;
    header();
    if (rows.length === 0) {
      this.text('Không có dữ liệu', MARGIN, width * columns.length, this.fonts.regular, false, COLOR.muted);
      this.y -= ROW_HEIGHT;
    }
    for (const row of rows) {
      if (this.y - ROW_HEIGHT < MARGIN) {
        this.newPage();
        header();
      }
      row.forEach((cell, index) =>
        this.text(show(cell), MARGIN + index * width, width, this.fonts.regular, typeof cell === 'number'),
      );
      this.y -= ROW_HEIGHT;
    }
    this.y -= 14;
  }
}

export const toPdf = async (document: ReportDocument) => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(document.title);
  const fonts = {
    regular: await doc.embedFont(Buffer.from(regular, 'base64'), { subset: true }),
    semiBold: await doc.embedFont(Buffer.from(semiBold, 'base64'), { subset: true }),
  };
  const writer = new ReportWriter(doc, fonts);
  writer.heading(document.title, document.period);
  for (const table of document.tables) writer.table(table);
  return Buffer.from(await doc.save());
};
