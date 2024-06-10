const express = require('express');
const multer = require('multer');
const mysql = require('mysql2');
const Minio = require('minio');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors());

const minio_endPoint = 'localhost'

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
    accessKey: 'FfbyBKdG1Tg4qKNdmvLF',
    secretKey: 'KttlZLQnz99FB20mOJ6Grz0OSzlbqaaZoVKKzO4r'
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

app.post('/login', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).send('Username is required');
    }

    // Create user folder in MinIO
    const userFolder = `${bucketName}/${username}/`;
    minioClient.putObject(bucketName, `${username}/.keep`, '', (err, etag) => {
        if (err) {
            console.error('Error creating user folder in MinIO', err);
            return res.status(500).send(err);
        }

        res.send('Login successful');
    });
});

app.post('/upload', upload.single('image'), (req, res) => {
    const username = req.body.username;
    if (!username) {
        return res.status(400).send('Username is required');
    }

    if (!req.file) {
        console.error('No file uploaded');
        return res.status(400).send('No file uploaded.');
    }

    const fileName = Date.now() + path.extname(req.file.originalname);
    const filePath = `${username}/${fileName}`;

    minioClient.putObject(bucketName, filePath, req.file.buffer, (err, etag) => {
        if (err) {
            console.error('Error uploading to MinIO', err);
            return res.status(500).send(err);
        }

        const fileUrl = `http://${minio_endPoint}:${minioClient.port}/${bucketName}/${filePath}`;
        db.query('INSERT INTO images (username, filename, url) VALUES (?, ?, ?)', [username, fileName, fileUrl], (err, result) => {
            if (err) {
                console.error('Error inserting into MySQL', err);
                return res.status(500).send(err);
            }
            res.send('File uploaded successfully');
        });
    });
});

app.get('/images', (req, res) => {
    const username = req.query.username;
    if (!username) {
        return res.status(400).send('Username is required');
    }

    db.query('SELECT * FROM images WHERE username = ?', [username], (err, results) => {
        if (err) {
            console.error('Error fetching images from MySQL', err);
            return res.status(500).send(err);
        }
        res.json(results);
    });
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
