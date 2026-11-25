FROM python:3.12-slim
WORKDIR /app
ENV PYTHONPATH=/app PYTHONUNBUFFERED=1
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY contracts ./contracts
COPY transport ./transport
COPY services ./services
COPY edge/inference/samples ./evidence/samples
ARG SERVICE=api
ENV SERVICE=${SERVICE}
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD python -c "import os,urllib.request,sys; sys.exit(0) if os.environ.get('SERVICE')!='api' else urllib.request.urlopen('http://127.0.0.1:3000/api/health').status<500"
CMD ["sh", "-c", "if [ \"$SERVICE\" = api ]; then exec python -m services.api.main; elif [ \"$SERVICE\" = bridge ]; then exec python -m transport.mqtt_redis_bridge; else exec python -m transport.event_simulator; fi"]
