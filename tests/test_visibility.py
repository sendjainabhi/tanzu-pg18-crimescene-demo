import sys
from pathlib import Path

sys.path.insert(
    0,
    str(Path(__file__).resolve().parents[1] / "backend")
)

from visibility_engine import (
    segment_box,
    segment_sphere,
    object_blocks
)

assert segment_box(
    [0,0,1.5],[20,0,10],
    [8,-2,0],[12,2,15]
)

assert not segment_box(
    [0,0,1.5],[20,0,10],
    [8,5,0],[12,9,15]
)

assert segment_sphere(
    [0,0,1.5],[20,0,10],
    [10,0,6],3
)

assert not segment_sphere(
    [0,0,1.5],[20,0,10],
    [10,15,6],3
)

vehicle = {
    "x":10,"y":0,"z":0,
    "object_type":"vehicle",
    "enabled":True,
    "blocks_visibility":True,
    "dimensions":{
        "width":2.2,
        "length":4.6,
        "height":1.8
    }
}

assert object_blocks(
    [0,0,1],[20,0,1],vehicle
)

print("Visibility tests passed")
