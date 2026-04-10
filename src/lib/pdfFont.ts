import { jsPDF } from 'jspdf';

// Sarabun base64 string is too large to embed directly.
// We will fetch it from Google Fonts GitHub repo to get the full un-subsetted font.
export const setupThaiFont = async (doc: jsPDF) => {
  try {
    // Fetch full Sarabun font (includes Thai characters)
    const [regRes, boldRes] = await Promise.all([
      fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf'),
      fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf')
    ]);

    const [regBlob, boldBlob] = await Promise.all([regRes.blob(), boldRes.blob()]);
    
    const convertToBase64 = (blob: Blob) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

    const [regBase64, boldBase64] = await Promise.all([
      convertToBase64(regBlob),
      convertToBase64(boldBlob)
    ]);

    doc.addFileToVFS('Sarabun-Regular.ttf', regBase64);
    doc.addFont('Sarabun-Regular.ttf', 'Sarabun', 'normal');
    
    doc.addFileToVFS('Sarabun-Bold.ttf', boldBase64);
    doc.addFont('Sarabun-Bold.ttf', 'Sarabun', 'bold');
    
    doc.setFont('Sarabun');
  } catch (error) {
    console.error('Error loading Thai font:', error);
  }
};
