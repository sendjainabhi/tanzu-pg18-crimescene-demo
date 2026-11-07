# Tanzu PostgreSQL 18 — 3D Crime Scene Intelligence

An interactive 3D crime-scene investigation demo powered by
VMware Tanzu PostgreSQL 18, PostGIS, pgvector, Flask and Three.js.

The application demonstrates how relational, spatial, JSONB and
vector data can support intelligent investigation workflows
within a single PostgreSQL database.

> This application uses synthetic data and simplified geometry.
> It is intended for demonstration, not forensic use.

---

## 1. Key Features

### Interactive 3D City

- Four buildings: Building A, B, C and D.
- 100 PostgreSQL-backed windows.
- Windows on north, south, east and west facades.
- Trees, vehicles, streetlights, benches and walls.
- Four CCTV cameras with location labels.
- Movable incident marker.
- Interactive rotation, zoom and pan.
- Overview, Top View and Incident View.
- Adjustable building transparency.
- Clickable scene objects.

### PostGIS Spatial Analysis

- 3D spatial geometry storage.
- Nearest-window analysis.
- 3D distance calculations.
- Spatial proximity filtering.
- GiST spatial indexes.
- Dynamic incident-location analysis.

### Smart Visibility

Windows are classified into three categories:

| Classification | Color | Description |
|---|---|---|
| Visible | Green | Clear modeled sightline |
| Obstructed | Red | Physical obstruction detected |
| Not Facing | Amber | Window faces away from incident |

Additional features:

- Configurable visibility-ray count.
- Window highlighting.
- Building obstruction analysis.
- Dynamic obstacle toggling.
- Recalculation after incident movement.

### Clickable Objects

- Buildings: name and height.
- Windows: floor, facade, distance and visibility.
- CCTV: camera identification and available properties.

### CCTV Coverage

- Four PostgreSQL-backed cameras.
- Camera heading, range and field of view.
- Coverage calculations.
- Interactive coverage visualization.
- Show/hide CCTV coverage sectors.

### pgvector Investigation Search

- 60 synthetic investigation cases.
- 384-dimensional stored vectors.
- Cosine similarity ranking.
- Search by investigation description.

The encoder uses deterministic token features,
not a trained semantic embedding model.

### Hybrid PostGIS + pgvector Search

Combines spatial proximity and vector similarity.

Example query:

vehicle obstruction witness

Search within 30, 50 or 100 meters of the incident.

PostGIS filters cases spatially, while pgvector
ranks matching investigations by similarity.

### SQL Inspector and Performance

- Display spatial SQL queries.
- Display hybrid-search SQL.
- Show database round-trip timing.
- Show Python visibility-processing time.
- Show total application analysis time.

---

## 2. Technology Stack

| Component | Technology |
|---|---|
| OS | Rocky Linux 9 |
| Database | VMware Tanzu PostgreSQL 18.6 |
| Spatial Extension | PostGIS 3.6.1 |
| Vector Extension | pgvector 0.8.6 |
| Backend | Python 3.9 / Flask |
| Database Driver | psycopg 3 |
| Visualization | Three.js 0.160.1 |
| Service | systemd |
| HTTP Port | 80 |
| Database Name | crime_scene |

No external JavaScript CDN is required.

---

## 3. Demo Dataset

| Object | Count |
|---|---:|
| Buildings | 4 |
| Windows | 100 |
| Incidents | 1 |
| Scene Objects | 43 |
| CCTV Cameras | 4 |
| Investigation Cases | 60 |

Window distribution:

| Facade | Count |
|---|---:|
| North | 25 |
| South | 25 |
| East | 25 |
| West | 25 |

The scene uses local Cartesian coordinates with SRID 0.
Coordinate units are interpreted as meters.

---

## 4. Repository Structure

    tanzu-pg18-crimescene-demo/
    |
    |-- backend/
    |   |-- app.py
    |   |-- spatial_analysis.py
    |   |-- visibility_engine.py
    |   |-- smart_visibility.py
    |   |-- obstacle_controls.py
    |   |-- cctv_analysis.py
    |   |-- incident_embeddings.py
    |   |-- vector_search.py
    |   |-- hybrid_search.py
    |
    |-- frontend/
    |   |-- index.html
    |   |-- js/
    |   |   |-- main.js
    |   |   |-- api_client.js
    |   |   |-- window_renderer.js
    |   |   |-- visibility_view.js
    |   |   |-- scene_labels.js
    |   |   |-- object_renderer.js
    |   |   |-- obstacle_controls.js
    |   |   |-- investigation_tools.js
    |   |   |-- smart_investigation.js
    |   |   |-- cctv_renderer.js
    |   |
    |   |-- vendor/
    |       |-- three.module.js
    |
    |-- database/
    |   |-- schema.sql
    |
    |-- scripts/
    |   |-- load_scene.py
    |   |-- load_investigations.py
    |
    |-- tests/
    |-- start_demo.sh
    |-- README.md

A requirements.txt file may also be included.

---

## 5. Prerequisites

Recommended VM:

- Rocky Linux 9 x86_64.
- 2 vCPU or more.
- 4 GB RAM or more.
- Sufficient storage for PostgreSQL.
- sudo access.
- Python 3.9 and venv.
- VMware Tanzu PostgreSQL 18.6.
- PostGIS 3.6.1.
- pgvector 0.8.6.
- Approved RPM and Python package repositories.
- Browser supporting WebGL.

---

## 6. Install Tanzu PostgreSQL 18.6

### Official Broadcom Documentation

Broadcom Support Portal:

https://support.broadcom.com/

Broadcom Technical Documentation:

https://techdocs.broadcom.com/

Extension dependency guidance:

https://knowledge.broadcom.com/external/article/436369/missing-extensions-or-library-errors-aft.html

Use the official release-specific installation documentation
for initialization, service management and supported packages.

### Download PostgreSQL

Download the licensed VMware PostgreSQL 18.6 RHEL9
distribution from the Broadcom Support Portal.

Example archive:

    vmware-postgres-18.6.0.el9.x86_64.zip

Transfer it to the VM.

    mkdir -p /mnt/workshop_assets/postgres
    cd /mnt/workshop_assets/postgres
    unzip vmware-postgres-18.6.0.el9.x86_64.zip

Inspect RPM packages:

    find . -type f -name '*.rpm' | sort

### Install PostgreSQL

Install the matching server and libraries RPMs.

Example, using the package filenames from the workshop:

    sudo dnf install \
      ./vmware-postgres18-libs-18.6-1.el9.x86_64.rpm \
      ./vmware-postgres18-18.6-1.el9.x86_64.rpm

Adjust filenames and paths to match the downloaded bundle.

Initialize and start PostgreSQL using the vendor's
documented procedure for this exact release.

Do not run initdb on an existing data directory.

### Configure PATH

Add to ~/.bashrc:

    export PATH=/opt/vmware/postgres/18/bin:$PATH

Reload:

    source ~/.bashrc

Verify:

    psql --version
    pg_isready

Expected PostgreSQL version: 18.6.

---

## 7. Install PostGIS and pgvector

Install the vendor-matched extension RPMs.

    cd /mnt/workshop_assets/postgres

    sudo dnf install \
      ./vmware-postgres18-postgis36-3.6.1-1.el9.x86_64.rpm \
      ./vmware-postgres18-pgvector-0.8.6-1.el9.x86_64.rpm

Use approved repositories for host dependencies.

Verify extension availability:

    psql -U postgres -d postgres -c \
      "SELECT name, default_version
       FROM pg_available_extensions
       WHERE name IN ('postgis','vector');"

Expected:

- PostGIS 3.6.1
- pgvector 0.8.6

---

## 8. Deploy Application Source

Copy or clone the repository onto the VM.

Original application directory:

    /mnt/workshop_assets/tanzu-crime-demo

Navigate to the project:

    cd /mnt/workshop_assets/tanzu-crime-demo

Create a virtual environment:

    python3 -m venv .venv
    source .venv/bin/activate

Install reviewed dependencies:

    python -m pip install -r requirements.txt

If requirements.txt is unavailable, install the
required packages from an approved repository:

    python -m pip install \
      "Flask>=3.0,<3.2" \
      "flask-cors>=4,<7" \
      "psycopg[binary]>=3.2,<3.4" \
      "numpy>=1.26,<2.1" \
      "trimesh>=4,<5"

Verify:

    python -c "import flask, psycopg, numpy, trimesh; print('OK')"

Confirm local Three.js:

    ls -lh frontend/vendor/three.module.js

---

## 9. Initialize the Database

For a fresh installation only:

    createdb -U postgres crime_scene

Run the unified schema:

    psql -U postgres -d crime_scene \
      -v ON_ERROR_STOP=1 \
      -f database/schema.sql

Load scene objects:

    source .venv/bin/activate
    python scripts/load_scene.py

Load synthetic investigation cases:

    python scripts/load_investigations.py

Do not rerun initialization unnecessarily against
an existing populated database.

### Verify Data

    psql -U postgres -d crime_scene -c "
    SELECT
      (SELECT COUNT(*) FROM buildings) AS buildings,
      (SELECT COUNT(*) FROM windows) AS windows,
      (SELECT COUNT(*) FROM incidents) AS incidents,
      (SELECT COUNT(*) FROM scene_objects) AS objects,
      (SELECT COUNT(*) FROM investigation_cases) AS cases;
    "

Expected:

| Buildings | Windows | Incidents | Objects | Cases |
|---:|---:|---:|---:|---:|
| 4 | 100 | 1 | 43 | 60 |

Verify extensions:

    psql -U postgres -d crime_scene -c "
    SELECT extname, extversion
    FROM pg_extension
    WHERE extname IN ('postgis','vector');
    "

---

## 10. Database Configuration

Original workshop settings:

    PGDATABASE=crime_scene
    PGUSER=postgres
    PGHOST=/tmp
    PGPORT=5432

Verify:

    psql -U postgres -d crime_scene \
      -c "SELECT current_database();"

The service account must be able to authenticate
without an interactive password prompt.

For shared deployments, use a dedicated database role
with appropriate privileges.

---

## 11. Start the Demo

The project includes start_demo.sh.

Make it executable:

    chmod +x start_demo.sh

### Manual Mode — Port 5000

    ./start_demo.sh

This starts Flask on:

    http://127.0.0.1:5000

From your Mac:

    ssh -N -L 5000:127.0.0.1:5000 rocky@YOUR_VM_IP

Open:

http://localhost:5000

### Permanent Mode — Port 80

Install the service:

    sudo ./start_demo.sh install

The script checks whether the service exists.

If already installed, it skips recreating the service.
If the existing service is stopped, it starts it.

The service is enabled for automatic startup after reboot.

Service name:

    tanzu-crime-demo.service

Original VM address:

    http://10.85.69.132

The IP address may differ in another deployment.

### Service Commands

| Action | Command |
|---|---|
| Install | sudo ./start_demo.sh install |
| Status | ./start_demo.sh status |
| Restart | sudo ./start_demo.sh restart |
| Stop | sudo ./start_demo.sh stop |
| Logs | ./start_demo.sh logs |

After Python code changes:

    sudo ./start_demo.sh restart

After frontend-only changes, perform a browser hard refresh.

---

## 12. Firewall Configuration

The original VM uses firewalld.

Check the active zone:

    sudo firewall-cmd --get-active-zones
    sudo firewall-cmd --list-all

Restrict HTTP access to approved clients.

Example:

    sudo firewall-cmd --permanent --zone=public \
      --add-rich-rule='rule family="ipv4" source address="YOUR_APPROVED_CLIENT_IP/32" port protocol="tcp" port="80" accept'

Activate the rule:

    sudo firewall-cmd --reload

Verify:

    sudo firewall-cmd --zone=public --list-rich-rules

Do not open the demo to unrestricted networks.

The client VPN address may change between sessions.

---

## 13. Application Verification

From the VM:

    curl -fsS http://127.0.0.1/api/health

Expected:

    "status": "ok"

The response also includes the database name and
may include PostGIS version information.

Check the main endpoints:

    for path in \
      "/" \
      "/api/health" \
      "/api/scene" \
      "/api/objects" \
      "/api/windows/visibility" \
      "/api/windows/smart" \
      "/api/investigations/hybrid?q=vehicle" \
      "/js/main.js" \
      "/js/smart_investigation.js" \
      "/vendor/three.module.js"
    do
      curl -s -o /dev/null \
        -w "%{http_code} $path\n" \
        "http://127.0.0.1$path"
    done

Expected: HTTP 200 for valid requests.

---

## 14. Customer GUI Demonstration

1. Open the 3D Crime Scene Intelligence dashboard.
2. Confirm four buildings and 100 windows appear.
3. Rotate the scene using left mouse drag.
4. Zoom using the mouse wheel.
5. Pan using right mouse drag.
6. Test Overview, Top View and Incident View.
7. Adjust building transparency.
8. Confirm Building A, B, C and D labels.
9. Confirm CCTV 1, CCTV 2, CCTV 3 and CCTV 4 labels.
10. Confirm rectangular windows on all four facades.
11. Click Analyze 3D Visibility.
12. Click Analyze Smart Visibility.
13. Verify green, red and amber classifications.
14. Change displayed ray count to 5, 10 and 20.
15. Rerun Smart Visibility after changing ray count.
16. Toggle visibility rays.
17. Click a building to inspect its details.
18. Click a window to inspect floor and facade.
19. Click a CCTV camera to inspect its information.
20. Enable Move Incident.
21. Click another street location.
22. Confirm the incident marker and label move.
23. Rerun Smart Visibility.
24. Compare the updated classifications.
25. Disable Investigation Test Wall.
26. Rerun visibility analysis.
27. Compare the results.
28. Re-enable Investigation Test Wall.
29. Click Analyze CCTV Coverage.
30. Show the CCTV coverage sectors.
31. Rotate the scene to inspect camera coverage.
32. Hide CCTV coverage sectors.
33. Enter "vehicle obstruction witness".
34. Click Search Similar Cases.
35. Review pgvector similarity results.
36. Enter the same phrase in Hybrid Search.
37. Select a 30-meter search radius.
38. Click Search Nearby Similar Cases.
39. Compare results at 50 and 100 meters.
40. Review the SQL Inspector.
41. Review query performance metrics.
42. Return to Overview.
43. Restore building opacity to 30%.
44. Disable Move Incident.
45. Hide unnecessary overlays.

---

## 15. PostgreSQL Query Examples

### Window Distribution

    SELECT facade, COUNT(*)
    FROM windows
    GROUP BY facade
    ORDER BY facade;

### 3D Distance

    SELECT ST_3DDistance(
      ST_MakePoint(0,0,1.5),
      ST_MakePoint(10,10,12)
    ) AS distance_m;

### CCTV Configuration

    SELECT
      name,
      dimensions->>'heading_deg' AS heading,
      dimensions->>'fov_deg' AS fov,
      dimensions->>'range_m' AS range_m
    FROM scene_objects
    WHERE object_type = 'camera';

### Hybrid Search

PostGIS provides spatial filtering:

    ST_3DDWithin(...)

pgvector provides cosine-distance ranking:

    embedding <=> query_vector

The application combines both capabilities
in a parameterized SQL query.

---

## 16. Troubleshooting

### PostgreSQL Not Found

    export PATH=/opt/vmware/postgres/18/bin:$PATH

### PostgreSQL Connection Error

    pg_isready

    psql -U postgres -d crime_scene \
      -c "SELECT 1;"

### Flask Service Error

    sudo systemctl status tanzu-crime-demo --no-pager

    sudo journalctl -u tanzu-crime-demo -n 100 --no-pager

### Restart Application

    sudo ./start_demo.sh restart

### Port 80 Not Accessible

On VM:

    curl -v http://127.0.0.1/api/health

From Mac:

    curl -v http://YOUR_VM_IP/api/health

Check:

- VPN connectivity.
- firewalld rules.
- Approved source IP.
- Upstream network policies.
- Application service status.

### Blank 3D Viewer

Open browser Developer Tools Console.

Verify:

    curl -I http://127.0.0.1/js/main.js

    curl -I http://127.0.0.1/vendor/three.module.js

### Smart Visibility Error

    curl -fsS \
      "http://127.0.0.1/api/windows/smart?x=0&y=0&z=1.5&k=10"

### Hybrid Search Error

    curl -fsSG \
      --data-urlencode "q=vehicle obstruction witness" \
      --data-urlencode "radius=30" \
      http://127.0.0.1/api/investigations/hybrid

---

## 17. Backup and Recovery

Back up source files:

    mkdir -p /mnt/workshop_assets/project_backups

    tar --exclude='.venv' \
      --exclude='__pycache__' \
      -czf /mnt/workshop_assets/project_backups/crime-scene-source.tar.gz \
      backend frontend database scripts tests start_demo.sh

Back up PostgreSQL:

    pg_dump -U postgres -d crime_scene -Fc \
      -f /mnt/workshop_assets/project_backups/crime-scene-database.dump

Verify:

    pg_restore -l \
      /mnt/workshop_assets/project_backups/crime-scene-database.dump

Test recovery in an isolated environment before
restoring over an existing database.

---

## 18. Git Repository

Repository:

https://github.com/sendjainabhi/tanzu-pg18-crimescene-demo

To commit changes:

    git add -A
    git status
    git commit -m "Update Tanzu PostgreSQL crime scene demo"
    git push origin main

Do not commit:

- Virtual environments.
- Database dumps.
- Credentials.
- Access tokens.
- Private keys.
- Temporary backups.
- Runtime logs.

Review repository visibility and company source-code
policies before publishing.

---

## 19. Security Considerations

This is a workshop demonstration.

The permanent service currently uses Flask's
built-in development server.

For broader or production use:

- Use a production WSGI server.
- Enable HTTPS.
- Add authentication and authorization.
- Use a least-privilege PostgreSQL role.
- Restrict access to trusted networks.
- Protect write-capable APIs.
- Configure appropriate monitoring.

Do not expose the current demo to the public internet.

---

## 20. Customer Value

This demonstration illustrates how Tanzu PostgreSQL
supports modern intelligent applications using multiple
data capabilities within a single database platform.

### PostGIS

Enables 3D spatial storage, proximity analysis,
distance calculations and spatial filtering.

### pgvector

Enables vector storage and similarity ranking
for synthetic investigation cases.

### JSONB

Stores flexible scene-object and CCTV camera configuration.

### PostgreSQL

Provides a common data platform for relational,
spatial, semi-structured and vector workloads.

### Application Integration

Flask exposes the database capabilities through APIs,
while Three.js provides an interactive visualization.

The result is a demonstration of how applications can
combine spatial intelligence and vector search without
requiring separate specialized databases.

---

## 21. Demo Summary

The Tanzu PostgreSQL 3D Crime Scene Intelligence demo
showcases:

- 3D geospatial data management.
- 100-window facade-aware visibility analysis.
- Interactive crime-scene exploration.
- Dynamic obstacles and CCTV coverage.
- Clickable PostgreSQL-backed objects.
- pgvector similarity search.
- Hybrid PostGIS and pgvector queries.
- SQL inspection and performance visibility.
- Persistent VM deployment using Flask and systemd.

**Tanzu PostgreSQL brings relational, geospatial, JSONB
and vector capabilities together in one database.**

