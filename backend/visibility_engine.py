import math


def segment_box(start, end, low, high, eps=1e-7):
    direction = [end[i] - start[i] for i in range(3)]
    enter, leave = 0.0, 1.0

    for i in range(3):
        if abs(direction[i]) < eps:
            if start[i] < low[i] or start[i] > high[i]:
                return False
            continue

        a = (low[i] - start[i]) / direction[i]
        b = (high[i] - start[i]) / direction[i]

        enter = max(enter, min(a, b))
        leave = min(leave, max(a, b))

        if enter > leave:
            return False

    return enter < 1.0 - eps and leave > eps


def segment_sphere(start, end, center, radius):
    direction = [end[i] - start[i] for i in range(3)]
    length_sq = sum(v * v for v in direction)

    if length_sq < 1e-12:
        return False

    t = sum(
        (center[i] - start[i]) * direction[i]
        for i in range(3)
    ) / length_sq

    t = max(0.0, min(1.0, t))

    nearest = [
        start[i] + t * direction[i]
        for i in range(3)
    ]

    return sum(
        (nearest[i] - center[i]) ** 2
        for i in range(3)
    ) < radius ** 2


def building_bounds(building):
    points = building["geometry"]["coordinates"][0]

    xs = [p[0] for p in points]
    ys = [p[1] for p in points]

    return (
        [min(xs), min(ys), 0],
        [max(xs), max(ys), building["height_m"]]
    )


def building_blocks(start, end, building, target_id):
    if building["id"] == target_id:
        return False

    low, high = building_bounds(building)
    return segment_box(start, end, low, high)


def facade_allows_view(start, window, building):
    low, high = building_bounds(building)
    x, y, _ = start

    facade = window.get("facade")

    if facade == "north":
        return y > high[1] + 0.01

    if facade == "south":
        return y < low[1] - 0.01

    if facade == "east":
        return x > high[0] + 0.01

    if facade == "west":
        return x < low[0] - 0.01

    return False


def object_blocks(start, end, obj):
    if not obj.get("enabled", True):
        return False

    if not obj.get("blocks_visibility", False):
        return False

    x = obj["x"]
    y = obj["y"]
    z = obj["z"]
    dims = obj["dimensions"]

    kind = obj["object_type"]

    if kind == "tree":
        center = [
            x,
            y,
            z + dims.get("canopy_center_z", 5.5)
        ]

        if segment_sphere(
            start,
            end,
            center,
            dims.get("canopy_radius", 2.4)
        ):
            return True

        radius = dims.get("trunk_radius", 0.35)
        height = dims.get("trunk_height", 3.0)

        return segment_box(
            start,
            end,
            [x-radius, y-radius, z],
            [x+radius, y+radius, z+height]
        )

    if kind in ("vehicle", "wall"):
        width = dims.get("width", 2.0)
        depth = dims.get(
            "depth",
            dims.get("length", 2.0)
        )
        height = dims.get("height", 2.0)

        return segment_box(
            start,
            end,
            [x-width/2, y-depth/2, z],
            [x+width/2, y+depth/2, z+height]
        )

    return False


def analyze_visibility(start, windows, buildings, objects):
    results = []

    building_lookup = {
        b["id"]: b for b in buildings
    }

    for window in windows:
        end = [
            window["x"],
            window["y"],
            window["z"]
        ]

        blockers = []

        target = building_lookup.get(
            window["building_id"]
        )

        if target is None:
            blockers.append("Unknown building")

        elif not facade_allows_view(
            start,
            window,
            target
        ):
            blockers.append(
                "Target facade not facing incident"
            )

        for building in buildings:
            if building_blocks(
                start,
                end,
                building,
                window["building_id"]
            ):
                blockers.append(building["name"])

        for obj in objects:
            if object_blocks(start, end, obj):
                blockers.append(obj["name"])

        result = dict(window)
        result["visible"] = len(blockers) == 0
        result["blockers"] = blockers

        results.append(result)

    return results
