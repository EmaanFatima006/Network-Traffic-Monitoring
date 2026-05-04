# ====
#  app.py  —  NetWatch  |  Flask Backend
#
#  HOW TO RUN:
#    pip install flask
#    python app.py
#    Open browser → http://127.0.0.1:5000
# ====

from flask import Flask, jsonify, request, render_template
import csv
import os

# ── Base directory (always the folder where app.py lives) ──────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ── Auto-create required folders if they don't exist ───────────────────
for folder in [
    os.path.join(BASE_DIR, "templates"),
    os.path.join(BASE_DIR, "static"),
    os.path.join(BASE_DIR, "static", "css"),
    os.path.join(BASE_DIR, "static", "js"),
]:
    os.makedirs(folder, exist_ok=True)

# ── Flask app — point template & static folders explicitly ─────────────
app = Flask(
    __name__,
    template_folder=os.path.join(BASE_DIR, "templates"),
    static_folder=os.path.join(BASE_DIR, "static"),
)

# ── PORT → SERVICE MAPPING ──────────────────────────────────────────────
PORT_SERVICES = {
    20: "FTP-Data", 21: "FTP", 22: "SSH", 23: "Telnet",
    25: "SMTP", 53: "DNS", 67: "DHCP", 80: "HTTP",
    110: "POP3", 143: "IMAP", 443: "HTTPS", 465: "SMTPS",
    587: "SMTP-TLS", 993: "IMAPS", 3306: "MySQL", 3389: "RDP",
    5432: "PostgreSQL", 6379: "Redis", 8080: "HTTP-Alt",
    8443: "HTTPS-Alt", 27017: "MongoDB",
}

def get_service(port):
    try:
        return PORT_SERVICES.get(int(port), "—")
    except (ValueError, TypeError):
        return "—"

# ── APPLICATION STATE ───────────────────────────────────────────────────
is_monitoring   = False
captured_packets = []
logs            = []
dataset_index   = 0

# ── CSV LOADER ──────────────────────────────────────────────────────────
def load_dataset():
    packets  = []
    csv_path = os.path.join(BASE_DIR, "dataset.csv")
    if not os.path.exists(csv_path):
        return packets
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            row["Service"] = get_service(row.get("Destination_Port", 0))
            packets.append(row)
    return packets

ALL_PACKETS = load_dataset()

# ── ROUTES ──────────────────────────────────────────────────────────────

@app.route("/")
def home():
    return render_template("index.html")   # loads from templates/index.html

@app.route("/start", methods=["POST"])
def start_monitoring():
    global is_monitoring, captured_packets, logs, dataset_index
    if is_monitoring:
        return jsonify({"status": "error", "message": "Already monitoring."})
    is_monitoring    = True
    captured_packets = []
    dataset_index    = 0
    logs             = []
    logs.append("Monitoring started. {} packets available.".format(len(ALL_PACKETS)))
    return jsonify({"status": "ok", "message": "Monitoring started.",
                    "total_available": len(ALL_PACKETS)})

@app.route("/stop", methods=["POST"])
def stop_monitoring():
    global is_monitoring
    if not is_monitoring:
        return jsonify({"status": "error", "message": "Not currently monitoring."})
    is_monitoring = False
    logs.append("Monitoring stopped. {} packets captured.".format(len(captured_packets)))
    return jsonify({"status": "ok", "message": "Monitoring stopped.",
                    "total_captured": len(captured_packets)})

@app.route("/fetch_packet", methods=["GET"])
def fetch_packet():
    global dataset_index, captured_packets, is_monitoring   # FIX: added is_monitoring
    if not is_monitoring:
        return jsonify({"status": "idle"})
    if dataset_index >= len(ALL_PACKETS):
        is_monitoring = False                                # FIX: stop polling
        logs.append("All dataset packets have been captured.")
        return jsonify({"status": "done", "message": "Dataset exhausted."})
    packet = ALL_PACKETS[dataset_index]
    dataset_index += 1
    captured_packets.append(packet)
    logs.append("Packet #{} captured — {} {} → {} [{}B]".format(
        len(captured_packets), packet["Protocol"],
        packet["Source_IP"], packet["Destination_IP"], packet["Packet_Size"]
    ))
    return jsonify({"status": "ok", "packet": packet,
                    "total_captured": len(captured_packets)})

@app.route("/packets", methods=["GET"])
def get_packets():
    proto_filter = request.args.get("protocol", "").strip()
    src_filter   = request.args.get("src_ip",   "").strip().lower()
    dst_filter   = request.args.get("dst_ip",   "").strip().lower()
    results = captured_packets
    if proto_filter:
        results = [p for p in results if p["Protocol"] == proto_filter]
    if src_filter:
        results = [p for p in results if src_filter in p["Source_IP"].lower()]
    if dst_filter:
        results = [p for p in results if dst_filter in p["Destination_IP"].lower()]
    return jsonify({"status": "ok", "count": len(results), "packets": results})

@app.route("/stats", methods=["GET"])
def get_stats():
    total      = len(captured_packets)
    tcp_count  = len([p for p in captured_packets if p["Protocol"] == "TCP"])
    udp_count  = len([p for p in captured_packets if p["Protocol"] == "UDP"])
    icmp_count = len([p for p in captured_packets if p["Protocol"] == "ICMP"])
    avg_size   = round(sum(int(p["Packet_Size"]) for p in captured_packets) / total) if total else 0
    return jsonify({"status": "ok", "total": total, "tcp": tcp_count,
                    "udp": udp_count, "icmp": icmp_count,
                    "avg_size": avg_size, "monitoring": is_monitoring})

@app.route("/logs", methods=["GET"])
def get_logs():
    return jsonify({"status": "ok", "logs": logs})

# ── ENTRY POINT ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    print("=" * 50)
    print("  NetWatch  |  Flask Server Starting")
    print("  Open your browser: http://127.0.0.1:5000")
    print("=" * 50)
    app.run(debug=True)
