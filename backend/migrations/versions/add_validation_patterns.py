"""Add validation_patterns table with built-in seed data

Revision ID: add_validation_patterns
Revises: add_affected_rows_pct
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.sql import table, column
from datetime import datetime


revision = 'add_validation_patterns'
down_revision = 'add_affected_rows_pct'
branch_labels = None
depends_on = None

_BUILT_IN_PATTERNS = [
    {
        "key": "email",
        "name": "Email",
        "description": "Dirección de correo electrónico válida",
        "regex": r"^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$",
        "examples_valid": ["usuario@ejemplo.com", "nombre.apellido@empresa.org"],
        "examples_invalid": ["sin-arroba", "doble@@ejemplo.com"],
    },
    {
        "key": "url",
        "name": "URL",
        "description": "URL con protocolo http o https",
        "regex": r"^https?://[^\s]+$",
        "examples_valid": ["https://www.ejemplo.com", "http://api.servicio.io/v1"],
        "examples_invalid": ["ftp://archivo.zip", "sin-protocolo.com"],
    },
    {
        "key": "phone_es",
        "name": "Teléfono (España)",
        "description": "Número de teléfono español (móvil o fijo)",
        "regex": r"^(\+34)?[6-9]\d{8}$",
        "examples_valid": ["612345678", "+34612345678"],
        "examples_invalid": ["123456789", "6123456"],
    },
    {
        "key": "phone_intl",
        "name": "Teléfono (internacional)",
        "description": "Número de teléfono en formato internacional",
        "regex": r"^\+?\d{1,4}[\s\-]?\(?\d{1,4}\)?[\s\-]?\d{4,14}$",
        "examples_valid": ["+1 800 5551234", "+44 20 71234567"],
        "examples_invalid": ["abc", "+++1234"],
    },
    {
        "key": "dni_es",
        "name": "DNI (España)",
        "description": "Documento Nacional de Identidad español",
        "regex": r"^\d{8}[A-Za-z]$",
        "examples_valid": ["12345678Z", "98765432A"],
        "examples_invalid": ["1234567Z", "123456789"],
    },
    {
        "key": "date_iso",
        "name": "Fecha ISO (YYYY-MM-DD)",
        "description": "Fecha en formato ISO 8601",
        "regex": r"^\d{4}-\d{2}-\d{2}$",
        "examples_valid": ["2024-01-15", "1990-12-31"],
        "examples_invalid": ["15/01/2024", "2024-1-5"],
    },
    {
        "key": "date_eu",
        "name": "Fecha europea (DD/MM/YYYY)",
        "description": "Fecha en formato europeo",
        "regex": r"^\d{2}/\d{2}/\d{4}$",
        "examples_valid": ["15/01/2024", "31/12/1990"],
        "examples_invalid": ["2024-01-15", "1/1/2024"],
    },
    {
        "key": "integer",
        "name": "Entero",
        "description": "Número entero positivo o negativo",
        "regex": r"^-?\d+$",
        "examples_valid": ["42", "-7", "0"],
        "examples_invalid": ["3.14", "abc"],
    },
    {
        "key": "decimal",
        "name": "Decimal",
        "description": "Número decimal con punto o coma",
        "regex": r"^-?\d+[.,]?\d*$",
        "examples_valid": ["3.14", "3,14", "-7.5"],
        "examples_invalid": ["abc", "3.14.15"],
    },
    {
        "key": "uuid",
        "name": "UUID",
        "description": "Identificador único universal (formato estándar)",
        "regex": r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
        "examples_valid": ["550e8400-e29b-41d4-a716-446655440000"],
        "examples_invalid": ["550e8400-e29b-41d4-a716", "not-a-uuid"],
    },
    {
        "key": "ip_v4",
        "name": "Dirección IPv4",
        "description": "Dirección IP versión 4",
        "regex": r"^(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)$",
        "examples_valid": ["192.168.1.1", "10.0.0.255"],
        "examples_invalid": ["256.0.0.1", "192.168.1"],
    },
    {
        "key": "postal_code_es",
        "name": "Código postal (España)",
        "description": "Código postal español de 5 dígitos",
        "regex": r"^\d{5}$",
        "examples_valid": ["28001", "08080"],
        "examples_invalid": ["2800", "280011"],
    },
    {
        "key": "credit_card",
        "name": "Tarjeta de crédito",
        "description": "Número de tarjeta de crédito (16 dígitos, con o sin separadores)",
        "regex": r"^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$",
        "examples_valid": ["4111111111111111", "4111-1111-1111-1111"],
        "examples_invalid": ["411111111111", "4111 1111"],
    },
]


def upgrade():
    op.create_table(
        'validation_patterns',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('key', sa.String(100), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('regex', sa.Text(), nullable=False),
        sa.Column('examples_valid', sa.JSON(), nullable=True),
        sa.Column('examples_invalid', sa.JSON(), nullable=True),
        sa.Column('owner_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_system', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
        sa.UniqueConstraint('owner_id', 'key', name='uq_validation_pattern_owner_key'),
    )
    op.create_index('ix_validation_patterns_owner_id', 'validation_patterns', ['owner_id'])

    # Seed built-in patterns
    vp_table = table(
        'validation_patterns',
        column('key', sa.String),
        column('name', sa.String),
        column('description', sa.Text),
        column('regex', sa.Text),
        column('examples_valid', sa.JSON),
        column('examples_invalid', sa.JSON),
        column('owner_id', sa.Integer),
        column('is_system', sa.Boolean),
        column('created_at', sa.DateTime),
        column('updated_at', sa.DateTime),
    )
    now = datetime.utcnow()
    rows = [
        {
            'key': p['key'],
            'name': p['name'],
            'description': p['description'],
            'regex': p['regex'],
            'examples_valid': p['examples_valid'],
            'examples_invalid': p['examples_invalid'],
            'owner_id': None,
            'is_system': True,
            'created_at': now,
            'updated_at': now,
        }
        for p in _BUILT_IN_PATTERNS
    ]
    op.bulk_insert(vp_table, rows)


def downgrade():
    op.drop_index('ix_validation_patterns_owner_id', table_name='validation_patterns')
    op.drop_table('validation_patterns')
