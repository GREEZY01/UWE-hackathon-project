FROM python:3.11-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources && apt-get -o Acquire::Retries=0 -o Acquire::https::Timeout=20 update && apt-get install -y --no-install-recommends g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/requirements.lock ./requirements.lock
RUN pip install --no-cache-dir -r requirements.lock
COPY backend/ ./
RUN useradd --create-home --uid 10001 finguard && mkdir -p /app/runtime /app/docs && chown -R finguard:finguard /app
USER finguard
EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
