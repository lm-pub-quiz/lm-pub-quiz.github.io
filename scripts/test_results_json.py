import json
from typing import Any


def is_number(x: Any) -> bool:
    return isinstance(x, (int, float))


def test_results_format():
    with open("results.json") as f:
        data = json.load(f)

    assert isinstance(data, list)

    for entry in data:
        for f in ("model_name", "model_url", "model_family", "model_type"):
            assert isinstance(
                entry["model_name"], str
            ), f"Field {f} is not a string. {str(entry)}"

        assert isinstance(entry["accuracy"], dict), str(entry)

        mean = entry["accuracy"]["mean"]

        assert is_number(mean), str(entry)
        assert 0.0 <= mean <= 1.0, str(entry)

        if not entry["model_family"] == "baseline":
            assert is_number(entry["num_params"]), str(entry)
            assert is_number(entry["accuracy"]["sem"]), str(entry)
