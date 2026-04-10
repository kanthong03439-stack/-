const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

const primaryUrl = "https://placehold.co/1920x1080/007bff/ffffff?text=School+Background";
const fallbackUrl = "https://picsum.photos/id/120/1920/1080";
const filePath = "public/school-bg.png";

if (!fs.existsSync('public')) {
  fs.mkdirSync('public');
}

function download(url, dest, callback, redirectCount = 0) {
  if (redirectCount > 5) {
    return callback(new Error('Too many redirects'));
  }

  const urlObj = new URL(url);
  const client = urlObj.protocol === 'https:' ? https : http;
  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  };

  client.get(url, options, response => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      // Handle redirect
      let redirectUrl = response.headers.location;
      if (!redirectUrl.startsWith('http')) {
        redirectUrl = new URL(redirectUrl, url).href;
      }
      return download(redirectUrl, dest, callback, redirectCount + 1);
    }

    if (response.statusCode !== 200) {
      return callback(new Error(`Failed to download: ${response.statusCode}`));
    }

    const file = fs.createWriteStream(dest);
    response.pipe(file);
    file.on('finish', () => {
      file.close();
      callback(null);
    });
    file.on('error', err => {
      file.close();
      fs.unlink(dest, () => {});
      callback(err);
    });
  }).on('error', err => {
    fs.unlink(dest, () => {});
    callback(err);
  });
}

console.log(`Attempting to download primary image from: ${primaryUrl}`);
download(primaryUrl, filePath, (err) => {
  if (err) {
    console.warn(`Primary download failed: ${err.message}. Attempting fallback...`);
    download(fallbackUrl, filePath, (fallbackErr) => {
      if (fallbackErr) {
        console.error(`Fallback download also failed: ${fallbackErr.message}`);
        // Create an empty file just so the build doesn't break if it's expected
        // Or better, a tiny transparent pixel if we really need an image
        try {
          fs.writeFileSync(filePath, "");
          console.log("Created empty file as placeholder.");
        } catch (e) {
          console.error("Failed to create empty placeholder:", e.message);
        }
        process.exit(0); // Still exit 0 to allow build to proceed
      } else {
        console.log("Fallback download completed.");
        process.exit(0);
      }
    });
  } else {
    console.log("Primary download completed.");
    process.exit(0);
  }
});
