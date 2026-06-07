#!/usr/bin/env python3
"""
Event Bridge — Paladin JSON-RPC → Kafka topics
Polls ptx_queryTransactionReceipts, routes confirmed txs to cbdc.* topics.
"""
import os, json, time, logging
import requests
from kafka import KafkaProducer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("event-bridge")

PALADIN_URL   = os.environ.get("PALADIN_URL", "http://paladin-node1.paladin.svc:8548")
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "kafka-kafka-bootstrap.kafka.svc:9092")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_MS", "1000"))

# Domain/type → Kafka topic routing
# Extended after contracts deployed — falls back to cbdc.tx.confirmed
DOMAIN_TOPIC = {
    "noto":  "cbdc.transfer",   # CBDC token operations
    "pente": "cbdc.tx.confirmed",  # private EVM (DVP, bonds)
}


def rpc(session, method, params=None):
    resp = session.post(PALADIN_URL, json={
        "jsonrpc": "2.0", "id": 1,
        "method": method,
        "params": params or [],
    }, timeout=10)
    resp.raise_for_status()
    data = resp.json()
    if "error" in data:
        raise RuntimeError(f"RPC error {method}: {data['error']}")
    return data.get("result")


def topic_for(receipt):
    domain = (receipt.get("domain") or "").lower()
    return DOMAIN_TOPIC.get(domain, "cbdc.tx.confirmed")


def main():
    # Connect Kafka with retry
    producer = None
    while producer is None:
        try:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BROKERS.split(","),
                value_serializer=lambda v: json.dumps(v).encode(),
                acks="all",
                retries=5,
            )
            log.info("Kafka connected to %s", KAFKA_BROKERS)
        except Exception as e:
            log.warning("Kafka not ready: %s — retrying in 5s", e)
            time.sleep(5)

    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    # Wait for Paladin
    while True:
        try:
            result = rpc(session, "transport_nodeName")
            log.info("Paladin ready. Node: %s", result)
            break
        except Exception as e:
            log.warning("Paladin not ready: %s — retrying in 5s", e)
            time.sleep(5)

    log.info("Bridge running. Polling every %dms", POLL_INTERVAL)
    last_seq = 0

    while True:
        try:
            receipts = rpc(session, "ptx_queryTransactionReceipts", [{
                "limit": 50,
                "gt": [{"field": "sequence", "value": last_seq}],
                "sort": ["sequence"],
            }])
            if not receipts:
                receipts = []

            for r in receipts:
                if not r.get("success"):
                    continue
                seq = r.get("sequence", 0)
                topic = topic_for(r)
                producer.send(topic, value=r)
                log.info("→ %s seq=%d txHash=%s", topic, seq, r.get("transactionHash", "")[:16])
                if seq > last_seq:
                    last_seq = seq

            if receipts:
                producer.flush()

        except Exception as e:
            log.error("poll error: %s", e)

        time.sleep(POLL_INTERVAL / 1000)


if __name__ == "__main__":
    main()
