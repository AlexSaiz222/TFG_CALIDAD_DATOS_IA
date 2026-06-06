# -*- coding: utf-8 -*-
import re
path = r"C:/Users/aleja/Documents/GitHub/TFG_CALIDAD_DATOS_IA/docs/TFG/GITA_TFG/chapters/05-desarrollo.tex"
with open(path, encoding="utf-8") as f:
    lines = f.readlines()

targets = ["Estado del producto", "Estimación vs.\\ real"]
patterns = [re.compile(r'^' + re.escape(t) + r'\s*&') for t in targets]
removed = [0, 0]

out = []
i = 0
n = len(lines)
while i < n:
    stripped = lines[i].lstrip()
    hit = None
    for k, p in enumerate(patterns):
        if p.match(stripped):
            hit = k
            break
    if hit is not None:
        removed[hit] += 1
        j = i
        while j < n and not lines[j].rstrip().endswith(r"\\"):
            j += 1
        i = j + 1            # saltar toda la fila (hasta la línea que acaba en \\)
        continue
    out.append(lines[i])
    i += 1

assert removed[0] == 6, ("Estado del producto", removed[0])
assert removed[1] == 6, ("Estimación vs real", removed[1])

with open(path, "w", encoding="utf-8") as f:
    f.writelines(out)
print("Filas quitadas -> Estado del producto:", removed[0], "| Estimacion vs real:", removed[1])
