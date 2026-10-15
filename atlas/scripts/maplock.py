#!/usr/bin/env python3
"""Keeps several sessions from writing one project's atlas map at the same time.

    python3 -I maplock.py take <lock dir>     wait for the lock
    python3 -I maplock.py drop <lock dir>
    python3 -I maplock.py put <tmp> <file>    replace <file> with <tmp> in one step, so readers never see half a file

The lock is a folder: creating one is atomic across processes. (Not with the shell's mkdir:
uutils coreutils 0.10, Ubuntu 26.04's default, lets two racing processes both succeed.)
take waits up to 5 s. A lock older than 5 s belongs to a writer that died, so it is broken.
If the lock still cannot be had, take exits 1 and the caller writes anyway: atlas must never block.
"""
import os
import sys
import time

STALE_S = 5.0
WAIT_S = 5.0


def take(lock: str) -> int:
    os.makedirs(os.path.dirname(lock) or ".", exist_ok=True)
    end = time.monotonic() + WAIT_S
    while time.monotonic() < end:
        try:
            os.mkdir(lock)
            return 0
        except FileExistsError:
            pass
        try:
            if time.time() - os.stat(lock).st_mtime >= STALE_S:
                os.rmdir(lock)
                continue
        except OSError:
            continue  # released or broken meanwhile: try again at once
        time.sleep(0.02)
    return 1


def drop(lock: str) -> int:
    try:
        os.rmdir(lock)
    except OSError:
        pass
    return 0


def main() -> int:
    op, args = sys.argv[1], sys.argv[2:]
    if op == "take":
        return take(args[0])
    if op == "drop":
        return drop(args[0])
    if op == "put":
        os.replace(args[0], args[1])
        return 0
    print("usage: maplock.py take|drop <lock dir> | put <tmp> <file>", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
