const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/HomeVisitSystem.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const startIndex = content.indexOf('const exportToWord = async (visit: HomeVisitData) => {');
const endIndex = content.indexOf('return (', startIndex);

if (startIndex !== -1 && endIndex !== -1) {
  const before = content.substring(0, startIndex);
  const after = content.substring(endIndex);
  
  const replacement = `const downloadWord = async (visit: HomeVisitData) => {
    alert("Word download is currently disabled while resolving build issues.");
  };

  `;
  
  fs.writeFileSync(filePath, before + replacement + after);
  console.log('Successfully replaced exportToWord with downloadWord.');
} else {
  console.log('Could not find exportToWord or return statement.');
}
