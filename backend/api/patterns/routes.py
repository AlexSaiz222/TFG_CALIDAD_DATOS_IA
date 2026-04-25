"""CRUD API for user-scoped and system validation patterns."""
import re
import logging
from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, get_jwt_identity

from extensions import db
from models.validation_pattern import ValidationPattern

logger = logging.getLogger(__name__)
patterns_bp = Blueprint('patterns', __name__, url_prefix='/patterns')


def _get_current_user_id():
    try:
        return int(get_jwt_identity())
    except (TypeError, ValueError):
        return None


@patterns_bp.route('/', methods=['GET'])
@jwt_required()
def list_patterns():
    """Return system patterns and patterns owned by the current user."""
    uid = _get_current_user_id()
    if uid is None:
        return jsonify({"success": False, "error": "invalid_token_identity"}), 401

    patterns = ValidationPattern.query.filter(
        db.or_(ValidationPattern.owner_id.is_(None), ValidationPattern.owner_id == uid)
    ).order_by(ValidationPattern.is_system.desc(), ValidationPattern.name).all()

    return jsonify({"success": True, "patterns": [p.to_dict() for p in patterns]}), 200


@patterns_bp.route('/', methods=['POST'])
@jwt_required()
def create_pattern():
    """Create a custom pattern for the current user."""
    uid = _get_current_user_id()
    if uid is None:
        return jsonify({"success": False, "error": "invalid_token_identity"}), 401

    data = request.get_json(silent=True) or {}
    regex = data.get('regex', '').strip()
    name = data.get('name', '').strip()

    if not name:
        return jsonify({"success": False, "error": "validation_error", "message": "El campo 'name' es obligatorio"}), 400
    if not regex:
        return jsonify({"success": False, "error": "validation_error", "message": "El campo 'regex' es obligatorio"}), 400

    try:
        re.compile(regex)
    except re.error as exc:
        return jsonify({"success": False, "error": "invalid_regex", "message": f"Expresión regular inválida: {exc}"}), 400

    key = data.get('key', '').strip()
    if not key:
        key = re.sub(r'[^a-z0-9_]', '_', name.lower())[:100]

    # Check UNIQUE (owner_id, key)
    existing = ValidationPattern.query.filter_by(owner_id=uid, key=key).first()
    if existing:
        return jsonify({"success": False, "error": "duplicate_key", "message": f"Ya existe un patrón con la clave '{key}'"}), 409

    pattern = ValidationPattern(
        key=key,
        name=name,
        description=data.get('description', ''),
        regex=regex,
        examples_valid=data.get('examples_valid', []),
        examples_invalid=data.get('examples_invalid', []),
        owner_id=uid,
        is_system=False,
    )
    db.session.add(pattern)
    db.session.commit()
    return jsonify({"success": True, "pattern": pattern.to_dict()}), 201


@patterns_bp.route('/<int:pattern_id>', methods=['PUT'])
@jwt_required()
def update_pattern(pattern_id):
    """Update a custom pattern (built-ins are immutable)."""
    uid = _get_current_user_id()
    if uid is None:
        return jsonify({"success": False, "error": "invalid_token_identity"}), 401

    pattern = ValidationPattern.query.get(pattern_id)
    if not pattern:
        return jsonify({"success": False, "error": "not_found", "message": "Patrón no encontrado"}), 404
    if pattern.is_system or pattern.owner_id != uid:
        return jsonify({"success": False, "error": "forbidden", "message": "No tienes permiso para modificar este patrón"}), 403

    data = request.get_json(silent=True) or {}
    regex = data.get('regex', pattern.regex).strip()
    try:
        re.compile(regex)
    except re.error as exc:
        return jsonify({"success": False, "error": "invalid_regex", "message": f"Expresión regular inválida: {exc}"}), 400

    pattern.name = data.get('name', pattern.name).strip() or pattern.name
    pattern.description = data.get('description', pattern.description)
    pattern.regex = regex
    pattern.examples_valid = data.get('examples_valid', pattern.examples_valid)
    pattern.examples_invalid = data.get('examples_invalid', pattern.examples_invalid)
    db.session.commit()
    return jsonify({"success": True, "pattern": pattern.to_dict()}), 200


@patterns_bp.route('/<int:pattern_id>', methods=['DELETE'])
@jwt_required()
def delete_pattern(pattern_id):
    """Delete a custom pattern (built-ins cannot be deleted)."""
    uid = _get_current_user_id()
    if uid is None:
        return jsonify({"success": False, "error": "invalid_token_identity"}), 401

    pattern = ValidationPattern.query.get(pattern_id)
    if not pattern:
        return jsonify({"success": False, "error": "not_found", "message": "Patrón no encontrado"}), 404
    if pattern.is_system or pattern.owner_id != uid:
        return jsonify({"success": False, "error": "forbidden", "message": "No tienes permiso para eliminar este patrón"}), 403

    db.session.delete(pattern)
    db.session.commit()
    return jsonify({"success": True, "message": "Patrón eliminado"}), 200
