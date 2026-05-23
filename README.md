# 📊 Automated Data Analysis System

A full-stack AI-powered data analysis system with automatic data cleaning, visualization, and insights generation.

**Tech Stack:**

- **Backend:** Python, FastAPI, LangGraph, OpenAI/OpenRouter
- **Frontend:** React + Vite
- **APIs:** OpenRouter (recommended) or OpenAI

---

## 🚀 Quick Start (5 minutes)

### Prerequisites

- Python 3.8+
- OpenRouter or OpenAI API key

### 1. Get API Key

Choose ONE:

- **OpenRouter** (Recommended): https://openrouter.ai/keys
- **OpenAI**: https://platform.openai.com/api-keys

### 2. Setup Backend

```bash
# Navigate to project root
cd Automated-Data-Analysis

# Copy environment template
cp .env.example .env

# Add your API key to .env
echo "OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE" >> .env

# Make startup script executable
chmod +x start.sh

# Start backend (starts Python venv automatically)
./start.sh
```

Backend will be available at: `http://localhost:8000`

### 3. Setup Frontend (in another terminal)

```bash
# Make frontend startup script executable
chmod +x start-frontend.sh

# Start frontend
./start-frontend.sh
```

Frontend will be available at: `http://localhost:5173`

---

## 📖 Directory Structure

```
Automated-Data-Analysis/
├── backend/
│   ├── main.py                 # FastAPI application
│   └── agent/
│       ├── graph.py            # LangGraph workflow
│       ├── nodes.py            # Analysis nodes
│       ├── llm.py              # LLM integration
│       └── state.py            # State management
├── frontend/
│   ├── src/
│   │   ├── App.jsx             # Main React UI
│   │   ├── main.jsx            # React entrypoint
│   │   ├── styles.css
│   │   └── components/
│   │       └── InsightsReport.jsx
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── uploads/                    # Runtime CSV uploads (.gitignored)
├── .env.example                # Config template
├── requirements.txt            # Python dependencies
├── start.sh / start.ps1        # Backend startup
├── start-frontend.sh / start-frontend.ps1
└── README.md
```

---

## 🔧 Configuration

### Backend (.env)

```env
# AI Provider (choose ONE)
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
OPENROUTER_MODEL=openai/gpt-4o-mini

# OR OpenAI
# OPENAI_API_KEY=sk-YOUR_KEY_HERE
# OPENAI_MODEL=gpt-4o-mini

# Server
HOST=0.0.0.0
PORT=8000
```

### Frontend (.env)

```env
VITE_API_URL=http://localhost:8000
```

---

## 🎯 Features

### Backend Features

✅ Automatic data cleaning (fill missing values, remove outliers)
✅ Data validation and schema analysis
✅ Multiple LLM provider support (OpenRouter, OpenAI)
✅ Configurable AI models
✅ RESTful API with comprehensive endpoints
✅ File upload with validation
✅ Error handling and logging

### Frontend Features

✅ Drag & drop file upload
✅ Real-time analysis results
✅ Interactive data visualization
✅ Responsive design (mobile-friendly)
✅ Schema and statistics display
✅ Cleaning operations log
✅ Analysis insights and summary
✅ Download report functionality

---

## 📚 API Documentation

### Health Check

```bash
curl http://localhost:8000/health
```

### Configuration Check

```bash
curl http://localhost:8000/config
```

### Run Analysis

```bash
curl -X POST http://localhost:8000/run-agent \
  -F "file=@data.csv"
```

### Interactive Docs

Visit: `http://localhost:8000/docs`

---

## 🔄 Data Analysis Flow

```
┌─────────────────┐
│  User uploads   │
│  CSV/TSV file   │
└────────┬────────┘
         │
         ▼
┌────────────────────┐
│ Schema Inspector   │ ← Analyze columns, types, missing data
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│  Data Cleaner      │ ← AI suggests cleaning actions
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Insight Planner    │ ← AI decides which charts to generate
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Chart Generator    │ ← Creates visualizations
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Narrative Agent    │ ← Generates summary report
└────────┬───────────┘
         │
         ▼
┌─────────────────┐
│ Results to User │
└─────────────────┘
```

---

## 🐛 Common Issues

### 401 Unauthorized Error

**Problem:** Backend returns 401 when processing files

**Solutions:**

1. Check API key is set in `.env`
2. Verify API key is valid (not expired)
3. Ensure `.env` is in project root
4. Restart backend with: `./start.sh`

**Test:**

```bash
curl http://localhost:8000/config
```

### Cannot Connect to Backend

**Problem:** Frontend shows connection error

**Solutions:**

1. Ensure backend is running: `./start.sh`
2. Check `VITE_API_URL` in frontend `.env`
3. Verify backend is accessible: `curl http://localhost:8000/health`
4. Check firewall/port settings

### Module Not Found Errors

**Problem:** Python/Node modules missing

**Solutions:**

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

---

## 📊 Supported File Formats

- **CSV** (.csv)
- **TSV** (.tsv)
- **Max Size:** 50MB
- **Requirements:** Headers required, must have data rows

---

## 🎨 UI Components

### React Components

- `FileUploader` - File upload with validation
- `SchemaDisplay` - Dataset info and statistics
- `ChartDisplay` - Visualization gallery
- `CleaningLog` - Cleaning operations log
- `InsightsDisplay` - Analysis summary
- `ConfigStatus` - Backend status checker

### UI Elements (shadcn-style)

- Buttons with variants
- Cards with layout sections
- Alerts with different severities
- Input fields
- Responsive grid layouts

---

## 🔗 Model Options

### OpenRouter (Recommended)

```env
# Fast and responsive
OPENROUTER_MODEL=openai/gpt-4o-mini

# Better quality (slower)
OPENROUTER_MODEL=openai/gpt-4-turbo
```

### OpenAI

```env
# GPT-4 mini variant
OPENAI_MODEL=gpt-4o-mini

# Standard models
OPENAI_MODEL=gpt-3.5-turbo
```

---

## 📈 Performance Tips

1. **Use gpt-4o-mini** for faster analysis (default)
2. **Keep CSV files under 10MB** for best performance
3. **Close unused browser tabs** to free up memory
4. **Restart backend** if performance degrades

---

## 🔐 Security Notes

⚠️ **Do NOT commit `.env` file to version control**

✅ **Do:**

- Store API keys in environment variables
- Use `.env.example` as template
- Add `.env` to `.gitignore`

---

## 📱 Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

---

## 🚀 Deployment

### Backend (Production)

```bash
# Using Gunicorn
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8000 backend.main:app
```

### Frontend (Production)

```bash
# Build and serve
npm run build
npm run preview

# Or deploy dist/ folder to static hosting (Vercel, Netlify, etc.)
```

---

## 🛠️ Development

### Run Both Services Locally

**Terminal 1 (Backend):**

```bash
./start.sh
```

**Terminal 2 (Frontend):**

```bash
cd frontend && npm run dev
```

### Enable Debug Logging

Backend already logs important events. To see more details:

```python
# In backend/main.py, uncomment debug logging
import logging
logging.basicConfig(level=logging.DEBUG)
```

---

## 📞 Support

### Check Configuration

```bash
curl http://localhost:8000/config
```

### View API Docs

Visit: `http://localhost:8000/docs`

### Check Logs

- Backend: Console output from `./start.sh`
- Frontend: Browser console (F12)

---

## 📝 Example Workflow

1. **Start Backend:** `./start.sh`
2. **Start Frontend:** `npm run dev` (in frontend/)
3. **Open Frontend:** `http://localhost:5173`
4. **Upload CSV:** Drag & drop or click to select
5. **View Results:** Schema, charts, insights appear automatically
6. **Download Report:** Click "Download Report" button

---

## 🎓 Learning Resources

- [LangGraph Documentation](https://langchain-ai.github.io/langgraph/)
- [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/)
- [React Documentation](https://react.dev)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [Vite Guide](https://vitejs.dev/guide/)

---

## 📄 License

MIT License - feel free to use and modify

---

## 🤝 Contributing

Contributions welcome! Please ensure:

- Code is documented
- Tests pass (where applicable)
- Follows existing code style

---

**Built with ❤️ using Python, React, and AI**

Last Updated: April 22, 2026
