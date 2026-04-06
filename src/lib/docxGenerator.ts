import { Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, HeadingLevel, ImageRun, BorderStyle, VerticalAlign, PageBreak } from 'docx';
import { format } from 'date-fns';
import { th } from 'date-fns/locale';
import { toDate } from '../lib/utils';

export function createHeaderParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: text, bold: true }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  });
}

export function createInfoParagraph(text: string, font: string = "Sarabun"): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({ text: text, font: font }),
    ],
    spacing: { after: 100 },
  });
}
