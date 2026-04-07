# lib.sh — minion active flag helpers
# Project-local state lives in .minion/state/ relative to the project root.
# Source this file from hook scripts.

_minion_project_root() {
    # Walk up from cwd to find .git root, fall back to HOME
    local dir="${PWD}"
    while [[ "$dir" != "/" ]]; do
        if [[ -d "$dir/.git" ]]; then
            echo "$dir"
            return
        fi
        dir="$(dirname "$dir")"
    done
    echo "$HOME"
}

is_active() {
    local root
    root="$(_minion_project_root)"
    local state_dir="$root/.minion/state"
    [[ -n "$(ls "$state_dir"/active.* 2>/dev/null)" ]]
}

activate() {
    local root
    root="$(_minion_project_root)"
    local state_dir="$root/.minion/state"
    mkdir -p "$state_dir"
    touch "$state_dir/active.$$"
}

deactivate() {
    local root
    root="$(_minion_project_root)"
    local state_dir="$root/.minion/state"
    rm -f "$state_dir"/active.* 2>/dev/null
}
