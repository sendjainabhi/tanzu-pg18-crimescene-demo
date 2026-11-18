#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Tanzu PostgreSQL 3D Crime Scene Intelligence
# Startup and Permanent Deployment Manager
#
# Platform: Rocky Linux 9
# Database: VMware Tanzu PostgreSQL 18
# Application: Flask + Three.js
# ============================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SERVICE="tanzu-crime-demo"
SERVICE_FILE="/etc/systemd/system/${SERVICE}.service"

VENV="${PROJECT_DIR}/.venv"
PYTHON="${VENV}/bin/python"

PG_BIN="/opt/vmware/postgres/18/bin"

export PATH="${PG_BIN}:${PATH}"

export PGHOST="${PGHOST:-/tmp}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-crime_scene}"
export PGUSER="${PGUSER:-postgres}"

VM_USER="${SUDO_USER:-$(whoami)}"

VM_IP="${VM_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

if [ -z "$VM_IP" ]; then
    VM_IP="YOUR_VM_IP"
fi

# ------------------------------------------------------------
# Display header
# ------------------------------------------------------------

header() {
    echo ""
    echo "=================================================="
    echo " Tanzu PostgreSQL 3D Crime Scene Intelligence"
    echo "=================================================="
    echo ""
}

# ------------------------------------------------------------
# Check application environment
# ------------------------------------------------------------

check_environment() {
    echo "[1/5] Checking Python environment..."

    if [ ! -x "$PYTHON" ]; then
        echo "ERROR: Python virtual environment not found."
        echo "Expected: $PYTHON"
        exit 1
    fi

    echo "Python environment: OK"

    echo "[2/5] Checking Tanzu PostgreSQL..."

    if ! command -v pg_isready >/dev/null 2>&1; then
        echo "ERROR: PostgreSQL utilities not found."
        exit 1
    fi

    if ! pg_isready -h "$PGHOST" -p "$PGPORT" -q; then
        echo "ERROR: PostgreSQL is not accepting connections."
        exit 1
    fi

    echo "PostgreSQL: OK"

    echo "[3/5] Checking database connectivity..."

    if ! psql -X -q -t -A -w \
        -U "$PGUSER" \
        -d "$PGDATABASE" \
        -c "SELECT 1;" | grep -qx "1"; then

        echo "ERROR: Unable to connect to database."
        exit 1
    fi

    echo "Database: OK"

    echo "[4/5] Checking PostgreSQL extensions..."

    EXTENSIONS=$(psql -X -q -t -A -w \
        -U "$PGUSER" \
        -d "$PGDATABASE" \
        -c "
            SELECT extname
            FROM pg_extension
            WHERE extname IN ('postgis', 'vector')
            ORDER BY extname;
        ")

    if ! grep -qx "postgis" <<< "$EXTENSIONS"; then
        echo "ERROR: PostGIS extension not enabled."
        exit 1
    fi

    if ! grep -qx "vector" <<< "$EXTENSIONS"; then
        echo "ERROR: pgvector extension not enabled."
        exit 1
    fi

    echo "PostGIS: OK"
    echo "pgvector: OK"

    echo "[5/5] Checking application files..."

    "$PYTHON" -c \
      "import flask, psycopg, numpy, trimesh"

    for file in \
        backend/app.py \
        frontend/index.html \
        frontend/js/main.js \
        frontend/vendor/three.module.js
    do
        if [ ! -f "$PROJECT_DIR/$file" ]; then
            echo "ERROR: Missing file: $file"
            exit 1
        fi
    done

    echo "Application files: OK"
    echo ""
    echo "All environment checks passed."
}

# ------------------------------------------------------------
# Display browser access instructions
# ------------------------------------------------------------

show_access() {
    local port="$1"

    echo ""
    echo "=================================================="
    echo "             DEMO ACCESS INSTRUCTIONS"
    echo "=================================================="
    echo ""

    if [ "$port" = "80" ]; then
        echo "Permanent service URL:"
        echo ""
        echo "  http://${VM_IP}"
        echo ""
        echo "Open this URL on your Mac browser."
        echo "Connect to the approved VPN/network first."
    else
        echo "On your Mac, open a NEW terminal and run:"
        echo ""
        echo "  ssh -N -L 5000:127.0.0.1:5000 ${VM_USER}@${VM_IP}"
        echo ""
        echo "Then open:"
        echo ""
        echo "  http://localhost:5000"
    fi

    echo ""
    echo "=================================================="
    echo ""
}

# ------------------------------------------------------------
# Install permanent systemd service
# ------------------------------------------------------------

install_service() {
    if [ "$EUID" -ne 0 ]; then
        echo "ERROR: Installation requires sudo."
        echo "Run: sudo ./start_demo.sh install"
        exit 1
    fi

    echo "Checking existing service..."

    # Service already exists: skip installation.
    if [ -f "$SERVICE_FILE" ]; then
        echo ""
        echo "Service already installed."
        echo "Skipping service creation."

        systemctl daemon-reload

        if systemctl is-active --quiet "$SERVICE"; then
            echo "Service is already running."
        else
            echo "Service exists but is not running."
            echo "Starting existing service..."
            systemctl start "$SERVICE"
        fi

        echo ""
        systemctl --no-pager status "$SERVICE"
        show_access 80

        return 0
    fi

    # Ensure application user exists.
    if ! id rocky >/dev/null 2>&1; then
        echo "ERROR: User rocky does not exist."
        exit 1
    fi

    if [ ! -x "$PYTHON" ]; then
        echo "ERROR: Python environment missing: $PYTHON"
        exit 1
    fi

    echo ""
    echo "Installing permanent Flask service..."

    cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Tanzu PostgreSQL 3D Crime Scene Intelligence
After=network.target

[Service]
Type=simple
User=rocky
Group=rocky

WorkingDirectory=$PROJECT_DIR

Environment=PATH=$VENV/bin:$PG_BIN:/usr/local/bin:/usr/bin
Environment=PGHOST=$PGHOST
Environment=PGPORT=$PGPORT
Environment=PGDATABASE=$PGDATABASE
Environment=PGUSER=$PGUSER
Environment=PYTHONUNBUFFERED=1

ExecStart=$PYTHON -m flask --app backend/app.py run --host=0.0.0.0 --port=80 --no-debugger --no-reload

Restart=on-failure
RestartSec=5

AmbientCapabilities=CAP_NET_BIND_SERVICE
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable --now "$SERVICE"

    echo ""
    echo "Permanent service installed successfully."

    systemctl --no-pager status "$SERVICE"

    show_access 80
}

# ------------------------------------------------------------
# Start Flask manually on port 5000
# ------------------------------------------------------------

run_manual() {
    cd "$PROJECT_DIR"

    check_environment

    if curl -fsS --max-time 3 \
        http://127.0.0.1:5000/api/health \
        >/dev/null 2>&1; then

        echo "Demo is already running on port 5000."
        show_access 5000
        return 0
    fi

    if (echo > /dev/tcp/127.0.0.1/5000) \
        >/dev/null 2>&1; then

        echo "ERROR: Port 5000 is occupied."
        echo "Check using: ss -ltnp | grep ':5000'"
        exit 1
    fi

    show_access 5000

    echo "Starting Flask manually on port 5000..."
    echo "Press Ctrl+C to stop."
    echo ""

    exec "$PYTHON" -m flask \
        --app backend/app.py run \
        --host=127.0.0.1 \
        --port=5000 \
        --no-debugger \
        --no-reload
}

# ------------------------------------------------------------
# Main command handler
# ------------------------------------------------------------

case "${1:-run}" in

    run)
        header
        run_manual
        ;;

    install)
        header
        install_service
        ;;

    status)
        systemctl --no-pager status "$SERVICE"
        ;;

    restart)
        if [ "$EUID" -ne 0 ]; then
            echo "Run: sudo ./start_demo.sh restart"
            exit 1
        fi

        systemctl restart "$SERVICE"
        systemctl --no-pager status "$SERVICE"
        show_access 80
        ;;

    stop)
        if [ "$EUID" -ne 0 ]; then
            echo "Run: sudo ./start_demo.sh stop"
            exit 1
        fi

        systemctl stop "$SERVICE"
        echo "Service stopped."
        ;;

    logs)
        journalctl -u "$SERVICE" -n 100 --no-pager
        ;;

    *)
        echo "Usage:"
        echo ""
        echo "  ./start_demo.sh"
        echo "  sudo ./start_demo.sh install"
        echo "  ./start_demo.sh status"
        echo "  sudo ./start_demo.sh restart"
        echo "  sudo ./start_demo.sh stop"
        echo "  ./start_demo.sh logs"
        exit 1
        ;;
esac
