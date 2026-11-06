#!/usr/bin/env bash
set -euo pipefail

# ==============================================
# Tanzu PostgreSQL 3D Crime Scene Intelligence
# Demo Startup Script
# ==============================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# VMware PostgreSQL 18 binaries
export PATH="/opt/vmware/postgres/18/bin:$PATH"

# PostgreSQL connection settings
export PGHOST="${PGHOST:-/tmp}"
export PGPORT="${PGPORT:-5432}"
export PGDATABASE="${PGDATABASE:-crime_scene}"
export PGUSER="${PGUSER:-postgres}"

# Detect VM connection information
VM_USER="${VM_USER:-$(whoami)}"
VM_IP="${VM_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

if [ -z "$VM_IP" ]; then
    VM_IP="YOUR_VM_IP"
fi

print_access_instructions() {
    echo ""
    echo "=============================================="
    echo "        DEMO ACCESS INSTRUCTIONS"
    echo "=============================================="
    echo ""
    echo "On your Mac, open a NEW terminal and run:"
    echo ""
    echo "  ssh -N -L 5000:127.0.0.1:5000 ${VM_USER}@${VM_IP}"
    echo ""
    echo "Keep that Mac terminal open."
    echo ""
    echo "Then open your browser:"
    echo ""
    echo "  http://localhost:5000"
    echo ""
    echo "=============================================="
}

echo ""
echo "=============================================="
echo " Tanzu PostgreSQL 3D Crime Scene Intelligence"
echo "=============================================="
echo ""

cd "$PROJECT_DIR"

# ----------------------------------------------
# Step 1: Check Python virtual environment
# ----------------------------------------------
echo "[1/6] Checking Python virtual environment..."

if [ ! -f ".venv/bin/activate" ]; then
    echo "ERROR: Python virtual environment not found."
    echo "Expected: $PROJECT_DIR/.venv"
    exit 1
fi

source .venv/bin/activate

echo "Python environment activated."
echo ""

# ----------------------------------------------
# Step 2: Check PostgreSQL
# ----------------------------------------------
echo "[2/6] Checking Tanzu PostgreSQL..."

if ! command -v pg_isready >/dev/null 2>&1; then
    echo "ERROR: pg_isready command not found."
    exit 1
fi

if ! pg_isready -h "$PGHOST" -p "$PGPORT" -q; then
    echo "ERROR: PostgreSQL is not accepting connections."
    echo "Host: $PGHOST"
    echo "Port: $PGPORT"
    exit 1
fi

echo "Tanzu PostgreSQL is running."
echo ""

# ----------------------------------------------
# Step 3: Check database connectivity
# ----------------------------------------------
echo "[3/6] Checking crime_scene database..."

if ! psql -X -q -t -A \
    -U "$PGUSER" \
    -d "$PGDATABASE" \
    -c "SELECT 1;" | grep -qx "1"; then

    echo "ERROR: Unable to connect to database."
    echo "Database: $PGDATABASE"
    exit 1
fi

echo "Database connection successful."
echo ""

# ----------------------------------------------
# Step 4: Verify PostGIS and pgvector
# ----------------------------------------------
echo "[4/6] Checking PostgreSQL extensions..."

EXTENSIONS=$(psql -X -q -t -A \
    -U "$PGUSER" \
    -d "$PGDATABASE" \
    -c "
        SELECT extname
        FROM pg_extension
        WHERE extname IN ('postgis', 'vector')
        ORDER BY extname;
    ")

if ! grep -qx "postgis" <<< "$EXTENSIONS"; then
    echo "ERROR: PostGIS extension not installed."
    exit 1
fi

if ! grep -qx "vector" <<< "$EXTENSIONS"; then
    echo "ERROR: pgvector extension not installed."
    exit 1
fi

echo "PostGIS: OK"
echo "pgvector: OK"
echo ""

# ----------------------------------------------
# Step 5: Verify Python dependencies and files
# ----------------------------------------------
echo "[5/6] Checking application dependencies..."

python - <<'PY'
import flask
import psycopg
import numpy
import trimesh

print("Flask: OK")
print("psycopg: OK")
print("NumPy: OK")
print("Trimesh: OK")
PY

for file in \
    backend/app.py \
    frontend/index.html \
    frontend/js/main.js \
    frontend/vendor/three.module.js
do
    if [ ! -f "$file" ]; then
        echo "ERROR: Required file missing: $file"
        exit 1
    fi
done

echo "Application files: OK"
echo ""

# ----------------------------------------------
# Step 6: Start Flask application
# ----------------------------------------------
echo "[6/6] Starting Flask application..."

# Check whether the demo is already running
if curl -fsS --max-time 3 \
    http://127.0.0.1:5000/api/health \
    >/dev/null 2>&1; then

    echo ""
    echo "Demo is already running on port 5000."

    print_access_instructions
    exit 0
fi

# Check whether another application occupies port 5000
if (echo > /dev/tcp/127.0.0.1/5000) \
    >/dev/null 2>&1; then

    echo "ERROR: Port 5000 is already in use."
    echo "Check the process using:"
    echo "  ss -ltnp | grep ':5000'"
    exit 1
fi

print_access_instructions

echo ""
echo "Starting Flask..."
echo "Press Ctrl+C in this VM terminal to stop the demo."
echo ""

exec python backend/app.py