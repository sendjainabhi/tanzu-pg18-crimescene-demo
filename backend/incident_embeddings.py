import hashlib
import math
import re

DIMENSIONS = 384

# Small controlled vocabulary for this synthetic workshop.
ALIASES = {
    "automobile": "vehicle",
    "car": "vehicle",
    "truck": "vehicle",
    "van": "vehicle",
    "camera": "cctv",
    "surveillance": "cctv",
    "recording": "cctv",
    "witnesses": "witness",
    "windows": "window",
    "blocked": "obstruction",
    "obstructed": "obstruction",
    "wall": "obstruction",
    "trees": "tree",
}

def encode(text):
    values = [0.0] * DIMENSIONS

    tokens = re.findall(r"[a-z]+", text.lower())

    for token in tokens:
        token = ALIASES.get(token, token)

        digest = hashlib.sha256(
            token.encode("utf-8")
        ).digest()

        index = int.from_bytes(
            digest[:4], "big"
        ) % DIMENSIONS

        values[index] += 1.0

    norm = math.sqrt(sum(v*v for v in values))

    if norm:
        values = [v / norm for v in values]

    return values


def vector_literal(values):
    return "[" + ",".join(
        format(v, ".9g") for v in values
    ) + "]"
