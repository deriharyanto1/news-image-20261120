# THE WORLD TODAY — 20 November 2026

[![news-image-20261120](https://make.fun/badge/news-image-20261120.svg)](https://make.fun/bounty/news-image-20261120)
[![rank](https://make.fun/badge/news-image-20261120/deriharyanto1/news-image-20261120/rank.svg)](https://make.fun/bounty/news-image-20261120)
[![reward](https://make.fun/badge/news-image-20261120/deriharyanto1/news-image-20261120/reward.svg)](https://make.fun/bounty/news-image-20261120)

A one-page newspaper front page summing up Friday, 20 November 2026.

[See the bounty on make.fun](https://make.fun/bounty/news-image-20261120)

## The day's news

Top story: the International Court of Justice rules Myanmar committed
genocide against the Rohingya — the first such finding against a state.
Also in this edition: the first-ever trilateral summit of Trump, Xi and
Putin in Shenzhen; Anthropic shares soaring 17% on their stock market
debut; Iran escalating attacks on Gulf tankers; Cyclone Akvan making
landfall in Odisha; Kyiv hit by ballistic missiles as Ukraine strikes
the Crimean Bridge again; markets falling; COP31 dropping its fossil
fuels reference; and European allies ready for talks with Russia — plus
33 more briefs from across the world, and the voice of a resident of a
besieged Yemeni city.

## How it is made

`main.ts` (Node 22, standard library only) draws the whole page with a
hand-rolled vector stroke font and a hand-rolled PNG encoder, and writes
it to `/output/entry.png`. No network, no dependencies, no image files.

Run it locally:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two runs produce byte-identical output.
