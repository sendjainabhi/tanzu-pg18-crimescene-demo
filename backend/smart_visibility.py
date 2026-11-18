from visibility_engine import (
    analyze_visibility,
    facade_allows_view
)


def classify_windows(start, windows, buildings, objects):
    analyzed = analyze_visibility(
        start, windows, buildings, objects
    )

    building_lookup = {
        b["id"]: b for b in buildings
    }

    for window in analyzed:
        target = building_lookup.get(
            window["building_id"]
        )

        if target is None:
            window["visibility_status"] = "unknown"

        elif not facade_allows_view(
            start, window, target
        ):
            window["visibility_status"] = "not_facing"

        elif window["visible"]:
            window["visibility_status"] = "visible"

        else:
            window["visibility_status"] = "obstructed"

    return analyzed


def summarize_visibility(windows, k):
    visible = [
        w for w in windows
        if w["visibility_status"] == "visible"
    ]

    obstructed = [
        w for w in windows
        if w["visibility_status"] == "obstructed"
    ]

    not_facing = [
        w for w in windows
        if w["visibility_status"] == "not_facing"
    ]

    unknown = [
        w for w in windows
        if w["visibility_status"] == "unknown"
    ]

    return {
        "candidate_count": len(windows),
        "visible_count": len(visible),
        "blocked_count": (
            len(obstructed) +
            len(not_facing) +
            len(unknown)
        ),
        "obstructed_count": len(obstructed),
        "not_facing_count": len(not_facing),
        "unknown_count": len(unknown),
        "visible_windows": visible[:k],
        "blocked_windows": (
            obstructed + not_facing + unknown
        ),
        "obstructed_windows": obstructed,
        "not_facing_windows": not_facing
    }
