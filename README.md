# Tanzu PostgreSQL 3D Crime Scene Intelligence

## Overview

A synthetic urban investigation workshop demonstrating **Tanzu PostgreSQL 18.6**, **PostGIS 3.6.1** and **pgvector 0.8.6** with Python Flask and a locally hosted Three.js browser viewer.

**Functions:** 3D city objects, nearest-k windows, movable incident location, obstruction-aware sightlines, obstacle toggles, CCTV field-of-view sectors, pgvector similarity search, SQL inspection and application timing.

**Accuracy note:** PostGIS handles 3D spatial storage, proximity and distances. Python handles simplified line-of-sight and CCTV checks. CCTV sectors are approximate horizontal views, and the 384-dimensional vector encoder uses deterministic token features, not a trained semantic model. This is not forensic-grade analysis.

## 1. Prerequisites

- Rocky Linux 9 / RHEL 9-compatible VM (original environment: x86_64).
- Suggested starting resources: 2 vCPU, 4 GB RAM, 5 GB free disk beyond the PostgreSQL installation.
- VMware PostgreSQL **18.6**, running and initialized, with vendor-matched **PostGIS 3.6.1** and **pgvector 0.8.6** packages installed. Avoid mixing incompatible PostgreSQL extension builds.
- Python **3.9** with `venv` and `pip` (the original VM used Python 3.9).
- Approved PyPI/internal package repository or offline wheels. Python packages: Flask, psycopg 3 (binary), NumPy, trimesh, Flask-CORS as needed.
- `psql`, `createdb`, `pg_dump`, `pg_restore`, `curl`, `unzip`, SSH.
- Browser with WebGL enabled.
- `frontend/vendor/three.module.js` from the working application, stored locally. Do not rely on public CDNs in restricted environments.
- Local Unix socket connectivity to PostgreSQL. The original VM uses `/tmp`.

The original demo was developed on Rocky Linux 9. On another operating system, adapt PostgreSQL installation, Python packages, and service commands.

## 2. Repository layout

```text
tanzu-crime-demo/
├── backend/
│   ├── app.py
│   ├── spatial_analysis.py
│   ├── visibility_engine.py
│   ├── obstacle_controls.py
│   ├── cctv_analysis.py
│   ├── incident_embeddings.py
│   └── vector_search.py
├── frontend/
│   ├── index.html
│   ├── js/
│   │   ├── main.js
│   │   ├── api_client.js
│   │   ├── object_renderer.js
│   │   ├── visibility_view.js
│   │   ├── obstacle_controls.js
│   │   ├── investigation_tools.js
│   │   └── cctv_renderer.js
│   └── vendor/three.module.js
├── database/
│   ├── initial_scene.sql
│   ├── schema.sql
│   ├── investigation_schema.sql
│   └── demo_obstruction.sql
├── scripts/
│   ├── load_scene.py
│   └── load_investigations.py
├── tests/test_visibility.py
├── requirements.txt
└── README.md
```

The accompanying download provides **README.md, initial_scene.sql and demo_obstruction.sql**. Keep the other files from your working VM Git export.

## 3. Install and verify Tanzu PostgreSQL

Install and initialize VMware PostgreSQL 18.6 using the approved vendor procedure and matching extension RPMs. Ensure the server is running.

On the original installation, binaries are under `/opt/vmware/postgres/18/bin`. Add them to PATH:

```bash
export PATH="/opt/vmware/postgres/18/bin:$PATH"
psql --version
psql -U postgres -d postgres -c \
  "SELECT name,default_version FROM pg_available_extensions WHERE name IN ('postgis','vector');"
```

For persistence, add the PATH export to `~/.bashrc` and ensure your login shell sources it.

Both extensions must appear as available before proceeding.

## 4. Install application source and Python dependencies

Copy the repository to the VM, for example:

```bash
mkdir -p /mnt/workshop_assets
cd /mnt/workshop_assets
unzip tanzu-crime-scene-intelligence.zip
cd tanzu-crime-demo   # replace with the actual extracted folder name
python3 -m venv .venv
source .venv/bin/activate
```

If the repository has a reviewed `requirements.txt` compatible with Python 3.9:

```bash
python -m pip install -r requirements.txt
```

Otherwise install the application dependencies from your approved package repository:

```bash
python -m pip install "Flask>=2.3,<3.2" \
  "psycopg[binary]>=3.1,<3.4" \
  "numpy>=1.26,<2.1" "trimesh>=4,<5" "flask-cors>=4,<7"
```

For restricted networks, use approved internal PyPI credentials provided securely by your environment, or an offline wheelhouse with `--no-index --find-links`. Never commit credentials or access tokens.

Verify:

```bash
python -c "import flask, psycopg, numpy, trimesh; print('Python OK')"
test -s frontend/vendor/three.module.js && echo "Three.js OK"
```

## 5. Create and populate a NEW demo database

**Run the following sequence only on a fresh `crime_scene` database.** Do not recreate or overwrite your already working VM database. The initial scene uses local Cartesian coordinates (SRID 0) and treats units as meters.

Create database:

```bash
createdb -U postgres crime_scene
```

If it already exists, do not run `createdb` again. Confirm it is an empty intended demo database before seeding.

Create extensions and original city:

```bash
psql -U postgres -d crime_scene -v ON_ERROR_STOP=1 \
  -f database/initial_scene.sql
```

Expected original scene: **4 buildings, 25 windows, 1 incident**.

Create street-object schema and indexes:

```bash
psql -U postgres -d crime_scene -v ON_ERROR_STOP=1 \
  -f database/schema.sql
```

Add vector-case schema and configure camera headings:

```bash
psql -U postgres -d crime_scene -v ON_ERROR_STOP=1 \
  -f database/investigation_schema.sql
```

**Important:** `investigation_schema.sql` must use `mod(...::numeric, 360::numeric)` rather than `mod(double precision, integer)`. If your existing file has the earlier expression, correct it before running.

Load the 42 generated scene objects:

```bash
source .venv/bin/activate
python scripts/load_scene.py
```

Load 60 synthetic vector cases:

```bash
python scripts/load_investigations.py
```

Insert the wall used for the 23-visible/2-blocked workshop scenario:

```bash
psql -U postgres -d crime_scene -v ON_ERROR_STOP=1 \
  -f database/demo_obstruction.sql
```

**Ordering matters:** `initial_scene.sql` creates the base tables; `schema.sql` adds `scene_objects`; `investigation_schema.sql` adds vector cases and CCTV attributes; loaders populate data; `demo_obstruction.sql` adds the test wall. The scene-object loader uses upserts, but always review changes before rerunning it on a modified demo scene.

### Database validation

```bash
psql -U postgres -d crime_scene -c \
  "SELECT extname,extversion FROM pg_extension WHERE extname IN ('postgis','vector');"

psql -U postgres -d crime_scene -c "
SELECT
 (SELECT count(*) FROM buildings) AS buildings,
 (SELECT count(*) FROM windows) AS windows,
 (SELECT count(*) FROM incidents) AS incidents,
 (SELECT count(*) FROM scene_objects) AS objects,
 (SELECT count(*) FROM investigation_cases) AS cases;"
```

Expected on the unmodified seeded demo: **4 / 25 / 1 / 43 / 60**.

Verify the test wall:

```bash
psql -U postgres -d crime_scene -c \
  "SELECT name, enabled FROM scene_objects WHERE name='Investigation Test Wall';"
```

## 6. Configure PostgreSQL connection

The original Flask app uses the local PostgreSQL socket and database user `postgres`:

```bash
export PGDATABASE=crime_scene
export PGUSER=postgres
export PGHOST=/tmp
export PGPORT=5432
psql -U postgres -d crime_scene -c "SELECT current_database();"
```

On other VMs, check `SHOW unix_socket_directories;` and set `PGHOST` accordingly. PostgreSQL authentication must allow the selected local user.

**Security limitation:** The demo's obstacle-update API is unauthenticated and uses the application's database credentials. Keep Flask bound to `127.0.0.1` and access it through an SSH tunnel. For shared or production deployments, use proper authentication and a least-privilege database role.

## 7. Start the application

```bash
cd /mnt/workshop_assets/tanzu-crime-demo
source .venv/bin/activate
python backend/app.py
```

Expected URL: `http://127.0.0.1:5000`. Keep the process running.

From another VM terminal:

```bash
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS http://127.0.0.1:5000/api/scene | python3 -m json.tool | head
curl -fsS http://127.0.0.1:5000/api/objects | python3 -m json.tool | head
curl -fsS 'http://127.0.0.1:5000/api/windows/visibility?x=0&y=0&z=1.5&k=5' | python3 -m json.tool | head
curl -fsS 'http://127.0.0.1:5000/api/cctv/coverage?x=0&y=0&z=1.5' | python3 -m json.tool | head
curl -fsSG --data-urlencode 'q=vehicle obstruction witness' \
  http://127.0.0.1:5000/api/investigations/search | python3 -m json.tool | head
```

On your Mac:

```bash
ssh -N -L 5000:127.0.0.1:5000 rocky@YOUR_VM_HOST
```

Open `http://localhost:5000` in Chrome.

## 8. Customer demo workflow

1. **3D reconstruction:** Show buildings, 25 windows, street objects and the incident.
2. **Visibility analysis:** Click Analyze 3D Visibility. PostGIS selects candidate windows; Python checks simplified 3D obstacles; Three.js draws green/red rays.
3. **Dynamic incident:** Move the incident on the street and rerun analysis.
4. **Obstacle toggle:** Disable/re-enable the Investigation Test Wall; in the original tested scene this changed **23 visible / 2 blocked** to **25 visible / 0 blocked**.
5. **CCTV coverage:** Analyze cameras, show/hide approximate horizontal viewing sectors, and move the incident to compare.
6. **pgvector:** Search synthetic cases with a phrase such as `vehicle obstruction witness`.
7. **SQL and performance:** Show SQL queries and application timings. The database timing includes connection and fetch overhead, not PostgreSQL-only execution time.

## 9. Troubleshooting

| Symptom | Resolution |
|---|---|
| `psql: command not found` | Add `/opt/vmware/postgres/18/bin` to PATH |
| `extension ... is not available` | Install matching vendor PostGIS/pgvector RPMs |
| `relation windows does not exist` | Run `initial_scene.sql` before `schema.sql` |
| `mod(double precision, integer)` | Correct `mod` operands to `numeric` in investigation schema |
| Python DB authentication fails | Check `PGHOST`, `PGUSER`, Unix socket, `pg_hba.conf` |
| Blank 3D page | Check WebGL, browser console, JS paths and local Three.js |
| CCTV sectors missing | Run CCTV analysis; check camera heading/range/FOV |
| No pgvector results | Verify `investigation_cases` contains seeded cases |
| No blocked windows | Check wall `enabled`, incident `(0,0,1.5)` and geometry |

## 10. Backup, rollback and Git

Before changing the running demo:

```bash
mkdir -p /mnt/workshop_assets/project_backups
tar --exclude='.venv' --exclude='backups' \
  -czf /mnt/workshop_assets/project_backups/source.tar.gz \
  backend frontend database scripts tests

pg_dump -U postgres -d crime_scene -Fc \
  -f /mnt/workshop_assets/project_backups/database.dump
```

Restore into a separate empty database when testing recovery. Never restore over the active database without an explicit rollback plan.

Recommended `.gitignore`:

```gitignore
.venv/
__pycache__/
*.pyc
.env
.env.*
!.env.example
backups/
*.dump
*.backup
*.log
*.zip
.DS_Store
```

Keep the locally hosted Three.js module and comply with its upstream license terms.

## Deployment readiness

The three accompanying files fill the missing initial-scene and test-wall setup gaps. **The full fresh-VM deployment still depends on your existing `schema.sql`, `investigation_schema.sql`, Python scripts, Flask frontend source and compatible Three.js library.** Validate on a fresh demo VM before presenting it as a fully tested one-command deployment.
