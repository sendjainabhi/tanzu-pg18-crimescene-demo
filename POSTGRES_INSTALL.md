# VMware Tanzu PostgreSQL 18.6 Installation

## Prerequisites

- Rocky Linux 9 / RHEL 9-compatible VM (x86_64)
- Minimum suggested resources: 2 vCPU, 4 GB RAM
- Root or sudo privileges
- VMware PostgreSQL 18.6 distribution for RHEL9
- PostGIS 3.6.1 and pgvector 0.8.6 vendor RPMs
- Access to approved package repositories for dependencies

## Official Broadcom Resources

- Broadcom Support Portal: https://support.broadcom.com/
- Broadcom Documentation: https://techdocs.broadcom.com/
- PostgreSQL extension dependency guidance:
  https://knowledge.broadcom.com/external/article/436369/missing-extensions-or-library-errors-aft.html

Refer to the VMware Tanzu for Postgres 18.6 release documentation
for the supported installation, initialization and service procedures.

## 1. Download VMware PostgreSQL

Download the following package from the Broadcom Support Portal:

Postgres Server and Extensions 18.6.0 for RHEL9

Archive:

vmware-postgres-18.6.0.el9.x86_64.zip

Transfer the archive to the VM.

```bash
mkdir -p /mnt/workshop_assets/postgres
cd /mnt/workshop_assets/postgres

unzip vmware-postgres-18.6.0.el9.x86_64.zip
```

## 2. Install PostgreSQL

Locate the RPM packages:

```bash
find /mnt/workshop_assets/postgres -type f -name '*.rpm'
```

Install the matching VMware PostgreSQL server and libraries RPMs.

For the package filenames used in the original workshop:

```bash
sudo dnf install \
  ./vmware-postgres18-libs-18.6-1.el9.x86_64.rpm \
  ./vmware-postgres18-18.6-1.el9.x86_64.rpm
```

Substitute the actual RPM paths if your extracted package names differ.

## 3. Initialize and Start PostgreSQL

Identify the vendor-installed service:

```bash
systemctl list-unit-files | grep -Ei 'postgres|vmware'
```

Check the installed PostgreSQL files:

```bash
rpm -ql vmware-postgres18 | grep -E 'systemd|initdb|service'
```

Initialize and start PostgreSQL using the commands documented
for your exact VMware PostgreSQL 18.6 installation.

Do not initialize an existing PostgreSQL data directory.

Verify:

```bash
/opt/vmware/postgres/18/bin/psql --version
```

## 4. Install PostGIS and pgvector

```bash
cd /mnt/workshop_assets/postgres

sudo dnf install \
  ./vmware-postgres18-postgis36-3.6.1-1.el9.x86_64.rpm \
  ./vmware-postgres18-pgvector-0.8.6-1.el9.x86_64.rpm
```

Allow DNF to resolve dependencies from approved repositories.

Verify:

```bash
rpm -qa | grep -Ei 'vmware-postgres18-(postgis|pgvector)'
```

## 5. Configure PostgreSQL PATH

```bash
echo 'export PATH=/opt/vmware/postgres/18/bin:$PATH' >> ~/.bashrc

source ~/.bashrc

psql --version
```

## 6. Create the Demo Database

```bash
createdb -U postgres crime_scene
```

Skip this command if the database already exists.

Enable the extensions:

```bash
psql -U postgres -d crime_scene
```

Execute:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

Verify:

```sql
SELECT extname, extversion
FROM pg_extension
WHERE extname IN ('postgis', 'vector');
```

Expected versions:

- postgis: 3.6.1
- vector: 0.8.6

## 7. Verify 3D Spatial Capabilities

```sql
SELECT ST_3DDistance(
    ST_MakePoint(0,0,1.5),
    ST_MakePoint(10,10,12)
) AS distance_meters;
```

Expected result: approximately 17.6139.

## 8. Continue Application Deployment

Return to README.md and follow the application setup,
database initialization, Python dependency installation,
and Flask startup instructions.

For fresh installations, the database initialization order is:

1. database/initial_scene.sql
2. database/schema.sql
3. database/investigation_schema.sql
4. scripts/load_scene.py
5. scripts/load_investigations.py
6. database/demo_obstruction.sql

The initial-scene and obstruction scripts must be present
in the repository before a fresh deployment.
