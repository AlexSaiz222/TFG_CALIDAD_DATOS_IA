"""
Script to run the add_issue_type_and_fingerprint migration
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text

def run_migration():
    """Execute the migration SQL file"""
    migration_file = 'migrations/add_issue_type_and_fingerprint.sql'
    
    with app.app_context():
        try:
            # Read migration file
            with open(migration_file, 'r') as f:
                sql = f.read()
            
            # Execute migration
            db.session.execute(text(sql))
            db.session.commit()
            
            print("✅ Migration completed successfully!")
            print("   - Added issue_type column to issues table")
            print("   - Added fingerprint column to issues table")
            print("   - Created index on fingerprint")
            print("   - Updated existing issues with inferred issue_type")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {e}")
            sys.exit(1)

if __name__ == '__main__':
    run_migration()
