#!/bin/bash
# Run this on the EC2 to clone prod DB to staging DB
# Usage: bash clone-prod-to-stage-ec2.sh

PGPASSWORD="poultry_user1212"
HOST="poultry-db.c5w6ew4smp2q.ap-south-1.rds.amazonaws.com"
USER="poultry_user"
PROD_DB="poultry"
STAGE_DB="poultry_stage"

echo "=== Cloning $PROD_DB to $STAGE_DB ==="
echo "Step 1: Dumping prod DB..."

PGPASSWORD=$PGPASSWORD pg_dump \
  -h $HOST \
  -U $USER \
  -d $PROD_DB \
  --no-owner \
  --no-acl \
  -f /tmp/prod_dump.sql

echo "Step 2: Dropping all tables in staging..."
PGPASSWORD=$PGPASSWORD psql \
  -h $HOST \
  -U $USER \
  -d $STAGE_DB \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO poultry_user;"

echo "Step 3: Restoring prod dump into staging..."
PGPASSWORD=$PGPASSWORD psql \
  -h $HOST \
  -U $USER \
  -d $STAGE_DB \
  -f /tmp/prod_dump.sql

echo "Step 4: Cleanup..."
rm /tmp/prod_dump.sql

echo "=== Done! $STAGE_DB now mirrors $PROD_DB ==="
