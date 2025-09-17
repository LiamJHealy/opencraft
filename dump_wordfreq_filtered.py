# dump_wordfreq_filtered.py
from wordfreq import zipf_frequency, top_n_list
import json, math, os
from collections import Counter

# --- Config ---
ZIPF_MIN = float(os.environ.get("ZIPF_MIN", "3.4"))  # change to 3.6/3.8 if you want stricter
MAX_N = int(os.environ.get("MAX_N", "200000"))        # scan up to this many, but we stop early when < ZIPF_MIN
OUT_PATH = os.environ.get("OUT_PATH", "src/lib/lexicon/common_zipf.json")

STOPWORDS = {
    "the","a","an","it","its","they","them","their","i","you","he","she","we","us","our",
    "this","that","these","those","there","here","what","which","who","whom","whose",
    "to","of","in","on","at","by","for","from","with","about","into","over","after","under",
    "and","or","but","so","yet","nor","either","neither","both","not","no",
    "is","am","are","was","were","be","been","being","do","does","did","done",
    "have","has","had","having","can","could","will","would","shall","should","may","might","must",
    "as","than","too","very","just","only","also","if","because","while","since","until","before","between",
    "up","down","out","off","again","further","then","once","each","few","more","most","some","such","own",
    "same","i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you", "your", "yours", "yourself", 
    "yourselves", "he", "him", "his", "himself", "she", "her", "hers", "herself", "it", "its", "itself", 
    "they", "them", "their", "theirs", "themselves", "what", "which", "who", "whom", "this", "that", 
    "these", "those", "am", "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", 
    "having", "do", "does", "did", "doing", "a", "an", "the", "and", "but", "if", "or", "because", "as", 
    "until", "while", "of", "at", "by", "for", "with", "about", "against", "between", "into", "through", 
    "during", "before", "after", "above", "below", "to", "from", "up", "down", "in", "out", "on", "off", 
    "over", "under", "again", "further", "then", "once", "here", "there", "when", "where", "why", "how", 
    "all", "any", "both", "each", "few", "more", "most", "other", "some", "such", "no", "nor", "not", "only", 
    "own", "same", "so", "than", "too", "very", "s", "t", "can", "will", "just", "don", "should", "now"
}

ALLOW_SHORT = {"sun","ice","war","law","sea","dog","cat","map"}

def wanted(w: str) -> bool:
    wl = w.lower()
    if not wl.isalpha():
        return False
    if wl in STOPWORDS:
        return False
    if len(wl) <= 2 and wl not in ALLOW_SHORT:
        return False
    return True

def main():
    words = top_n_list("en", MAX_N)  # sorted by frequency (most common first)
    freq_map = {}
    bucket = Counter()

    for w in words:
        z = zipf_frequency(w, "en")
        if z < ZIPF_MIN:
            # Because list is sorted by freq, everything after this is even lower — safe to stop.
            break
        if not wanted(w):
            continue
        z_round = round(z, 1)
        freq_map[w] = z_round
        # simple histogram buckets (0.1 width around your cutoff)
        b = math.floor((z_round - ZIPF_MIN) * 10)  # e.g., 3.5->0, 3.6->1, ...
        bucket[b] += 1

    # Save JSON (compact)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(freq_map, f, ensure_ascii=False, separators=(",", ":"))

    # Report
    kept = len(freq_map)
    print(f"ZIPF_MIN={ZIPF_MIN}  kept={kept}  wrote={OUT_PATH}")
    # tiny histogram preview
    if kept:
        print("Histogram (by 0.1 Zipf bins above threshold):")
        for i in range(min(15, max(bucket.keys()) + 1)):
            lo = ZIPF_MIN + i/10
            hi = lo + 0.1
            print(f"  {lo:.1f}–{hi:.1f}: {bucket.get(i, 0)}")

    # Sample few
    sample = list(freq_map.items())[-10:]
    print("Sample:", sample[:10])
    print("Total: {:,.0f}".format(len(list(freq_map.items()))))

if __name__ == "__main__":
    main()