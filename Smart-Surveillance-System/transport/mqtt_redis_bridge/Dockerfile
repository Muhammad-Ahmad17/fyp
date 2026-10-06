FROM python:3.11-slim
WORKDIR /app
COPY transport/mqtt_redis_bridge/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY transport/mqtt_redis_bridge/bridge.py .
CMD ["python", "-u", "bridge.py"]
