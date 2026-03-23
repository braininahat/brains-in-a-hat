#!/usr/bin/env bash
# brains-in-a-hat statusline extension
# Reads activity.jsonl and shows active agent count
# Called by Claude Code's statusLine.command — receives JSON on stdin

input=$(cat)
cwd=$(echo "$input" | jq -r '.workspace.current_dir')
model=$(echo "$input" | jq -r '.model.display_name')
user=$(whoami)
host=$(hostname -s)
dir=$(echo "$cwd" | sed "s|$HOME|~|g")

# Count active agents from activity.jsonl (started but not done, last 10 min)
activity_file="$cwd/.claude/team/activity.jsonl"
agent_info=""
if [ -f "$activity_file" ]; then
    cutoff=$(date -d '10 minutes ago' -Iseconds 2>/dev/null || date -v-10M -Iseconds 2>/dev/null)
    if [ -n "$cutoff" ]; then
        # Get recent starts and dones, find agents that started but haven't finished
        active=$(tail -200 "$activity_file" 2>/dev/null | \
            jq -r --arg cutoff "$cutoff" '
                select(.ts >= $cutoff) |
                select(.event == "start" or .event == "done") |
                "\(.event) \(.agent)"
            ' 2>/dev/null | \
            awk '
                /^start / { started[$2] = 1 }
                /^done /  { delete started[$2] }
                END { for (a in started) printf "%s ", a }
            ')

        count=$(echo "$active" | wc -w | tr -d ' ')
        if [ "$count" -gt 0 ]; then
            # Truncate agent names if too many
            if [ "$count" -le 3 ]; then
                names=$(echo "$active" | xargs | sed 's/ /, /g')
                agent_info=" \033[01;33m[$count: $names]\033[00m"
            else
                agent_info=" \033[01;33m[$count agents]\033[00m"
            fi
        fi
    fi
fi

printf "\033[01;32m%s@%s\033[00m:\033[01;34m%s\033[00m [%s]%b" \
    "$user" "$host" "$dir" "$model" "$agent_info"
