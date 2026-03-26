Check the current state of Flask-Migrate/Alembic migrations in this project.

1. Run `docker exec tfg_calidad_datos_ia-backend-1 flask db current` to see the current migration revision applied to the database.
2. Run `docker exec tfg_calidad_datos_ia-backend-1 flask db heads` to see the latest available revision.
3. Run `docker exec tfg_calidad_datos_ia-backend-1 flask db history --verbose` to show the full migration history.
4. Compare current vs head and report clearly:
   - If up to date: say so.
   - If behind: list which migrations are pending and suggest running `flask db upgrade`.
   - If any errors: show them and suggest a fix.
