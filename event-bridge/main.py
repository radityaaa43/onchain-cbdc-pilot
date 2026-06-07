#!/usr/bin/env python3
"""
Event Bridge — Paladin webhook → Kafka topics
Subscribes to Paladin event stream, publishes to cbdc.* Kafka topics.
"""
import os, json, time, logging
import requests
from kafka import KafkaProducer

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("event-bridge")

PALADIN_URL   = os.environ.get("PALADIN_URL", "http://paladin-node1.paladin.svc:8548")
KAFKA_BROKERS = os.environ.get("KAFKA_BROKERS", "kafka-controller.kafka.svc:9092")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_MS", "500"))

# Event signature → Kafka topic
# Sources: CBToken, FixedIncomeToken, DVPService (all deployed in Pente group)
TOPIC_MAP = {
    # CBDC lifecycle
    "Transfer(address,address,uint256)":                            "cbdc.transfer",
    "CBDCTransferred(address,address,uint256)":                     "cbdc.transfer",
    "Issued(address,address,uint256,bytes)":                        "cbdc.mint",      # CBToken mint
    "IssuedByPartition(bytes32,address,address,uint256,bytes,bytes)": "cbdc.mint",    # bond issuance

    # DVP settlement
    "DVPSettlementConfirmed(bytes32)":                              "cbdc.tx.confirmed",
    "DVPSettlementInitiated(bytes32,bytes32,address,address,uint256,uint256)": "cbdc.tx.confirmed",

    # Bond lifecycle
    "TransferByPartition(bytes32,address,address,address,uint256,bytes,bytes)": "cbdc.transfer",
    "ChangedPartition(bytes32,bytes32,uint256)":                    "cbdc.audit",

    # Failures & audit
    "DVPSettlementFailed(bytes32,string)":                          "cbdc.audit",
    "DVPSettlementCancelled(bytes32,string)":                       "cbdc.audit",
    "RedeemedByPartition(bytes32,address,address,uint256,bytes)":   "cbdc.audit",
}
AUDIT_TOPIC = "cbdc.audit"


def topic_for(event: dict) -> str:
    sig = event.get("signature", "")
    # exact match first
    if sig in TOPIC_MAP:
        return TOPIC_MAP[sig]
    # prefix match on event name (before first '(')
    name = sig.split("(")[0]
    for k, t in TOPIC_MAP.items():
        if k.startswith(name + "("):
            return t
    return AUDIT_TOPIC


def create_eventstream(session: requests.Session) -> str:
    resp = session.post(f"{PALADIN_URL}/api/v1/eventstreams", json={
        "name":      "cbdc-bridge",
        "type":      "webhook",
        "batchSize": 50,
        "batchTimeout": "500ms",
    })
    if resp.status_code in (200, 409):  # 409 = already exists
        streams = session.get(f"{PALADIN_URL}/api/v1/eventstreams").json()
        for s in streams:
            if s.get("name") == "cbdc-bridge":
                log.info("eventstream id=%s", s["id"])
                return s["id"]
    resp.raise_for_status()
    data = resp.json()
    log.info("created eventstream id=%s", data["id"])
    return data["id"]


def poll_events(session: requests.Session, stream_id: str, after: str = "") -> tuple[list, str]:
    params = {"limit": 50}
    if after:
        params["after"] = after
    resp = session.get(f"{PALADIN_URL}/api/v1/eventstreams/{stream_id}/events", params=params)
    if resp.status_code == 200:
        events = resp.json()
        new_after = events[-1]["id"] if events else after
        return events, new_after
    return [], after


def main():
    producer = KafkaProducer(
        bootstrap_servers=KAFKA_BROKERS.split(","),
        value_serializer=lambda v: json.dumps(v).encode(),
        acks="all",                # wait all replicas acknowledge
        retries=5,
    )
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})

    # retry until Paladin ready
    stream_id = None
    while not stream_id:
        try:
            stream_id = create_eventstream(session)
        except Exception as e:
            log.warning("Paladin not ready: %s — retrying in 5s", e)
            time.sleep(5)

    log.info("Bridge running. Polling every %dms", POLL_INTERVAL)
    after = ""
    while True:
        try:
            events, after = poll_events(session, stream_id, after)
            for ev in events:
                topic = topic_for(ev)
                producer.send(topic, value=ev)
                log.debug("→ %s txHash=%s", topic, ev.get("transactionHash", ""))
            if events:
                producer.flush()
        except Exception as e:
            log.error("poll error: %s", e)
        time.sleep(POLL_INTERVAL / 1000)


if __name__ == "__main__":
    main()
