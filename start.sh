#!/bin/bash

# Data Analysis Agent - Startup Script

echo "🚀 Starting Data Analysis Agent..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found. Creating from .env.example..."
    cp .env.example .env
    echo "⚠️  Please edit .env file and add your OPENROUTER_API_KEY"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install requirements
echo "📦 Installing dependencies..."
pip install -r requirements.txt -q

# Create uploads directory
mkdir -p uploads

# Start the server
echo "✅ Starting FastAPI server..."
echo "📊 API will be available at http://localhost:8000"
echo "📚 API docs available at http://localhost:8000/docs"

uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
