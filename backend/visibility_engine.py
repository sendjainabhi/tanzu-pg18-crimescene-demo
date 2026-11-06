def segment_box(start, end, low, high, eps=1e-7):
    direction = [end[i]-start[i] for i in range(3)]
    enter, leave = 0.0, 1.0

    for i in range(3):
        if abs(direction[i]) < eps:
            if start[i] < low[i] or start[i] > high[i]:
                return False
            continue

        a = (low[i]-start[i])/direction[i]
        b = (high[i]-start[i])/direction[i]
        enter = max(enter, min(a,b))
        leave = min(leave, max(a,b))
        if enter > leave:
            return False

    return enter < 1.0-eps and leave > eps


def segment_sphere(start, end, center, radius):
    d = [end[i]-start[i] for i in range(3)]
    length_sq = sum(v*v for v in d)
    if length_sq < 1e-12:
        return False

    t = sum(
        (center[i]-start[i])*d[i] for i in range(3)
    ) / length_sq
    t = max(0.0, min(1.0, t))
    nearest = [start[i]+t*d[i] for i in range(3)]

    return sum(
        (nearest[i]-center[i])**2 for i in range(3)
    ) < radius**2


def object_blocks(start, end, obj):
    if not obj["enabled"] or not obj["blocks_visibility"]:
        return False

    x,y,z = obj["x"],obj["y"],obj["z"]
    dims = obj["dimensions"]

    if obj["object_type"] == "tree":
        center = [
            x,y,z+dims["canopy_center_z"]
        ]
        if segment_sphere(
            start,end,center,dims["canopy_radius"]
        ):
            return True

        r = dims["trunk_radius"]
        return segment_box(
            start,end,
            [x-r,y-r,z],
            [x+r,y+r,z+dims["trunk_height"]]
        )

    if obj["object_type"] in ("vehicle","wall"):
        w = dims["width"]
        depth = dims.get("depth",dims.get("length"))
        h = dims["height"]

        return segment_box(
            start,end,
            [x-w/2,y-depth/2,z],
            [x+w/2,y+depth/2,z+h]
        )

    return False


def building_blocks(start, end, building, target_id):
    # Simplified model: target facade treated as open.
    if building["id"] == target_id:
        return False

    pts = building["geometry"]["coordinates"][0]
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]

    return segment_box(
        start,end,
        [min(xs),min(ys),0],
        [max(xs),max(ys),building["height_m"]]
    )


def analyze_visibility(start, windows, buildings, objects):
    results = []

    for window in windows:
        end = [window["x"],window["y"],window["z"]]
        blockers = []

        for building in buildings:
            if building_blocks(
                start,end,building,window["building_id"]
            ):
                blockers.append(building["name"])

        for obj in objects:
            if object_blocks(start,end,obj):
                blockers.append(obj["name"])

        result = dict(window)
        result["visible"] = not blockers
        result["blockers"] = blockers
        results.append(result)

    return results
