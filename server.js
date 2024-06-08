const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const Minio = require('minio');
const path = require('path');

const app = express();
const port = 3000;

// MySQL connection
const db = mysql.createConnection({
    host: 'mysql-227be316-samanala-lms.d.aivencloud.com',
    port: 24531,
    user: 'avnadmin',
    password: 'AVNS_NCcZ413HdSaHDoboUpL',
    database: 'image_uploads'
});

db.connect((err) => {
    if (err) throw err;
    console.log('Connected to MySQL');
});

// MinIO client configuration
const minioClient = new Minio.Client({
    endPoint: 'localhost',
    port: 9000,
    useSSL: false,
    accessKey: '5U52U3eaEOde7ZiXtvC0',
    secretKey: 'aHsIeOtF70EngSSuSdu7WO14E9F26KadhsrhhcRx'
});

// Create a bucket if it doesn't exist
const bucketName = 'images';
minioClient.bucketExists(bucketName, (err, exists) => {
    if (err) throw err;
    if (!exists) {
        minioClient.makeBucket(bucketName, 'us-east-1', (err) => {
            if (err) throw err;
            console.log('Bucket created successfully');
        });
    }
});

// Multer setup for file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.use(express.static('public'));

app.post('/upload', upload.single('image'), (req, res) => {
    console.log('Received upload request');  // Log to verify the request
    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded.');
    }

    const fileName = Date.now() + path.extname(req.file.originalname);
    const filePath = `${bucketName}/${fileName}`;

    minioClient.putObject(bucketName, fileName, req.file.buffer, (err, etag) => {
        if (err) {
            console.error('Error uploading to MinIO', err);
            return res.status(500).send(err);
        }

        const fileUrl = `${minioClient.protocol}//${minioClient.endPoint}:${minioClient.port}/${bucketName}/${fileName}`;

        db.query('INSERT INTO images (filename, url) VALUES (?, ?)', [fileName, fileUrl], (err, result) => {
            if (err) {
                console.error('Error inserting into MySQL', err);
                return res.status(500).send(err);
            }
            res.send('File uploaded successfully');
        });
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});