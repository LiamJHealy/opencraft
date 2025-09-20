import json
from pathlib import Path

PAIRS = [
    {"left": "fire", "right": "water", "result": "steam", "emoji": "♨️", "tags": ["elements"]},
    {"left": "fire", "right": "air", "result": "energy", "emoji": "⚡", "tags": ["elements"]},
    {"left": "fire", "right": "earth", "result": "lava", "emoji": "🌋", "tags": ["elements"]},
    {"left": "water", "right": "earth", "result": "mud", "emoji": "🪣", "tags": ["elements"]},
    {"left": "water", "right": "air", "result": "mist", "emoji": "🌫️", "tags": ["elements"]},
    {"left": "earth", "right": "air", "result": "seed", "emoji": "🌱", "tags": ["nature"]},
    {"left": "mud", "right": "air", "result": "clay", "emoji": "🟫", "tags": ["craft"]},
    {"left": "clay", "right": "fire", "result": "pottery", "emoji": "🏺", "tags": ["target", "target:pottery"]},
    {"left": "clay", "right": "kiln", "result": "pottery", "emoji": "🏺", "tags": ["target", "target:pottery"]},
    {"left": "mud", "right": "energy", "result": "brick", "emoji": "🧱", "tags": ["craft"]},
    {"left": "brick", "right": "air", "result": "kiln", "emoji": "🏚️", "tags": ["craft"]},
    {"left": "mud", "right": "fire", "result": "ember", "emoji": "🔥", "tags": ["nature"]},
    {"left": "ember", "right": "air", "result": "campfire", "emoji": "🏕️", "tags": ["target", "target:campfire"]},
    {"left": "tree", "right": "fire", "result": "campfire", "emoji": "🏕️", "tags": ["target", "target:campfire"]},
    {"left": "wood", "right": "fire", "result": "campfire", "emoji": "🏕️", "tags": ["target", "target:campfire"]},
    {"left": "seed", "right": "water", "result": "sprout", "emoji": "🌿", "tags": ["nature"]},
    {"left": "sprout", "right": "water", "result": "tree", "emoji": "🌳", "tags": ["nature"]},
    {"left": "tree", "right": "air", "result": "wood", "emoji": "🪵", "tags": ["nature"]},
    {"left": "energy", "right": "air", "result": "wind", "emoji": "💨", "tags": ["elements"]},
    {"left": "wind", "right": "earth", "result": "windmill", "emoji": "🌾", "tags": ["target", "target:windmill"]},
    {"left": "wind", "right": "wood", "result": "windmill", "emoji": "🌾", "tags": ["target", "target:windmill"]},
    {"left": "sprout", "right": "earth", "result": "plant", "emoji": "🪴", "tags": ["nature"]},
    {"left": "plant", "right": "water", "result": "garden", "emoji": "🌼", "tags": ["nature"]},
    {"left": "sprout", "right": "mist", "result": "plant", "emoji": "🪴", "tags": ["nature"]},
    {"left": "energy", "right": "earth", "result": "sand", "emoji": "🏖️", "tags": ["nature"]},
    {"left": "sand", "right": "fire", "result": "glass", "emoji": "🪟", "tags": ["craft"]},
    {"left": "energy", "right": "glass", "result": "sunlight", "emoji": "☀️", "tags": ["nature"]},
    {"left": "garden", "right": "glass", "result": "greenhouse", "emoji": "🏡", "tags": ["target", "target:greenhouse"]},
    {"left": "garden", "right": "sunlight", "result": "greenhouse", "emoji": "🏡", "tags": ["target", "target:greenhouse"]},
    {"left": "lava", "right": "air", "result": "metal", "emoji": "⛏️", "tags": ["industry"]},
    {"left": "metal", "right": "energy", "result": "magnet", "emoji": "🧲", "tags": ["industry"]},
    {"left": "magnet", "right": "sand", "result": "lodestone", "emoji": "🪨", "tags": ["industry"]},
    {"left": "lodestone", "right": "wood", "result": "compass", "emoji": "🧭", "tags": ["target", "target:compass"]},
    {"left": "lodestone", "right": "glass", "result": "compass", "emoji": "🧭", "tags": ["target", "target:compass"]},
    {"left": "brick", "right": "brick", "result": "tower", "emoji": "🗼", "tags": ["structure"]},
    {"left": "glass", "right": "metal", "result": "lens", "emoji": "🔍", "tags": ["science"]},
    {"left": "lava", "right": "water", "result": "stone", "emoji": "🪨", "tags": ["nature"]},
    {"left": "lens", "right": "tower", "result": "observatory", "emoji": "🔭", "tags": ["target", "target:observatory"]},
    {"left": "lens", "right": "stone", "result": "observatory", "emoji": "🔭", "tags": ["target", "target:observatory"]},
    {"left": "plant", "right": "plant", "result": "grove", "emoji": "🌳", "tags": ["nature"]},
    {"left": "grove", "right": "water", "result": "forest", "emoji": "🌲", "tags": ["nature"]},
    {"left": "seed", "right": "energy", "result": "life", "emoji": "💫", "tags": ["nature"]},
    {"left": "life", "right": "water", "result": "fauna", "emoji": "🦋", "tags": ["nature"]},
    {"left": "fauna", "right": "plant", "result": "animals", "emoji": "🐾", "tags": ["nature"]},
    {"left": "forest", "right": "animals", "result": "ecosystem", "emoji": "🌍", "tags": ["target", "target:ecosystem"]},
    {"left": "forest", "right": "life", "result": "ecosystem", "emoji": "🌍", "tags": ["target", "target:ecosystem"]},
    {"left": "metal", "right": "mist", "result": "wire", "emoji": "🧵", "tags": ["industry"]},
    {"left": "wire", "right": "glass", "result": "circuit", "emoji": "🔌", "tags": ["industry"]},
    {"left": "circuit", "right": "metal", "result": "machine", "emoji": "⚙️", "tags": ["industry"]},
    {"left": "mist", "right": "energy", "result": "thought", "emoji": "💭", "tags": ["mind"]},
    {"left": "thought", "right": "energy", "result": "intelligence", "emoji": "🧠", "tags": ["mind"]},
    {"left": "machine", "right": "intelligence", "result": "robotics", "emoji": "🤖", "tags": ["target", "target:robotics"]},
    {"left": "machine", "right": "circuit", "result": "robotics", "emoji": "🤖", "tags": ["target", "target:robotics"]},
    {"left": "wind", "right": "fire", "result": "thrust", "emoji": "💥", "tags": ["industry"]},
    {"left": "thrust", "right": "metal", "result": "engine", "emoji": "🔧", "tags": ["industry"]},
    {"left": "engine", "right": "circuit", "result": "rocket", "emoji": "🚀", "tags": ["industry"]},
    {"left": "engine", "right": "wind", "result": "rocket", "emoji": "🚀", "tags": ["industry"]},
    {"left": "sunlight", "right": "air", "result": "sky", "emoji": "🌤️", "tags": ["nature"]},
    {"left": "sky", "right": "wind", "result": "orbit", "emoji": "🌀", "tags": ["space"]},
    {"left": "rocket", "right": "orbit", "result": "satellite", "emoji": "🛰️", "tags": ["target", "target:satellite"]},
    {"left": "energy", "right": "energy", "result": "pulse", "emoji": "💓", "tags": ["mind"]},
    {"left": "pulse", "right": "glass", "result": "time", "emoji": "⏳", "tags": ["mind"]},
    {"left": "rocket", "right": "signal", "result": "satellite", "emoji": "🛰️", "tags": ["target", "target:satellite"]},
    {"left": "pulse", "right": "wind", "result": "signal", "emoji": "📡", "tags": ["space"]},
    {"left": "steam", "right": "air", "result": "sound", "emoji": "🔊", "tags": ["culture"]},
    {"left": "life", "right": "air", "result": "emotion", "emoji": "❤️", "tags": ["culture"]},
    {"left": "sound", "right": "emotion", "result": "music", "emoji": "🎶", "tags": ["culture"]},
    {"left": "wood", "right": "seed", "result": "village", "emoji": "🏘️", "tags": ["culture"]},
    {"left": "village", "right": "village", "result": "community", "emoji": "🧑‍🤝‍🧑", "tags": ["culture"]},
    {"left": "music", "right": "community", "result": "orchestra", "emoji": "🎻", "tags": ["culture"]},
    {"left": "orchestra", "right": "time", "result": "symphony", "emoji": "🎼", "tags": ["target", "target:symphony"]},
    {"left": "orchestra", "right": "emotion", "result": "symphony", "emoji": "🎼", "tags": ["target", "target:symphony"]},
]

TARGETS = [
    {"name": "pottery", "emoji": "🏺", "difficulty": "easy", "recipes": [["clay", "fire"], ["clay", "kiln"]]},
    {"name": "campfire", "emoji": "🏕️", "difficulty": "easy", "recipes": [["ember", "air"], ["tree", "fire"], ["wood", "fire"]]},
    {"name": "windmill", "emoji": "🌾", "difficulty": "easy", "recipes": [["wind", "earth"], ["wind", "wood"]]},
    {"name": "greenhouse", "emoji": "🏡", "difficulty": "medium", "recipes": [["garden", "glass"], ["garden", "sunlight"]]},
    {"name": "compass", "emoji": "🧭", "difficulty": "medium", "recipes": [["lodestone", "wood"], ["lodestone", "glass"]]},
    {"name": "observatory", "emoji": "🔭", "difficulty": "medium", "recipes": [["lens", "tower"], ["lens", "stone"]]},
    {"name": "ecosystem", "emoji": "🌍", "difficulty": "hard", "recipes": [["forest", "animals"], ["forest", "life"]]},
    {"name": "robotics", "emoji": "🤖", "difficulty": "hard", "recipes": [["machine", "intelligence"], ["machine", "circuit"]]},
    {"name": "satellite", "emoji": "🛰️", "difficulty": "hard", "recipes": [["rocket", "orbit"], ["rocket", "signal"]]},
    {"name": "symphony", "emoji": "🎼", "difficulty": "hard", "recipes": [["orchestra", "time"], ["orchestra", "emotion"]]},
]

EMOJI_MAP = {
    "fire": "🔥",
    "water": "💧",
    "earth": "🌍",
    "air": "🌬️",
    "steam": "♨️",
    "energy": "⚡",
    "lava": "🌋",
    "mud": "🪣",
    "mist": "🌫️",
    "seed": "🌱",
    "clay": "🟫",
    "brick": "🧱",
    "kiln": "🏚️",
    "pottery": "🏺",
    "ember": "🔥",
    "campfire": "🏕️",
    "sprout": "🌿",
    "tree": "🌳",
    "wood": "🪵",
    "wind": "💨",
    "windmill": "🌾",
    "plant": "🪴",
    "garden": "🌼",
    "sand": "🏖️",
    "glass": "🪟",
    "sunlight": "☀️",
    "metal": "⛏️",
    "magnet": "🧲",
    "lodestone": "🪨",
    "compass": "🧭",
    "tower": "🗼",
    "lens": "🔍",
    "stone": "🪨",
    "observatory": "🔭",
    "grove": "🌳",
    "forest": "🌲",
    "life": "💫",
    "fauna": "🦋",
    "animals": "🐾",
    "ecosystem": "🌍",
    "wire": "🧵",
    "circuit": "🔌",
    "machine": "⚙️",
    "thought": "💭",
    "intelligence": "🧠",
    "robotics": "🤖",
    "thrust": "💥",
    "engine": "🔧",
    "rocket": "🚀",
    "sky": "🌤️",
    "orbit": "🌀",
    "satellite": "🛰️",
    "signal": "📡",
    "pulse": "💓",
    "time": "⏳",
    "sound": "🔊",
    "emotion": "❤️",
    "music": "🎶",
    "village": "🏘️",
    "community": "🧑‍🤝‍🧑",
    "orchestra": "🎻",
    "symphony": "🎼",
}

STARTERS = {"fire", "water", "earth", "air"}

GOALS = {t["name"] for t in TARGETS}

VOCABULARY = [
    {"name": "fire", "aliases": ["flame"]},
    {"name": "water", "aliases": ["aqua"]},
    {"name": "earth", "aliases": ["soil"]},
    {"name": "air", "aliases": ["wind"]},
]

FALLBACK_EMOJI = "🧩"

def build_elements():
    elements = {}
    for pair in PAIRS:
        for name in (pair["left"], pair["right"], pair["result"]):
            if name not in elements:
                elements[name] = {
                    "name": name,
                    "emoji": EMOJI_MAP.get(name, FALLBACK_EMOJI),
                    "starter": name in STARTERS,
                    "goal": name in GOALS,
                }
    for target in TARGETS:
        name = target["name"]
        if name not in elements:
            elements[name] = {
                "name": name,
                "emoji": target.get("emoji") or EMOJI_MAP.get(name, FALLBACK_EMOJI),
                "starter": False,
                "goal": True,
            }
        else:
            elements[name]["goal"] = True
            if target.get("emoji"):
                elements[name]["emoji"] = target["emoji"]
    return sorted(elements.values(), key=lambda e: e["name"])

def main():
    doc = {
        "version": 3,
        "pairs": PAIRS,
        "elements": build_elements(),
        "targets": TARGETS,
        "vocabulary": VOCABULARY,
        "constraints": {"blocklistResults": [], "maxResultLen": 40},
    }
    out_path = Path("src/data/seeds.json")
    out_path.write_text(json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(PAIRS)} pairs, {len(doc['elements'])} elements, {len(TARGETS)} targets")

if __name__ == "__main__":
    main()
