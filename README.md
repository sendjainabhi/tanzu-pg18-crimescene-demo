# Tanzu PostgreSQL 3D Crime Scene Intelligence

An interactive **synthetic crime-scene investigation** demo showcasing VMware Tanzu PostgreSQL 18.6 with PostGIS 3.6.1, pgvector 0.8.6, Python Flask and locally hosted Three.js.

## Capabilities

- Reconstruct an urban scene from PostgreSQL building footprints, windows and object metadata.
- Move an incident and query the nearest windows using PostGIS 3D distances.
- Show unobstructed and blocked sightlines, and toggle trees, vehicles and walls in the database.
- Analyze potential CCTV coverage and render approximate horizontal camera viewing sectors.
- Search synthetic investigation cases using pgvector cosine similarity.
- Inspect SQL and application processing times.

**Demo limitations:** PostGIS provides spatial storage, filtering and distance functions. Python computes simplified box/sphere obstruction and camera-angle tests. Three.js renders results. CCTV is not calibrated video coverage; deterministic hashed-token vectors are not trained semantic embeddings. This is not forensic-grade software.

## 1. Prerequisites

| Requirement | Version / notes |
|---|---|
| OS | Rocky Linux 9 / compatible RHEL 9 x86_64 (original environment) |
| Resources | Suggested starting point: 2 vCPU, 4 GB RAM, additional disk for PostgreSQL |
| Database | VMware Tanzu PostgreSQL **18.6** |
| Extensions | Vendor-matched **PostGIS 3.6.1** and **pgvector 0.8.6** |
| Python | **3.9** used on original VM, `venv`, `pip` |
| Python dependencies | Flask, psycopg[binary], NumPy, trimesh; Flask-CORS if needed |
| Browser | WebGL-capable Chrome or equivalent |
| Access | SSH to VM; Flask stays bound to 127.0.0.1 |
| Three.js | Local `frontend/vendor/three.module.js` (no CDN required) |

### Official Broadcom references

- [Broadcom Support Portal](https://support.broadcom.com/) — download **Postgres Server and Extensions 18.6.0 for RHEL9** for your entitlement.
- [Broadcom TechDocs](https://techdocs.broadcom.com/) — locate the version-specific *VMware Tanzu for Postgres 18.6* installation, initialization and supported extensions instructions.
- [Broadcom KB: extension dependency issues](https://knowledge.broadcom.com/external/article/436369/missing-extensions-or-library-errors-aft.html) — host-library and extension package troubleshooting.

Vendor documentation may require authentication. Confirm service unit, data directory and `initdb` procedure against the release documentation; **do not initialize an existing data directory**.

## 2. Install VMware PostgreSQL and extensions on a new VM

Transfer the official RHEL9 bundle to the VM, then:

```bash
mkdir -p /mnt/workshop_assets/postgres
cd /mnt/workshop_assets/postgres
unzip vmware-postgres-18.6.0.el9.x86_64.zip
find . -type f -name '*.rpm' | sort
```

The original working VM had these RPM package identities:

```text
vmware-postgres18-18.6-1.el9.x86_64
vmware-postgres18-libs-18.6-1.el9.x86_64
vmware-postgres18-postgis36-3.6.1-1.el9.x86_64
vmware-postgres18-pgvector-0.8.6-1.el9.x86_64
```

Find the matching **actual filenames** before installing. For a fresh server, using the RPMs from the extracted bundle:

```bash
sudo dnf install \
  ./vmware-postgres18-libs-18.6-1.el9.x86_64.rpm \
  ./vmware-postgres18-18.6-1.el9.x86_64.rpm
```

Use the exact extracted paths if they differ. Do not mix community PostgreSQL extension packages with this vendor build. Initialize/start the server following the vendor's 18.6 procedure; service names and data directories can differ.

```bash
systemctl list-unit-files | grep -Ei 'postgres|vmware'
rpm -ql vmware-postgres18 | grep -E 'systemd|initdb|service'
```

Then install matching extensions:

```bash
cd /mnt/workshop_assets/postgres
sudo dnf install --assumeno \
  ./vmware-postgres18-postgis36-3.6.1-1.el9.x86_64.rpm \
  ./vmware-postgres18-pgvector-0.8.6-1.el9.x86_64.rpm

sudo dnf install \
  ./vmware-postgres18-postgis36-3.6.1-1.el9.x86_64.rpm \
  ./vmware-postgres18-pgvector-0.8.6-1.el9.x86_64.rpm
```

`dnf` may require additional libraries such as `libdeflate` and `xerces-c`; use approved repositories. Never bypass dependencies using `--nodeps`.

Verify and configure PATH:

```bash
export PATH=/opt/vmware/postgres/18/bin:$PATH
psql --version
pg_isready
ls /opt/vmware/postgres/18/share/extension/ | grep -E '^(postgis|vector)\.control$'
```

Add the PATH export to `~/.bashrc` to persist across logins.

## 3. Deploy source and Python environment

Clone your approved Git repository or extract the source ZIP. Example:

```bash
mkdir -p /mnt/workshop_assets
cd /mnt/workshop_assets
# git clone <approved-repository-url> tanzu-crime-demo
cd tanzu-crime-demo
python3 -m venv .venv
source .venv/bin/activate
```

If you have a reviewed, compatible `requirements.txt`:

```bash
python -m pip install -r requirements.txt
```

Otherwise install the dependencies using an approved PyPI repository or offline wheelhouse:

```bash
python -m pip install 'Flask>=2.3,<3.2' 'psycopg[binary]>=3.1,<3.4' \
  'numpy>=1.26,<2.1' 'trimesh>=4,<5' 'flask-cors>=4,<7'
```

On a restricted VM, use an approved internal package index or `pip install --no-index --find-links /path/to/wheels ...`. Never commit internal repository credentials. Verify `frontend/vendor/three.module.js` is present.

## 4. Initialize a **fresh** crime_scene database

**Do not run these steps on an already populated production or demo database.** The unified `database/schema.sql` contains all table definitions, extensions, indexes, original four buildings, 25 windows, one incident, test wall, and camera defaults. It is designed to be rerunnable without deleting records, but it is primarily intended for an empty demo database.

```bash
export PATH=/opt/vmware/postgres/18/bin:$PATH
createdb -U postgres crime_scene
cd /mnt/workshop_assets/tanzu-crime-demo
psql -U postgres -d crime_scene -v ON_ERROR_STOP=1 -f database/schema.sql
source .venv/bin/activate
python scripts/load_scene.py
python scripts/load_investigations.py
```

**Why the order matters:** `schema.sql` creates the `scene_objects` table and a camera-default trigger. `load_scene.py` then inserts 42 street objects, including four cameras; the trigger supplies `heading_deg`, `fov_deg` and `range_m`. `load_investigations.py` inserts 60 synthetic vector cases. The test wall is inserted by the schema itself.

**No longer run** the retired files `database/initial_scene.sql`, `database/investigation_schema.sql`, or `database/demo_obstruction.sql`. The combined schema replaces them.

Expected counts:

```bash
psql -U postgres -d crime_scene -c "
SELECT (SELECT count(*) FROM buildings) buildings,
       (SELECT count(*) FROM windows) windows,
       (SELECT count(*) FROM incidents) incidents,
       (SELECT count(*) FROM scene_objects) objects,
       (SELECT count(*) FROM investigation_cases) cases;"
```

Expected on a clean seeded demo: **4 buildings, 25 windows, 1 incident, 43 objects (42 generated + test wall), 60 cases**.

Check extensions and camera settings:

```bash
psql -U postgres -d crime_scene -c \
  "SELECT extname,extversion FROM pg_extension WHERE extname IN ('postgis','vector');"
psql -U postgres -d crime_scene -c \
  "SELECT name, dimensions->>'heading_deg' heading, dimensions->>'fov_deg' fov, dimensions->>'range_m' range FROM scene_objects WHERE object_type='camera';"
```

## 5. Run the already deployed demo

```bash
cd /mnt/workshop_assets/tanzu-crime-demo
chmod +x start_demo.sh
./start_demo.sh
```

`start_demo.sh` should configure VMware PostgreSQL binaries, activate `.venv`, check the database/extensions and Python dependencies, detect an already running demo, and start Flask on `127.0.0.1:5000`. The script prints the SSH tunnel command for the Mac. If the script is absent from your repository, copy the working version from your VM before publishing.

On your Mac, in another terminal:

```bash
ssh -N -L 5000:127.0.0.1:5000 rocky@YOUR_VM_IP
```

Open **http://localhost:5000** in a WebGL-capable browser. Use the VM hostname or reachable IP that you normally SSH into, rather than assuming the first interface IP is reachable.

To stop the demo, press `Ctrl+C` in the VM Flask terminal; stop the SSH tunnel with `Ctrl+C` on your Mac.

## 6. API and application validation

```bash
curl -fsS http://127.0.0.1:5000/api/health
curl -fsS http://127.0.0.1:5000/api/scene | python3 -m json.tool | head
curl -fsS http://127.0.0.1:5000/api/objects | python3 -m json.tool | head
curl -fsS 'http://127.0.0.1:5000/api/windows/visibility?x=0&y=0&z=1.5&k=5' | python3 -m json.tool | head
curl -fsS 'http://127.0.0.1:5000/api/cctv/coverage?x=0&y=0&z=1.5' | python3 -m json.tool | head
curl -fsSG --data-urlencode 'q=vehicle obstruction witness' \
  http://127.0.0.1:5000/api/investigations/search | python3 -m json.tool | head
python tests/test_visibility.py
```

Demo flow: analyze windows, move incident, toggle the investigation wall (original test: **23 visible / 2 blocked** versus **25 / 0**), analyze CCTV, show/hide camera sectors, search similar synthetic cases, inspect SQL and timings.

## 7. Troubleshooting

| Problem | Check |
|---|---|
| `psql` not found | Add `/opt/vmware/postgres/18/bin` to PATH |
| Extensions unavailable | Install vendor-matched extension RPMs before running schema |
| `relation windows does not exist` | Run unified schema in a fresh database before loaders |
| `mod(double precision, integer)` | Use the corrected numeric cast in this unified schema |
| Flask DB connection fails | Check PostgreSQL service, `/tmp` Unix socket, `PGHOST`, `PGUSER` and `pg_hba.conf` |
| Browser blank | Check WebGL, browser console, `/js/main.js`, `/vendor/three.module.js` |
| CCTV cones missing | Click Analyze CCTV Coverage; inspect camera heading/range/FOV |
| Vector results missing | Verify 60 `investigation_cases` records and vector extension |
| No blocked windows | Ensure test wall enabled and incident at `(0,0,1.5)` |

## 8. Security, backups and Git hygiene

The workshop obstacle toggle API uses the application's PostgreSQL account and is unauthenticated. **Do not expose this Flask development server to an untrusted network.** Keep it on localhost and use SSH port forwarding. For shared deployments, add authentication and least-privilege database roles.

Back up before upgrading:

```bash
mkdir -p /mnt/workshop_assets/project_backups
pg_dump -U postgres -d crime_scene -Fc \
  -f /mnt/workshop_assets/project_backups/crime-scene.dump
tar --exclude='.venv' --exclude='backups' -czf \
  /mnt/workshop_assets/project_backups/crime-scene-source.tar.gz \
  backend frontend database scripts tests
```

Do not commit database dumps, credentials, `.venv`, `__pycache__`, logs, or private package repository tokens. Keep third-party license notices for the bundled Three.js module. Use `.gitignore`:

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

## 9. Git update

Once validated on a **fresh test database**, replace `database/schema.sql` and `README.md` in your repository. Remove the retired SQL files **from Git only after verifying they are no longer referenced**:

```bash
git add database/schema.sql README.md
git rm database/initial_scene.sql database/investigation_schema.sql database/demo_obstruction.sql  # only if tracked
# Review staged changes and secrets before committing.
git status
git commit -m "Consolidate crime scene database schema and deployment guide"
git push origin main
```

**Compatibility note:** This unified schema was authored from the working demo's documented table structure and sample data. It has not been executed against your VM. Always test in a separate empty `crime_scene` database before relying on it for a customer workshop.
