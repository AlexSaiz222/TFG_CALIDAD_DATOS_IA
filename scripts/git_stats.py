"""Generate commit activity figures for the TFG memoir.

Reads `git log` from the repo this script lives in and produces three PDF
figures in `scripts/output/`:

  - commits-timeline.pdf      Weekly commits with sprint boundary markers
  - commits-per-sprint.pdf    Total commits aggregated per sprint
  - commits-density.pdf       Calendar heatmap (weekday x ISO week)

Run from the repo root:

    pip install matplotlib pandas numpy
    python scripts/git_stats.py

Sprint dates are hardcoded below in SPRINTS; adjust if the planning changes.
"""

from __future__ import annotations

import subprocess
import sys
from datetime import datetime
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import numpy as np
import pandas as pd
from matplotlib.colors import LinearSegmentedColormap

# ---- Configuration ---------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "scripts" / "output"

# Sprint windows. Sprints 5 and 6 have no explicit dates in the TFG backlog;
# the natural months until the defence are assumed.
SPRINTS = [
    ("Sprint 1", "2025-08-01", "2025-09-30"),
    ("Sprint 2", "2026-01-01", "2026-01-31"),
    ("Sprint 3", "2026-02-01", "2026-02-28"),
    ("Sprint 4", "2026-03-01", "2026-03-31"),
    ("Sprint 5", "2026-04-01", "2026-04-30"),
    ("Sprint 6", "2026-05-01", "2026-06-30"),
]

# Palette aligned with the frontend accent colour (#00B37E).
ACCENT = "#00B37E"
ACCENT_DARK = "#008F66"
NEUTRAL = "#4A4A4A"
LIGHT_GREY = "#E5E5E5"


# ---- Data loading ----------------------------------------------------------

def load_commits() -> pd.DataFrame:
    """Return a DataFrame with one row per commit."""
    result = subprocess.run(
        ["git", "-C", str(REPO_ROOT), "log",
         "--pretty=format:%H|%ad|%an|%s",
         "--date=iso-strict"],
        capture_output=True, text=True, check=True, encoding="utf-8",
    )
    rows = []
    for line in result.stdout.splitlines():
        sha, date_str, author, subject = line.split("|", 3)
        rows.append({"sha": sha, "date": date_str, "author": author, "subject": subject})
    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"].str[:19])
    df["weekday"] = df["date"].dt.weekday  # 0=Mon
    df["iso_year"] = df["date"].dt.isocalendar().year
    df["iso_week"] = df["date"].dt.isocalendar().week
    df["week_start"] = df["date"] - pd.to_timedelta(df["date"].dt.weekday, unit="D")
    df["week_start"] = df["week_start"].dt.normalize()
    df["sprint"] = df["date"].map(_assign_sprint)
    return df


def _assign_sprint(ts: pd.Timestamp) -> str | None:
    for name, start, end in SPRINTS:
        if pd.Timestamp(start) <= ts <= pd.Timestamp(end) + pd.Timedelta(days=1):
            return name
    return None


# ---- Styling ---------------------------------------------------------------

def apply_style() -> None:
    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "axes.titlesize": 12,
        "axes.titleweight": "bold",
        "axes.labelsize": 10,
        "axes.edgecolor": NEUTRAL,
        "axes.labelcolor": NEUTRAL,
        "xtick.color": NEUTRAL,
        "ytick.color": NEUTRAL,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.color": LIGHT_GREY,
        "grid.linewidth": 0.6,
        "figure.facecolor": "white",
        "axes.facecolor": "white",
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.15,
    })


# ---- Figures ---------------------------------------------------------------

def plot_timeline(df: pd.DataFrame, out: Path) -> None:
    weekly = df.groupby("week_start").size().rename("commits")
    full_range = pd.date_range(weekly.index.min(), weekly.index.max(), freq="W-MON")
    weekly = weekly.reindex(full_range, fill_value=0)

    fig, ax = plt.subplots(figsize=(10, 4.2))
    ax.bar(weekly.index, weekly.values, width=6, color=ACCENT, edgecolor="none")

    ymax = max(weekly.values.max(), 1)
    for name, start, _end in SPRINTS:
        x = pd.Timestamp(start)
        if weekly.index.min() <= x <= weekly.index.max() + pd.Timedelta(days=7):
            ax.axvline(x, color=NEUTRAL, linestyle="--", linewidth=0.8, alpha=0.7)
            ax.text(x, ymax * 1.02, name, rotation=0, ha="left", va="bottom",
                    fontsize=8, color=NEUTRAL)

    ax.set_title("Commits por semana")
    ax.set_xlabel("Semana")
    ax.set_ylabel("Nº de commits")
    ax.xaxis.set_major_locator(mdates.MonthLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %Y"))
    ax.set_ylim(0, ymax * 1.18)
    fig.autofmt_xdate(rotation=30)
    fig.savefig(out, format="pdf")
    plt.close(fig)


def plot_per_sprint(df: pd.DataFrame, out: Path) -> None:
    names = [s[0] for s in SPRINTS]
    counts = [int((df["sprint"] == n).sum()) for n in names]

    fig, ax = plt.subplots(figsize=(8, 4.2))
    bars = ax.bar(names, counts, color=ACCENT, edgecolor="none", width=0.6)
    for bar, value in zip(bars, counts):
        ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(counts) * 0.015,
                str(value), ha="center", va="bottom", fontsize=10, color=NEUTRAL,
                fontweight="bold")
    ax.set_title("Commits por sprint")
    ax.set_ylabel("Nº de commits")
    ax.set_ylim(0, max(counts) * 1.15 if counts else 1)
    fig.savefig(out, format="pdf")
    plt.close(fig)


def plot_density(df: pd.DataFrame, out: Path) -> None:
    """Calendar-style heatmap: weekdays x ISO weeks.

    Each cell shows the number of commits made on that weekday during that ISO week.
    """
    # Pivot to weekday x week_start
    weekly_dow = (
        df.groupby([df["week_start"], "weekday"]).size()
          .unstack(fill_value=0)
    )
    # Ensure every weekday column exists (0..6) and every week is present.
    weekly_dow = weekly_dow.reindex(columns=range(7), fill_value=0)
    full_weeks = pd.date_range(weekly_dow.index.min(), weekly_dow.index.max(), freq="W-MON")
    weekly_dow = weekly_dow.reindex(full_weeks, fill_value=0)

    matrix = weekly_dow.values.T  # rows = weekday (0..6), cols = weeks

    cmap = LinearSegmentedColormap.from_list("dq", ["#F2FBF7", ACCENT, ACCENT_DARK])

    fig, ax = plt.subplots(figsize=(11, 3.2))
    im = ax.imshow(matrix, aspect="auto", cmap=cmap, interpolation="nearest")

    ax.set_yticks(range(7))
    ax.set_yticklabels(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"])

    # X ticks at the first week of each month present.
    months_seen: dict[str, int] = {}
    for i, ts in enumerate(weekly_dow.index):
        key = ts.strftime("%Y-%m")
        months_seen.setdefault(key, i)
    tick_idx = list(months_seen.values())
    tick_labels = [weekly_dow.index[i].strftime("%b %Y") for i in tick_idx]
    ax.set_xticks(tick_idx)
    ax.set_xticklabels(tick_labels, rotation=30, ha="right")

    ax.set_title("Densidad de commits a lo largo del tiempo")
    ax.grid(False)
    cbar = fig.colorbar(im, ax=ax, fraction=0.03, pad=0.02)
    cbar.set_label("Commits / día", color=NEUTRAL)
    cbar.outline.set_visible(False)
    fig.savefig(out, format="pdf")
    plt.close(fig)


# ---- Entry point -----------------------------------------------------------

def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    apply_style()
    df = load_commits()
    if df.empty:
        print("No commits found.", file=sys.stderr)
        return 1

    plot_timeline(df, OUTPUT_DIR / "commits-timeline.pdf")
    plot_per_sprint(df, OUTPUT_DIR / "commits-per-sprint.pdf")
    plot_density(df, OUTPUT_DIR / "commits-density.pdf")

    total = len(df)
    by_sprint = df["sprint"].value_counts(dropna=False)
    unassigned = int(by_sprint.get(np.nan, 0))
    print(f"Total commits: {total}")
    print("Per sprint:")
    for name, _s, _e in SPRINTS:
        print(f"  {name}: {int(by_sprint.get(name, 0))}")
    if unassigned:
        print(f"  (unassigned to any sprint: {unassigned})")
    print(f"\nFigures written to: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
