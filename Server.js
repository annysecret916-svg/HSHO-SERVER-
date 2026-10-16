const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ตัวอย่าง Endpoint สำหรับเช็กสถานะหรือล็อกอินของเกม
app.get('/', (req, res) => {
    res.send('Home Sweet Home Online Private Server is running!');
});

app.post('/api/login', (req, res) => {
    res.json({
        status: "success",
        message: "Login successful",
        token: "mock_token_server_123"
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});