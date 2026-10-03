import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

import regular from '~/assets/fonts/Barlow-Regular.ttf.b64' with { type: 'text' };
import semiBold from '~/assets/fonts/Barlow-SemiBold.ttf.b64' with { type: 'text' };
import condensedBold from '~/assets/fonts/BarlowCondensed-Bold.ttf.b64' with { type: 'text' };
import { formatMoney, type ReceiptView } from '~/services/receipt/receipt.view';
import logoSvg from '../../../../web/src/assets/brand/logo-mark.svg' with { type: 'text' };

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const RIGHT = PAGE.width - MARGIN;
const COLUMN_2 = 320;
const LOGO_SIZE = 30;

const COLOR = {
  text: rgb(0.13, 0.15, 0.14),
  muted: rgb(0.42, 0.45, 0.43),
  brand: rgb(0.1, 0.32, 0.2),
  rule: rgb(0.2, 0.22, 0.21),
  light: rgb(0.87, 0.89, 0.86),
};

const COLUMNS = { title: MARGIN, start: 330, end: 420 };

interface Fonts {
  regular: PDFFont;
  semiBold: PDFFont;
  brand: PDFFont;
}

const logoPaths = [...logoSvg.matchAll(/<path\b[^>]*>/g)].flatMap(([tag]) => {
  const d = tag.match(/\sd="([^"]+)"/)?.[1];
  const fill = tag.match(/\sfill="#([0-9a-fA-F]{6})"/)?.[1];
  return d && fill ? [{ d, color: hexToRgb(fill) }] : [];
});
const logoViewBox = Number(logoSvg.match(/viewBox="0 0 (\d+(?:\.\d+)?)/)?.[1] ?? 444);

function hexToRgb(hex: string): RGB {
  const value = parseInt(hex, 16);
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
}

const wrap = (text: string, font: PDFFont, size: number, width: number) => {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
};

class ReceiptWriter {
  private page: PDFPage;
  private y = PAGE.height - MARGIN;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: Fonts,
  ) {
    this.page = doc.addPage([PAGE.width, PAGE.height]);
  }

  text(
    value: string,
    x: number,
    size: number,
    { font = this.fonts.regular, color = COLOR.text, alignRight = false } = {},
  ) {
    const width = font.widthOfTextAtSize(value, size);
    this.page.drawText(value, { x: alignRight ? x - width : x, y: this.y - size, size, font, color });
  }

  rule(thickness = 0.6, color = COLOR.light) {
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: RIGHT, y: this.y }, thickness, color });
  }

  space(height: number) {
    this.y -= height;
  }

  ensure(height: number, onNewPage?: () => void) {
    if (this.y - height >= MARGIN + 24) return;
    this.page = this.doc.addPage([PAGE.width, PAGE.height]);
    this.y = PAGE.height - MARGIN;
    onNewPage?.();
  }

  header(title: string) {
    const scale = LOGO_SIZE / logoViewBox;
    for (const { d, color } of logoPaths) {
      this.page.drawSvgPath(d, { x: MARGIN, y: this.y, scale, color });
    }
    this.text('SPORTS CENTER', MARGIN + LOGO_SIZE + 10, 22, { font: this.fonts.brand, color: COLOR.brand });
    this.space(LOGO_SIZE + 22);
    this.text(title, MARGIN, 15);
    this.space(36);
  }

  twoColumns(
    left: { title: string; lines: string[] },
    right: { title: string; lines?: string[]; pairs?: [string, string][] },
  ) {
    const lineHeight = 15;
    this.text(left.title, MARGIN, 9, { font: this.fonts.semiBold });
    this.text(right.title, COLUMN_2, 9, { font: this.fonts.semiBold });
    const top = this.y - 22;
    const leftLines = left.lines.flatMap((line) => wrap(line, this.fonts.regular, 9, COLUMN_2 - MARGIN - 24));
    leftLines.forEach((line, index) => {
      this.page.drawText(line, {
        x: MARGIN,
        y: top - index * lineHeight - 9,
        size: 9,
        font: this.fonts.regular,
        color: COLOR.text,
      });
    });
    const rightRows = right.pairs ?? (right.lines ?? []).map((line): [string, string] => [line, '']);
    rightRows.forEach(([label, value], index) => {
      const y = top - index * lineHeight - 9;
      this.page.drawText(label, { x: COLUMN_2, y, size: 9, font: this.fonts.regular, color: COLOR.text });
      const width = this.fonts.regular.widthOfTextAtSize(value, 9);
      this.page.drawText(value, { x: RIGHT - width, y, size: 9, font: this.fonts.regular, color: COLOR.text });
    });
    this.space(22 + Math.max(leftLines.length, rightRows.length) * lineHeight + 20);
  }

  summary(view: ReceiptView) {
    this.ensure(140);
    this.text('Tổng hợp', MARGIN, 15);
    this.space(26);
    this.rule(0.8, COLOR.rule);
    for (const { label, amount, sign } of view.summary) {
      this.space(10);
      this.text(label, MARGIN, 9.5, { color: COLOR.muted });
      this.text(`${sign ?? ''}${formatMoney(amount)}`, RIGHT, 9.5, { alignRight: true });
      this.space(20);
      this.rule();
    }
    if (view.summary.length) this.rule(0.8, COLOR.rule);
    this.space(12);
    this.text(view.total.label, MARGIN, 14, { font: this.fonts.semiBold });
    this.text(formatMoney(view.total.amount), RIGHT, 14, { font: this.fonts.semiBold, alignRight: true });
    this.space(26);
    this.rule(0.8, COLOR.rule);
    if (view.note) {
      this.space(10);
      for (const line of wrap(view.note, this.fonts.regular, 9.5, RIGHT - MARGIN)) {
        this.text(line, MARGIN, 9.5, { color: COLOR.muted });
        this.space(14);
      }
    }
    this.space(32);
  }

  details(view: ReceiptView) {
    const tableHeader = () => {
      this.text('Dịch vụ', COLUMNS.title, 9, { font: this.fonts.semiBold });
      this.text('Bắt đầu', COLUMNS.start, 9, { font: this.fonts.semiBold });
      this.text('Kết thúc', COLUMNS.end, 9, { font: this.fonts.semiBold });
      this.text(view.amountHeader, RIGHT, 9, { font: this.fonts.semiBold, alignRight: true });
      this.space(18);
      this.rule(0.8, COLOR.rule);
    };

    this.ensure(80);
    this.text(view.detailTitle, MARGIN, 15);
    this.space(30);
    tableHeader();

    for (const row of view.rows) {
      const lines = wrap(row.title, this.fonts.regular, 9, COLUMNS.start - COLUMNS.title - 16);
      const height = lines.length * 13 + 16;
      this.ensure(height, tableHeader);
      this.space(10);
      lines.forEach((line, index) => {
        this.page.drawText(line, {
          x: COLUMNS.title,
          y: this.y - 9 - index * 13,
          size: 9,
          font: this.fonts.regular,
          color: COLOR.text,
        });
      });
      this.text(row.start, COLUMNS.start, 9);
      this.text(row.end, COLUMNS.end, 9);
      this.text(formatMoney(row.amount), RIGHT, 9, { alignRight: true });
      this.space(height - 10);
      this.rule();
    }
  }

  footers() {
    const pages = this.doc.getPages();
    pages.forEach((page, index) => {
      const label = `Trang ${index + 1} / ${pages.length}`;
      const width = this.fonts.regular.widthOfTextAtSize(label, 8);
      page.drawText(label, { x: RIGHT - width, y: MARGIN - 16, size: 8, font: this.fonts.regular, color: COLOR.muted });
    });
  }
}

const decode = (base64: string) => Uint8Array.from(Buffer.from(base64, 'base64'));

export const renderReceiptPdf = async (view: ReceiptView) => {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(view.title);
  doc.setProducer('Sports Center');
  const [regularFont, semiBoldFont, brandFont] = await Promise.all(
    [regular, semiBold, condensedBold].map((font) => doc.embedFont(decode(font), { subset: true })),
  );
  const writer = new ReceiptWriter(doc, { regular: regularFont!, semiBold: semiBoldFont!, brand: brandFont! });

  writer.header(view.title);
  writer.twoColumns({ title: 'Đơn vị phát hành', lines: view.issuer }, { title: view.infoTitle, pairs: view.info });
  writer.twoColumns(
    { title: 'Thông tin người mua', lines: view.buyer },
    { title: 'Mã thành viên', lines: view.memberCode ? [view.memberCode] : ['—'] },
  );
  writer.summary(view);
  writer.details(view);
  writer.footers();

  return doc.save();
};
