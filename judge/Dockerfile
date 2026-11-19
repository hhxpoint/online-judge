FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    g++ \
    gcc \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
RUN pip install --no-cache-dir flask supabase

# Copy application
COPY judge_server.py .

# Expose port
EXPOSE 7860

# Run the application
CMD ["python", "judge_server.py"]
