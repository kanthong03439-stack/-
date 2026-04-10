export const exportToExcel = async (
  title: string,
  subtitle: string,
  headers: string[],
  data: any[][],
  filename: string,
  signatures?: string[]
) => {
  const ExcelJS = (await import('exceljs')).default;
  const { saveAs } = await import('file-saver');
  
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // Set default font for the worksheet
  worksheet.properties.defaultRowHeight = 20;

  // Add Title
  const titleRow = worksheet.addRow([title]);
  titleRow.font = { name: 'Sarabun', size: 18, bold: true };
  worksheet.mergeCells(`A1:${String.fromCharCode(65 + headers.length - 1)}1`);
  titleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  // Add Subtitle
  const subtitleRow = worksheet.addRow([subtitle]);
  subtitleRow.font = { name: 'Sarabun', size: 14, bold: false };
  worksheet.mergeCells(`A2:${String.fromCharCode(65 + headers.length - 1)}2`);
  subtitleRow.alignment = { horizontal: 'center', vertical: 'middle' };
  subtitleRow.height = 25;

  worksheet.addRow([]); // Empty row

  // Add Headers
  const headerRow = worksheet.addRow(headers);
  headerRow.font = { name: 'Sarabun', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' } // Blue-600
    };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' }
    };
  });

  // Add Data
  data.forEach((rowData) => {
    const row = worksheet.addRow(rowData);
    row.font = { name: 'Sarabun', size: 12 };
    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      // Center align specific columns if needed, default to left for names, center for others
      if (colNumber === 1 || colNumber === 2 || colNumber > 3) {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'left', vertical: 'middle' };
      }
    });
  });

  // Auto-fit columns
  worksheet.columns.forEach((column, i) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const columnLength = cell.value ? cell.value.toString().length : 10;
      if (columnLength > maxLength) {
        maxLength = columnLength;
      }
    });
    column.width = maxLength < 10 ? 10 : maxLength + 2;
  });

  // Add Signatures
  if (signatures && signatures.length > 0) {
    worksheet.addRow([]);
    worksheet.addRow([]);
    signatures.forEach(sig => {
      const sigRow = worksheet.addRow(['', '', sig]);
      sigRow.font = { name: 'Sarabun', size: 12 };
      sigRow.alignment = { horizontal: 'center' };
    });
  }

  // Generate Excel File
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, filename);
};
