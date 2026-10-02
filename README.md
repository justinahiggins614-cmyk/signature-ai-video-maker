# The Signature Video Maker AI

**TITLE PROVISIONAL** — the official name is still to be confirmed by Manon.

**FREE AND UNLIMITED** AI video generation — site 25 of THE JAH NETWORK.

Live: https://justinahiggins614-cmyk.github.io/signature-ai-video-maker/

Sister site: [Signature AI Pixel](https://justinahiggins614-cmyk.github.io/signature-ai-image-video-maker/) (site 24 — free and unlimited image generation).

## What it is
- **Video Studio** — type a prompt, get a live canvas animation preview (3/6/10s @ 15fps), export a real `.webm`. Deterministic: the same prompt always makes the same video.
- **Video Ads** — JAH-AD-###### records auto-made for products across the Signature network (mall, books, comics), each with an animated video creative, stored as made. Export .webm.
- **Take the video AI** — the whole video generator is one file (`assets/engine.js`), downloadable/copyable, offline, no keys.

## Data layout
- `data/ads_state.json` — ads next_index/total + product rotation cursor
- `data/ads/cNNNN.jsonl.gz` — 250 ads/chunk
- `data/index/ads.idx.json.gz` — compact search index

## Drip
`python3 code/drip.py [n_ads=250]` — every 2h via `jah-videomaker-drip` cron (silent). 800MB guard.

## Honesty notes
- All animation is original and deterministic; nothing reproduces trademarked characters/logos/brands.
- "Free and unlimited" applies to this generator.
