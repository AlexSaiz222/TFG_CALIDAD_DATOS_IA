"""Reordena el capítulo de Resultados: mueve la sección 'Instanciación del marco
ISO/IEC 5259' para que aparezca ANTES de 'Resultados globales' (tras los sprints).
Idempotente-ish con asserts para abortar si la estructura no es la esperada."""
from pathlib import Path

TEX = Path(r"C:\Users\aleja\Documents\GitHub\TFG_CALIDAD_DATOS_IA\docs\TFG\GITA_TFG\chapters\05-desarrollo.tex")

content = TEX.read_text(encoding="utf-8")

R_MARK = "%% =========================================================================\n\\section{Resultados globales}"
I_MARK = "%% =========================================================================\n\\section{Instanciación del marco"
LV_MARK = "% Local Variables:"

idx_R = content.index(R_MARK)
idx_I = content.index(I_MARK)
idx_LV = content.index(LV_MARK)

assert idx_R < idx_I < idx_LV, "Orden inesperado de secciones"

block_R = content[idx_R:idx_I]   # Resultados globales + blanco hasta divisor de Instanciación
block_I = content[idx_I:idx_LV]  # Instanciación + blancos hasta Local Variables

new_content = content[:idx_R] + block_I + block_R + content[idx_LV:]

# Comprobaciones de integridad
assert new_content.count("\\section{Resultados globales}") == 1
assert new_content.count("\\section{Instanciación del marco") == 1
assert new_content.index("\\section{Instanciación del marco") < new_content.index("\\section{Resultados globales}"), \
    "La instanciación debería quedar antes de Resultados globales"
assert len(new_content) == len(content), "Se perdió o duplicó contenido"

TEX.write_text(new_content, encoding="utf-8")
print("OK: Instanciación movida antes de Resultados globales")
