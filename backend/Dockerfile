FROM python:3.10-slim

ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir daphne

COPY . .
RUN chmod +x /app/entrypoint.sh 2>/dev/null || true

EXPOSE 8000

CMD ["/bin/sh", "/app/entrypoint.sh"]
