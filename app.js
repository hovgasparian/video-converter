require('dotenv').config();
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(require('ffmpeg-static'));
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8000;

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

const outputDir = 'converted';
!fs.existsSync(outputDir) && fs.mkdirSync(outputDir);

const allowedFormats = ['.mov'];
app.post('/upload', upload.single('video'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const fileExt = path.extname(originalName).toLowerCase();

  if (!allowedFormats.includes(fileExt)) {
    fs.unlinkSync(inputPath);
    return res.status(400).json({ message: 'Only .mov files are allowed.' });
  }

  const outputPath = path.join(outputDir, `${req.file.filename}.mp4`);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(outputPath)
        .on('end', () => {
          fs.unlinkSync(inputPath);
          resolve();
        })
        .on('error', (err) => {
          fs.unlinkSync(inputPath);
          reject(err);
        })
        .run();
    });

    res.json({ downloadLink: `/download/${path.basename(outputPath)}` });
  } catch (err) {
    res.status(500).json({ message: 'Error conversion.', error: err.message });
  }
});

app.get('/download/:filename', (req, res) => {
  const filePath = path.join(outputDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    const readStream = fs.createReadStream(filePath);

    readStream.on('end', () => {
      fs.unlinkSync(filePath);
      console.log(`File ${filePath} has been deleted after download.`);
    });

    readStream.pipe(res); 

    readStream.on('error', (err) => {
      res.status(500).json({ message: err.message });
    });
  } else {
    res.status(404).json({ message: 'File  not found.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT: ${PORT}`);
});