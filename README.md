# WhatsApp Automation Dashboard

A modern, full-stack WhatsApp automation system with a beautiful dashboard UI.

## 🚀 Features

- **QR Code Authentication** - Connect WhatsApp via QR code scanning
- **Send Messages** - Text, images, and documents via API
- **Real-time Logs** - Live message monitoring
- **Stats Dashboard** - Track sent/received messages
- **Modern UI** - Glassmorphism design with animations

## 📁 Project Structure

```
whatsapp-automation/
├── server/                 # Backend
│   ├── index.js           # Main server
│   ├── .env               # Environment variables
│   └── package.json
│
└── client/                # Frontend
    ├── src/
    │   ├── components/   # React components
    │   ├── services/     # API services
    │   ├── App.jsx       # Main app
    │   └── index.css     # Global styles
    ├── .env              # Frontend env
    └── package.json
```

## ⚙️ Tech Stack

**Backend:**
- Node.js + Express.js
- whatsapp-web.js
- QRCode generation
- Session management

**Frontend:**
- React + Vite
- Tailwind CSS
- Framer Motion
- Axios

## 🔧 Installation & Setup

### 1. Clone the repository
```bash
git clone <repo-url>
cd whatsapp-automation
```

### 2. Install Backend Dependencies
```bash
cd server
npm install
```

### 3. Configure Backend
Edit `server/.env`:
```env
PORT=3001
APP_API_KEY=your-secret-api-key-12345
SESSION_PATH=./session
```

### 4. Install Frontend Dependencies
```bash
cd client
npm install
```

### 5. Configure Frontend
Edit `client/.env`:
```env
VITE_API_URL=http://localhost:3001
VITE_API_KEY=your-secret-api-key-12345
```

## 🚦 Running the Application

### Start Backend Server
```bash
cd server
npm start
```
Server runs on http://localhost:3001

### Start Frontend Dev Server
```bash
cd client
npm run dev
```
Dashboard opens at http://localhost:5173

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/status` | Get connection status |
| POST | `/send` | Send text/image/document |
| GET | `/logs` | Get message logs |
| GET | `/group-info` | Get WhatsApp groups |
| POST | `/receive` | Webhook for incoming |

### Send Message Examples

```bash
# Text Message
GET /send?apikey=KEY&recipient=1234567890&text=Hello

# Remote Image
GET /send?apikey=KEY&recipient=1234567890&file=URL&text=Caption

# Remote Document
GET /send?apikey=KEY&recipient=1234567890&document=URL&text=Desc

# Local Image
GET /send?recipient=1234567890&apikey=KEY&localimg=./image.jpg&text=Cap

# Local Document
GET /send?recipient=1234567890&apikey=KEY&localdoc=./file.pdf
```

## 🎨 Dashboard Features

1. **Connection Status** - Shows QR/code/connected state
2. **QR Scanner** - Scan to link WhatsApp device
3. **Send Form** - Multi-tab (Text/Image/Document)
4. **Stats Cards** - Total sent, received today, API status
5. **Live Logs** - Real-time message feed with filters

## 🔐 Authentication

All API endpoints (except `/status` and `/`) require:
- Query param: `apikey=YOUR_API_KEY`
- Or header: `x-api-key: YOUR_API_KEY`

## ⚠️ Important Notes

- WhatsApp session persists via local file storage
- QR code regenerates on disconnect
- Messages logged up to 100 entries
- Requires Chrome/Chromium for Puppeteer

## 📄 License

MIT License