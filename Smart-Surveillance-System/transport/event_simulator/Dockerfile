FROM python:3.11-slim
WORKDIR /app
COPY transport/event_simulator/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY transport/event_simulator/simulator.py .
CMD ["python", "-u", "simulator.py"]
